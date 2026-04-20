const { getTodayIso } = require('../src/lib/dateUtils');
const {
  INVOICE_STATUS,
  METER_READING_STATUS,
  PAYMENT_SUBMISSION_STATUS,
  ROOM_STATUS,
  TENANCY_STATUS,
  buildContractRecord,
  cancelInvoiceReminders,
  createInvoiceForTenancy,
  createMeterReadingSubmission,
  createTenantInvite,
  deriveInvoiceStatus,
  isTenantProfileComplete,
  makeId,
} = require('../src/lib/rentEngine');
const {
  buildSessionTokens,
  capRefreshExpiry,
  createSessionRecord,
  hashToken,
  toIso,
  verifyToken,
} = require('./auth');
const { createPrismaClient } = require('./prisma');
const { seedDatabase } = require('./seed');
const { checkPhoneVerification, normalizePhoneNumber, startPhoneVerification } = require('./twilioVerify');
const { readStoredUploadAsDataUrl, saveImageUpload } = require('./uploads');

const emptySession = {
  role: null,
  phone: '',
  currentTenantId: null,
  currentOwnerId: null,
};

const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const OTP_REQUEST_COOLDOWN_MS = 45 * 1000;
const OTP_REQUEST_MAX_ATTEMPTS = 5;
const OTP_VERIFY_MAX_ATTEMPTS = 10;
const otpRequestTracker = new Map();
const otpVerifyTracker = new Map();

function toSession(role, phone, state) {
  if (role === 'owner') {
    return {
      role: 'owner',
      phone,
      currentTenantId: null,
      currentOwnerId: state.owner.id,
    };
  }

  const tenant = state.tenants.find((record) => record.phone === phone);
  return {
    role: 'tenant',
    phone,
    currentTenantId: tenant.id,
    currentOwnerId: null,
  };
}

function requireRecord(record, message) {
  if (!record) {
    throw new Error(message);
  }

  return record;
}

function buildOtpRateKey(role, phone, ipAddress = 'unknown') {
  const safePhone = String(phone || '').replace(/\D+/g, '') || 'unknown';
  return `${role || 'unknown'}:${safePhone}:${ipAddress}`;
}

function takeRateLimitedSlot(tracker, key, { windowMs, maxAttempts, cooldownMs = 0 }) {
  const now = Date.now();
  const existing = tracker.get(key) || {
    attempts: [],
    lastAttemptAt: 0,
  };

  existing.attempts = existing.attempts.filter((timestamp) => now - timestamp < windowMs);

  if (cooldownMs > 0 && existing.lastAttemptAt && now - existing.lastAttemptAt < cooldownMs) {
    throw new Error('Please wait before requesting another code.');
  }

  if (existing.attempts.length >= maxAttempts) {
    throw new Error('Too many attempts. Please try again later.');
  }

  existing.attempts.push(now);
  existing.lastAttemptAt = now;
  tracker.set(key, existing);
}

function applyInlineUploadAccess(records, key) {
  return records.map((record) => ({
    ...record,
    [key]: readStoredUploadAsDataUrl(record[key]),
  }));
}

function applyInlineContractImages(contracts) {
  return contracts.map((contract) => ({
    ...contract,
    imageLabels: Array.isArray(contract.imageLabels)
      ? contract.imageLabels.map((label) => readStoredUploadAsDataUrl(label))
      : contract.imageLabels,
  }));
}

function requireAuthenticatedSession(session) {
  if (!session?.role) {
    throw new Error('Authentication required.');
  }

  return session;
}

function requireOwnerSession(session) {
  const resolvedSession = requireAuthenticatedSession(session);

  if (resolvedSession.role !== 'owner') {
    throw new Error('Only the owner can perform this action.');
  }

  return resolvedSession;
}

function requireTenantSession(session) {
  const resolvedSession = requireAuthenticatedSession(session);

  if (resolvedSession.role !== 'tenant') {
    throw new Error('Only the tenant can perform this action.');
  }

  return resolvedSession;
}

function requireTenantAccess(session, tenantId) {
  const resolvedSession = requireTenantSession(session);

  if (resolvedSession.currentTenantId !== tenantId) {
    throw new Error('You can only access your own tenant records.');
  }

  return resolvedSession;
}

function requireTenancyAccess(session, tenancy) {
  if (session?.role === 'owner') {
    return requireOwnerSession(session);
  }

  const resolvedSession = requireTenantSession(session);

  if (tenancy.tenantId !== resolvedSession.currentTenantId) {
    throw new Error('You can only access your own tenancy.');
  }

  return resolvedSession;
}

function requireInvoiceAccess(session, invoice) {
  if (session?.role === 'owner') {
    return requireOwnerSession(session);
  }

  const resolvedSession = requireTenantSession(session);

  if (invoice.tenantId !== resolvedSession.currentTenantId) {
    throw new Error('You can only access your own invoice.');
  }

  return resolvedSession;
}

function requirePaymentSubmissionAccess(session, submission, invoice) {
  if (session?.role === 'owner') {
    return requireOwnerSession(session);
  }

  const resolvedSession = requireTenantSession(session);

  if (
    submission.tenantId !== resolvedSession.currentTenantId ||
    invoice.tenantId !== resolvedSession.currentTenantId
  ) {
    throw new Error('You can only access your own payment submission.');
  }

  return resolvedSession;
}

function isClientError(error) {
  return /not found|required|unable|only|missing|already|must|invalid|choose|use owner|schedule/i.test(
    error.message,
  );
}

async function findAuthIdentity(prisma, role, phone) {
  const normalizedPhone = String(phone || '').trim();

  if (role === 'owner') {
    const owner = await prisma.owner.findFirst({
      where: { phone: normalizedPhone },
    });

    if (!owner) {
      throw new Error('This owner phone number is not registered.');
    }

    return {
      role: 'owner',
      phone: normalizedPhone,
      ownerId: owner.id,
      tenantId: null,
    };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { phone: normalizedPhone },
  });

  if (!tenant) {
    throw new Error('This tenant phone number is not invited yet.');
  }

  return {
    role: 'tenant',
    phone: normalizedPhone,
    ownerId: null,
    tenantId: tenant.id,
  };
}

async function updateInvoiceStatuses(prisma, referenceDate) {
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      dueDate: true,
      status: true,
    },
    orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
  });

  const updates = invoices
    .map((invoice) => {
      const nextStatus = deriveInvoiceStatus(invoice, referenceDate);
      if (nextStatus === invoice.status) {
        return null;
      }

      return prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: nextStatus },
      });
    })
    .filter(Boolean);

  if (updates.length) {
    await prisma.$transaction(updates);
  }
}

async function recordAudit(prisma, title, detail, referenceDate = getTodayIso()) {
  await prisma.auditTrail.create({
    data: {
      id: makeId('audit'),
      title,
      detail,
      createdAt: referenceDate,
    },
  });
}

async function getState(prisma, session = null) {
  const referenceDate = getTodayIso();
  await updateInvoiceStatuses(prisma, referenceDate);

  const [
    owner,
    property,
    settlementAccount,
    rooms,
    roomMeters,
    tenants,
    tenancies,
    contracts,
    invoices,
    meterReadings,
    paymentSubmissions,
    reminders,
    auditTrail,
  ] = await Promise.all([
    prisma.owner.findFirst(),
    prisma.property.findFirst(),
    prisma.settlementAccount.findFirst(),
    prisma.room.findMany({
      orderBy: [{ label: 'asc' }],
    }),
    prisma.roomMeter.findMany({
      orderBy: [{ roomId: 'asc' }],
    }),
    prisma.tenant.findMany({
      orderBy: [{ fullName: 'asc' }],
    }),
    prisma.tenancy.findMany({
      orderBy: [{ id: 'asc' }],
    }),
    prisma.contract.findMany({
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.invoice.findMany({
      orderBy: [{ month: 'desc' }, { generatedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.meterReading.findMany({
      orderBy: [{ month: 'desc' }, { capturedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.paymentSubmission.findMany({
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
    }),
    prisma.reminder.findMany({
      orderBy: [{ triggerDate: 'asc' }, { channel: 'asc' }, { id: 'asc' }],
    }),
    prisma.auditTrail.findMany({
      select: {
        id: true,
        title: true,
        detail: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    }),
  ]);

  if (session?.role === 'tenant') {
    const currentTenantId = session.currentTenantId;
    const visibleTenancyIds = tenancies
      .filter((tenancy) => tenancy.tenantId === currentTenantId)
      .map((tenancy) => tenancy.id);
    const visibleRoomIds = tenancies
      .filter((tenancy) => tenancy.tenantId === currentTenantId)
      .map((tenancy) => tenancy.roomId);
    const visibleContractIds = tenancies
      .filter((tenancy) => tenancy.tenantId === currentTenantId)
      .map((tenancy) => tenancy.contractId)
      .filter(Boolean);

    return {
      referenceDate,
      session,
      owner: owner
        ? {
            id: owner.id,
            name: owner.name,
          }
        : null,
      property,
      settlementAccount,
      rooms: rooms.filter((room) => visibleRoomIds.includes(room.id)),
      roomMeters: roomMeters.filter((meter) => visibleRoomIds.includes(meter.roomId)),
      tenants: tenants.filter((tenant) => tenant.id === currentTenantId),
      tenancies: tenancies.filter((tenancy) => tenancy.tenantId === currentTenantId),
      contracts: applyInlineContractImages(
        contracts.filter((contract) => visibleContractIds.includes(contract.id)),
      ),
      invoices: invoices.filter((invoice) => invoice.tenantId === currentTenantId),
      meterReadings: applyInlineUploadAccess(
        meterReadings.filter(
          (reading) =>
            reading.tenantId === currentTenantId || visibleTenancyIds.includes(reading.tenancyId),
        ),
        'photoLabel',
      ),
      paymentSubmissions: applyInlineUploadAccess(
        paymentSubmissions.filter((submission) => submission.tenantId === currentTenantId),
        'screenshotLabel',
      ),
      reminders: reminders.filter((reminder) => reminder.tenantId === currentTenantId),
      auditTrail: [],
    };
  }

  return {
    referenceDate,
    session: session || emptySession,
    owner,
    property,
    settlementAccount,
    rooms,
    roomMeters,
    tenants,
    tenancies,
    contracts: applyInlineContractImages(contracts),
    invoices,
    meterReadings: applyInlineUploadAccess(meterReadings, 'photoLabel'),
    paymentSubmissions: applyInlineUploadAccess(paymentSubmissions, 'screenshotLabel'),
    reminders,
    auditTrail,
  };
}

function createRentBackend(options = {}) {
  const prisma = options.prisma || createPrismaClient();
  const readyPromise = options.skipSeed ? Promise.resolve() : seedDatabase(prisma);

  async function run(task) {
    await readyPromise;
    return task();
  }

  return {
    prisma,

    ready() {
      return readyPromise;
    },

    async close() {
      await prisma.$disconnect();
    },

    async getState(session = null) {
      return run(() => getState(prisma, session));
    },

    async getSessionForAccessToken(accessToken) {
      return run(async () => {
        const payload = verifyToken(accessToken);

        if (payload.typ !== 'access') {
          throw new Error('Invalid access token.');
        }

        const session = await prisma.authSession.findUnique({
          where: { id: payload.sid },
        });

        if (!session || session.revokedAt) {
          throw new Error('Your session is no longer active.');
        }

        if (new Date(session.sessionExpiresAt).getTime() <= Date.now()) {
          throw new Error('Your session has expired. Please log in again.');
        }

        return payload.role === 'owner'
          ? {
              role: 'owner',
              phone: payload.phone,
              currentTenantId: null,
              currentOwnerId: payload.ownerId || session.ownerId || null,
            }
          : {
              role: 'tenant',
              phone: payload.phone,
              currentTenantId: payload.tenantId || session.tenantId || null,
              currentOwnerId: null,
            };
      });
    },

    async requestOtp({ role, phone }, requestMeta = {}) {
      return run(async () => {
        const rateKey = buildOtpRateKey(role, phone, requestMeta.ipAddress);
        const maskedPhone = String(phone || '').replace(/\D+/g, '').slice(-4);
        console.log('[auth] requestOtp received', {
          role,
          phoneSuffix: maskedPhone ? `***${maskedPhone}` : '[empty]',
          hasIpAddress: Boolean(requestMeta.ipAddress),
        });
        takeRateLimitedSlot(otpRequestTracker, rateKey, {
          windowMs: OTP_REQUEST_WINDOW_MS,
          maxAttempts: OTP_REQUEST_MAX_ATTEMPTS,
          cooldownMs: OTP_REQUEST_COOLDOWN_MS,
        });

        try {
          await findAuthIdentity(prisma, role, phone);
          console.log('[auth] identity lookup passed', {
            role,
            phoneSuffix: maskedPhone ? `***${maskedPhone}` : '[empty]',
          });
          await startPhoneVerification(phone);
          console.log('[auth] otp request completed', {
            role,
            phoneSuffix: maskedPhone ? `***${maskedPhone}` : '[empty]',
          });
        } catch (_error) {
          console.log('[auth] otp request failed', {
            role,
            phoneSuffix: maskedPhone ? `***${maskedPhone}` : '[empty]',
            message: _error?.message || String(_error),
            status: _error?.status || null,
            code: _error?.code || null,
            moreInfo: _error?.moreInfo || null,
          });
          return {
            ok: true,
            status: 'pending',
          };
        }

        return {
          ok: true,
          status: 'pending',
        };
      });
    },

    async verifyOtp({ role, phone, code }, requestMeta = {}) {
      return run(async () => {
        const rateKey = buildOtpRateKey(role, phone, requestMeta.ipAddress);
        takeRateLimitedSlot(otpVerifyTracker, rateKey, {
          windowMs: OTP_VERIFY_WINDOW_MS,
          maxAttempts: OTP_VERIFY_MAX_ATTEMPTS,
        });

        let identity;
        let verification;

        try {
          identity = await findAuthIdentity(prisma, role, phone);
          verification = await checkPhoneVerification(phone, code);
        } catch (_error) {
          throw new Error('The OTP is invalid or has expired.');
        }

        if (verification.status !== 'approved') {
          throw new Error('The OTP is invalid or has expired.');
        }

        const now = new Date();
        const session = createSessionRecord({
          id: makeId('session'),
          role: identity.role,
          phone: identity.phone,
          ownerId: identity.ownerId,
          tenantId: identity.tenantId,
          now,
        });
        const tokens = buildSessionTokens(session);

        await prisma.authSession.create({
          data: {
            ...session,
            refreshTokenHash: hashToken(tokens.refreshToken),
          },
        });

        const state = await getState(prisma);

        return {
          tokens,
          state: await getState(prisma, toSession(identity.role, identity.phone, state)),
        };
      });
    },

    async refreshAuth({ refreshToken }) {
      return run(async () => {
        const payload = verifyToken(refreshToken);

        if (payload.typ !== 'refresh') {
          throw new Error('Invalid refresh token.');
        }

        const session = await prisma.authSession.findUnique({
          where: { id: payload.sid },
        });

        if (!session || session.revokedAt) {
          throw new Error('Your session is no longer active.');
        }

        if (session.refreshTokenHash !== hashToken(refreshToken)) {
          throw new Error('This refresh token is no longer valid.');
        }

        const now = new Date();

        if (new Date(session.refreshExpiresAt).getTime() <= now.getTime()) {
          throw new Error('Your refresh token has expired. Please log in again.');
        }

        if (new Date(session.sessionExpiresAt).getTime() <= now.getTime()) {
          throw new Error('Your session has expired. Please log in again.');
        }

        const nextRefreshExpiresAt = capRefreshExpiry(now, session.sessionExpiresAt);
        const nextSession = {
          ...session,
          refreshExpiresAt: toIso(nextRefreshExpiresAt),
          updatedAt: toIso(now),
          lastUsedAt: toIso(now),
        };
        const tokens = buildSessionTokens(nextSession);

        await prisma.authSession.update({
          where: { id: session.id },
          data: {
            refreshTokenHash: hashToken(tokens.refreshToken),
            refreshExpiresAt: nextSession.refreshExpiresAt,
            updatedAt: nextSession.updatedAt,
            lastUsedAt: nextSession.lastUsedAt,
          },
        });

        const state = await getState(prisma);

        return {
          tokens,
          state: await getState(prisma, toSession(payload.role, payload.phone, state)),
        };
      });
    },

    async logout({ refreshToken }) {
      return run(async () => {
        if (!refreshToken) {
          return { ok: true };
        }

        const payload = verifyToken(refreshToken);

        if (payload.typ !== 'refresh') {
          throw new Error('Invalid refresh token.');
        }

        const session = await prisma.authSession.findUnique({
          where: { id: payload.sid },
        });

        if (!session) {
          return { ok: true };
        }

        await prisma.authSession.update({
          where: { id: session.id },
          data: {
            revokedAt: toIso(new Date()),
            updatedAt: toIso(new Date()),
          },
        });

        return { ok: true };
      });
    },

    async updateProperty(payload, session) {
      return run(async () => {
        requireOwnerSession(session);
        const property = requireRecord(await prisma.property.findFirst(), 'Property not found.');
        const nextProperty = { ...property, ...payload };

        await prisma.property.update({
          where: { id: property.id },
          data: {
            name: nextProperty.name,
            address: nextProperty.address,
            defaultTariff: Number(nextProperty.defaultTariff),
            managerName: nextProperty.managerName,
            managerPhone: nextProperty.managerPhone,
          },
        });

        await recordAudit(prisma, 'Property updated', `Updated property details for ${nextProperty.name}.`);
        return getState(prisma, session);
      });
    },

    async updateSettlement(payload, session) {
      return run(async () => {
        requireOwnerSession(session);
        const settlement = requireRecord(
          await prisma.settlementAccount.findFirst(),
          'Settlement account not found.',
        );
        const nextSettlement = { ...settlement, ...payload };

        await prisma.settlementAccount.update({
          where: { id: settlement.id },
          data: {
            payeeName: nextSettlement.payeeName,
            upiId: nextSettlement.upiId,
            instructions: nextSettlement.instructions,
          },
        });

        await recordAudit(prisma, 'Settlement updated', 'Updated owner UPI settlement details.');
        return getState(prisma, session);
      });
    },

    async addRoom(input, session) {
      return run(async () => {
        requireOwnerSession(session);
        const property = requireRecord(await prisma.property.findFirst(), 'Property not found.');

        if (!input.label || !input.floor || !input.serialNumber) {
          throw new Error('Room label, floor, and meter serial number are required.');
        }

        const duplicateRoom = await prisma.room.findFirst({
          where: {
            propertyId: property.id,
            label: input.label,
          },
          select: { id: true },
        });

        if (duplicateRoom) {
          throw new Error('A room with this label already exists.');
        }

        const roomId = makeId('room');
        const meterId = makeId('meter');

        await prisma.$transaction(async (tx) => {
          await tx.room.create({
            data: {
              id: roomId,
              propertyId: property.id,
              label: input.label,
              floor: input.floor,
              meterId,
              status: ROOM_STATUS.VACANT,
            },
          });

          await tx.roomMeter.create({
            data: {
              id: meterId,
              propertyId: property.id,
              roomId,
              serialNumber: input.serialNumber,
              lastReading: Number(input.openingReading || 0),
            },
          });

          await recordAudit(tx, 'Room added', `Room ${input.label} was added to the inventory.`);
        });

        return getState(prisma, session);
      });
    },

    async inviteTenant(input, session) {
      return run(async () => {
        requireOwnerSession(session);
        if (!input.fullName || !input.phone || !input.roomId) {
          throw new Error('Tenant name, phone, and room selection are required.');
        }

        const room = requireRecord(
          await prisma.room.findUnique({ where: { id: input.roomId } }),
          'Room not found.',
        );

        if (room.status !== ROOM_STATUS.VACANT) {
          throw new Error('Only vacant rooms can be assigned to a new tenant invite.');
        }

        const duplicateTenant = await prisma.tenant.findUnique({
          where: { phone: input.phone },
          select: { id: true },
        });

        if (duplicateTenant) {
          throw new Error('That phone number is already associated with another tenant.');
        }

        const property = requireRecord(await prisma.property.findFirst(), 'Property not found.');
        const { tenant, tenancy } = createTenantInvite({
          propertyId: property.id,
          roomId: input.roomId,
          fullName: input.fullName,
          phone: input.phone,
        });

        await prisma.$transaction(async (tx) => {
          await tx.tenant.create({
            data: tenant,
          });

          await tx.tenancy.create({
            data: {
              ...tenancy,
              tenantId: tenant.id,
            },
          });

          await tx.room.update({
            where: { id: room.id },
            data: { status: ROOM_STATUS.NOTICE },
          });

          await recordAudit(tx, 'Tenant invited', `${input.fullName} was invited to room ${room.label}.`);
        });

        return getState(prisma, session);
      });
    },

    async completeTenantProfile(tenantId, input, session) {
      return run(async () => {
        requireTenantAccess(session, tenantId);
        const tenant = requireRecord(
          await prisma.tenant.findUnique({ where: { id: tenantId } }),
          'Unable to find the tenant profile.',
        );
        const nextTenant = { ...tenant, ...input };
        nextTenant.profileStatus = isTenantProfileComplete(nextTenant) ? 'COMPLETE' : 'PENDING';

        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            fullName: nextTenant.fullName,
            email: nextTenant.email,
            emergencyContact: nextTenant.emergencyContact,
            idDocument: nextTenant.idDocument,
            notes: nextTenant.notes,
            profileStatus: nextTenant.profileStatus,
          },
        });

        await recordAudit(prisma, 'Tenant profile updated', `Profile details were saved for ${nextTenant.fullName}.`);
        return getState(prisma, session);
      });
    },

    async activateTenancy(tenancyId, contractInput, session) {
      return run(async () => {
        requireOwnerSession(session);
        const tenancy = requireRecord(
          await prisma.tenancy.findUnique({ where: { id: tenancyId } }),
          'Tenancy not found.',
        );

        if (tenancy.status !== TENANCY_STATUS.INVITED) {
          throw new Error('Only invited tenancies can be activated.');
        }

        requireRecord(
          await prisma.tenant.findUnique({ where: { id: tenancy.tenantId } }),
          'Unable to find the tenant profile.',
        );

        const conflictingTenancy = await prisma.tenancy.findFirst({
          where: {
            roomId: tenancy.roomId,
            id: { not: tenancy.id },
            status: {
              in: [TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED],
            },
          },
          select: { id: true },
        });

        if (conflictingTenancy) {
          throw new Error('This room already has another active tenancy.');
        }

        if (!Array.isArray(contractInput.contractUploads) || !contractInput.contractUploads.length) {
          throw new Error('At least one agreement image is required before move-in.');
        }

        const imageLabels = contractInput.contractUploads.map((upload, index) =>
          saveImageUpload(`agreement-${index + 1}`, upload),
        );

        const { contract, tenancyPatch } = buildContractRecord({
          tenancyId,
          contractInput: {
            ...contractInput,
            imageLabels,
          },
        });

        await prisma.$transaction(async (tx) => {
          await tx.contract.create({
            data: contract,
          });

          await tx.tenancy.update({
            where: { id: tenancyId },
            data: {
              status: tenancyPatch.status,
              contractId: contract.id,
              rentAmount: tenancyPatch.rentAmount,
              depositAmount: tenancyPatch.depositAmount,
              dueDay: tenancyPatch.dueDay,
              moveInDate: tenancyPatch.moveInDate,
              contractStart: tenancyPatch.contractStart,
              contractEnd: tenancyPatch.contractEnd,
              moveOutDate: null,
            },
          });

          await tx.room.update({
            where: { id: tenancy.roomId },
            data: { status: ROOM_STATUS.OCCUPIED },
          });

          await recordAudit(
            tx,
            'Tenancy activated',
            `${imageLabels.length} agreement image${imageLabels.length === 1 ? '' : 's'} were attached and the stay was activated.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async generateInvoice(input, session) {
      return run(async () => {
        requireOwnerSession(session);
        const tenancy = requireRecord(
          await prisma.tenancy.findUnique({ where: { id: input.tenancyId } }),
          'Select an active tenancy before generating an invoice.',
        );

        if (![TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(tenancy.status)) {
          throw new Error('Only active or moving-out tenancies can be billed.');
        }

        if (!input.month) {
          throw new Error('Billing month is required.');
        }

        const pendingReading = await prisma.meterReading.findFirst({
          where: {
            tenancyId: tenancy.id,
            month: input.month,
            status: METER_READING_STATUS.PENDING_REVIEW,
          },
          select: { id: true },
        });

        if (pendingReading) {
          throw new Error('You must review the submitted meter reading before creating a manual invoice.');
        }

        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            tenancyId: tenancy.id,
            month: input.month,
          },
          select: { id: true },
        });

        if (existingInvoice) {
          throw new Error('An invoice for that tenancy and month already exists.');
        }

        const [property, room, settlementAccount, meter] = await Promise.all([
          prisma.property.findFirst(),
          prisma.room.findUnique({ where: { id: tenancy.roomId } }),
          prisma.settlementAccount.findFirst(),
          prisma.roomMeter.findUnique({ where: { roomId: tenancy.roomId } }),
        ]);

        const resolvedProperty = requireRecord(property, 'Property not found.');
        const resolvedRoom = requireRecord(room, 'Room not found.');
        const resolvedSettlement = requireRecord(settlementAccount, 'Settlement account not found.');
        const resolvedMeter = requireRecord(meter, 'Room meter not found.');

        const bundle = createInvoiceForTenancy({
          tenancy,
          room: resolvedRoom,
          settlementAccount: resolvedSettlement,
          month: input.month,
          openingReading: input.openingReading,
          closingReading: input.closingReading,
          tariff: input.tariff || resolvedProperty.defaultTariff,
          referenceDate: getTodayIso(),
        });

        await prisma.$transaction(async (tx) => {
          await tx.invoice.create({
            data: {
              ...bundle.invoice,
              paymentSubmissionId: null,
              paidAt: null,
            },
          });

          await tx.meterReading.create({
            data: bundle.meterReading,
          });

          await tx.reminder.createMany({
            data: bundle.reminders.map((reminder) => ({
              ...reminder,
              lastAttemptAt: reminder.lastAttemptAt || null,
            })),
          });

          await tx.roomMeter.update({
            where: { id: resolvedMeter.id },
            data: {
              lastReading: bundle.meterReading.closingReading,
            },
          });

          await recordAudit(
            tx,
            'Invoice generated',
            `Invoice ${bundle.invoice.month} was generated for room ${resolvedRoom.label}.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async submitMeterReading(input, session) {
      return run(async () => {
        const tenancy = requireRecord(
          await prisma.tenancy.findUnique({ where: { id: input.tenancyId } }),
          'Choose an active stay before submitting a meter reading.',
        );
        requireTenancyAccess(session, tenancy);

        if (![TENANCY_STATUS.ACTIVE, TENANCY_STATUS.MOVE_OUT_SCHEDULED].includes(tenancy.status)) {
          throw new Error('Only active or moving-out stays can submit a meter reading.');
        }

        const month = input.month || getTodayIso().slice(0, 7);
        const [property, room, meter, settlementAccount] = await Promise.all([
          prisma.property.findFirst(),
          prisma.room.findUnique({ where: { id: tenancy.roomId } }),
          prisma.roomMeter.findUnique({ where: { roomId: tenancy.roomId } }),
          prisma.settlementAccount.findFirst(),
        ]);

        const resolvedProperty = requireRecord(property, 'Property not found.');
        const resolvedRoom = requireRecord(room, 'Room not found.');
        const resolvedMeter = requireRecord(meter, 'Room meter not found.');
        const resolvedSettlement = requireRecord(settlementAccount, 'Settlement account not found.');

        if (!input.photoUpload?.dataUrl) {
          throw new Error('Meter photo is required before submitting.');
        }

        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            tenancyId: tenancy.id,
            month,
          },
          select: { id: true },
        });

        if (existingInvoice) {
          throw new Error('This month already has a submitted bill.');
        }

        const existingReading = await prisma.meterReading.findFirst({
          where: {
            tenancyId: tenancy.id,
            month,
          },
          select: { id: true },
        });

        if (existingReading) {
          throw new Error('This month already has a meter reading on record.');
        }

        const uploadedMeterPhoto = saveImageUpload('meter', input.photoUpload);
        const bundle = createInvoiceForTenancy({
          tenancy,
          room: resolvedRoom,
          settlementAccount: resolvedSettlement,
          month,
          openingReading: resolvedMeter.lastReading,
          closingReading: Number(input.closingReading),
          tariff: resolvedProperty.defaultTariff,
          photoLabel: uploadedMeterPhoto,
          status: METER_READING_STATUS.PENDING_REVIEW,
          capturedByRole: 'TENANT',
          reviewedAt: null,
          referenceDate: getTodayIso(),
        });

        await prisma.$transaction(async (tx) => {
          await tx.invoice.create({
            data: {
              ...bundle.invoice,
              paymentSubmissionId: null,
              paidAt: null,
            },
          });

          await tx.meterReading.create({
            data: bundle.meterReading,
          });

          await tx.reminder.createMany({
            data: bundle.reminders.map((reminder) => ({
              ...reminder,
              lastAttemptAt: reminder.lastAttemptAt || null,
            })),
          });

          await recordAudit(
            tx,
            'Meter reading submitted',
            `Tenant submitted the ${month} reading and the bill was created for room ${resolvedRoom.label}.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async reviewMeterReading(input, session) {
      return run(async () => {
        requireOwnerSession(session);
        const reading = requireRecord(
          await prisma.meterReading.findUnique({ where: { id: input.meterReadingId } }),
          'Choose a meter reading waiting for review.',
        );

        if (reading.status !== METER_READING_STATUS.PENDING_REVIEW) {
          throw new Error('Only pending meter readings can be reviewed.');
        }

        const [tenancy, room, settlementAccount, meter] = await Promise.all([
          prisma.tenancy.findUnique({ where: { id: reading.tenancyId } }),
          prisma.room.findUnique({ where: { id: reading.roomId } }),
          prisma.settlementAccount.findFirst(),
          prisma.roomMeter.findUnique({ where: { id: reading.meterId } }),
        ]);

        const resolvedTenancy = requireRecord(tenancy, 'Tenancy not found.');
        const resolvedRoom = requireRecord(room, 'Room not found.');
        const resolvedSettlement = requireRecord(settlementAccount, 'Settlement account not found.');
        const resolvedMeter = requireRecord(meter, 'Room meter not found.');
        const reviewedAt = getTodayIso();
        const approved = input.decision === 'APPROVE';

        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            tenancyId: resolvedTenancy.id,
            month: reading.month,
          },
          select: { id: true },
        });

        if (approved && existingInvoice) {
          throw new Error('This month already has a generated invoice.');
        }

        await prisma.$transaction(async (tx) => {
          if (!approved) {
            await tx.meterReading.update({
              where: { id: reading.id },
              data: {
                status: METER_READING_STATUS.REJECTED,
                reviewedAt,
                reviewerNote: input.reviewerNote || '',
              },
            });

            await recordAudit(
              tx,
              'Meter reading rejected',
              `Reading ${reading.id} for ${reading.month} was rejected.`,
              reviewedAt,
            );
            return;
          }

          const bundle = createInvoiceForTenancy({
            tenancy: resolvedTenancy,
            room: resolvedRoom,
            settlementAccount: resolvedSettlement,
            month: reading.month,
            openingReading: reading.openingReading,
            closingReading: reading.closingReading,
            tariff: reading.tariff,
            photoLabel: reading.photoLabel || '',
            capturedByRole: reading.capturedByRole || 'TENANT',
            reviewedAt,
            reviewerNote: input.reviewerNote || '',
            referenceDate: reviewedAt,
          });

          await tx.invoice.create({
            data: {
              ...bundle.invoice,
              paymentSubmissionId: null,
              paidAt: null,
            },
          });

          await tx.meterReading.update({
            where: { id: reading.id },
            data: {
              invoiceId: bundle.invoice.id,
              status: METER_READING_STATUS.APPROVED,
              reviewedAt,
              reviewerNote: input.reviewerNote || '',
            },
          });

          await tx.reminder.createMany({
            data: bundle.reminders.map((reminder) => ({
              ...reminder,
              lastAttemptAt: reminder.lastAttemptAt || null,
            })),
          });

          await tx.roomMeter.update({
            where: { id: resolvedMeter.id },
            data: {
              lastReading: reading.closingReading,
            },
          });

          await recordAudit(
            tx,
            'Meter reading approved',
            `Reading ${reading.month} for room ${resolvedRoom.label} was approved and billed.`,
            reviewedAt,
          );
        });

        return getState(prisma, session);
      });
    },

    async submitPayment(input, session) {
      return run(async () => {
        const invoice = requireRecord(
          await prisma.invoice.findUnique({ where: { id: input.invoiceId } }),
          'Choose an invoice before submitting a payment proof.',
        );
        requireInvoiceAccess(session, invoice);

        if (!input.utr || !input.proofUpload?.dataUrl) {
          throw new Error('UTR/reference and payment proof are required.');
        }

        if (invoice.status === INVOICE_STATUS.PAID) {
          throw new Error('This invoice is already approved and paid.');
        }

        if (invoice.status === INVOICE_STATUS.PAYMENT_SUBMITTED) {
          throw new Error('A final review is already pending for this invoice.');
        }

        const submissionId = makeId('submission');
        const uploadedPaymentProof = saveImageUpload('payment-proof', input.proofUpload);

        await prisma.$transaction(async (tx) => {
          await tx.paymentSubmission.create({
            data: {
              id: submissionId,
              invoiceId: invoice.id,
              tenantId: invoice.tenantId,
              status: PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW,
              utr: input.utr,
              screenshotLabel: uploadedPaymentProof,
              note: input.note || '',
              submittedAt: getTodayIso(),
              reviewedAt: null,
              reviewerNote: '',
            },
          });

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: INVOICE_STATUS.PAYMENT_SUBMITTED,
              paymentSubmissionId: submissionId,
              paidAt: null,
            },
          });

          await recordAudit(
            tx,
            'Payment submitted',
            `Payment proof was submitted for invoice ${invoice.month}.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async reviewPayment(input, session) {
      return run(async () => {
        requireOwnerSession(session);
        const submission = requireRecord(
          await prisma.paymentSubmission.findUnique({ where: { id: input.submissionId } }),
          'Pick a payment submission that is still waiting for review.',
        );

        if (submission.status !== PAYMENT_SUBMISSION_STATUS.PENDING_REVIEW) {
          throw new Error('Pick a payment submission that is still waiting for review.');
        }

        const invoice = requireRecord(
          await prisma.invoice.findUnique({ where: { id: submission.invoiceId } }),
          'Invoice not found.',
        );
        const meterReading = await prisma.meterReading.findFirst({
          where: { invoiceId: invoice.id },
        });
        const approved = input.decision === 'APPROVE';

        await prisma.$transaction(async (tx) => {
          const reviewedAt = getTodayIso();

          await tx.paymentSubmission.update({
            where: { id: submission.id },
            data: {
              status: approved
                ? PAYMENT_SUBMISSION_STATUS.APPROVED
                : PAYMENT_SUBMISSION_STATUS.REJECTED,
              reviewedAt,
              reviewerNote: input.reviewerNote || '',
            },
          });

          const nextStatus = approved
            ? INVOICE_STATUS.PAID
            : deriveInvoiceStatus({ ...invoice, status: INVOICE_STATUS.ISSUED }, reviewedAt);

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: nextStatus,
              paidAt: approved ? reviewedAt : null,
            },
          });

          if (approved) {
            if (meterReading) {
              await tx.meterReading.update({
                where: { id: meterReading.id },
                data: {
                  status: METER_READING_STATUS.APPROVED,
                  reviewedAt,
                  reviewerNote: input.reviewerNote || '',
                },
              });

              await tx.roomMeter.update({
                where: { id: meterReading.meterId },
                data: {
                  lastReading: meterReading.closingReading,
                },
              });
            }

            const reminders = await tx.reminder.findMany({
              where: { invoiceId: invoice.id },
            });
            const canceledReminders = cancelInvoiceReminders(reminders, invoice.id);

            for (const reminder of canceledReminders) {
              await tx.reminder.update({
                where: { id: reminder.id },
                data: {
                  deliveryStatus: reminder.deliveryStatus,
                  lastAttemptAt: reminder.lastAttemptAt,
                },
              });
            }
          }

          await recordAudit(
            tx,
            approved ? 'Payment approved' : 'Payment rejected',
            `Submission ${submission.id} for invoice ${invoice.month} was ${approved ? 'approved' : 'rejected'}.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async updateReminderStatus(reminderId, deliveryStatus, session) {
      return run(async () => {
        requireOwnerSession(session);
        const reminder = requireRecord(
          await prisma.reminder.findUnique({ where: { id: reminderId } }),
          'Reminder not found.',
        );

        await prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            deliveryStatus,
            lastAttemptAt: getTodayIso(),
          },
        });

        return getState(prisma, session);
      });
    },

    async scheduleMoveOut(tenancyId, moveOutDate, session) {
      return run(async () => {
        requireOwnerSession(session);
        const tenancy = requireRecord(
          await prisma.tenancy.findUnique({ where: { id: tenancyId } }),
          'Tenancy not found.',
        );

        if (tenancy.status !== TENANCY_STATUS.ACTIVE) {
          throw new Error('Only active tenancies can be moved out.');
        }

        await prisma.$transaction(async (tx) => {
          await tx.tenancy.update({
            where: { id: tenancy.id },
            data: {
              status: TENANCY_STATUS.MOVE_OUT_SCHEDULED,
              moveOutDate,
            },
          });

          await tx.room.update({
            where: { id: tenancy.roomId },
            data: {
              status: ROOM_STATUS.NOTICE,
            },
          });

          await recordAudit(
            tx,
            'Move-out scheduled',
            `Tenancy ${tenancy.id} is scheduled to move out on ${moveOutDate}.`,
          );
        });

        return getState(prisma, session);
      });
    },

    async closeTenancy(tenancyId, session) {
      return run(async () => {
        requireOwnerSession(session);
        const tenancy = requireRecord(
          await prisma.tenancy.findUnique({ where: { id: tenancyId } }),
          'Tenancy not found.',
        );

        if (tenancy.status !== TENANCY_STATUS.MOVE_OUT_SCHEDULED) {
          throw new Error('Schedule a move-out before closing the tenancy.');
        }

        const invoices = await prisma.invoice.findMany({
          where: {
            tenancyId: tenancy.id,
          },
        });
        const hasOpenInvoice = invoices.some(
          (invoice) => deriveInvoiceStatus(invoice, getTodayIso()) !== INVOICE_STATUS.PAID,
        );

        if (hasOpenInvoice) {
          throw new Error('Collect or review the latest invoice before closing this tenancy.');
        }

        await prisma.$transaction(async (tx) => {
          await tx.tenancy.update({
            where: { id: tenancy.id },
            data: {
              status: TENANCY_STATUS.CLOSED,
            },
          });

          await tx.room.update({
            where: { id: tenancy.roomId },
            data: {
              status: ROOM_STATUS.VACANT,
            },
          });

          await recordAudit(
            tx,
            'Tenancy closed',
            `Tenancy ${tenancy.id} was closed and the room marked vacant.`,
          );
        });

        return getState(prisma, session);
      });
    },
  };
}

module.exports = {
  createRentBackend,
  emptySession,
  getState,
  isClientError,
};
