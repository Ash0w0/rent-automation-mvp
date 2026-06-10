const { createSeedState } = require('../src/data/seed');
const { generateTempPassword, hashPassword } = require('./password');

// Demo credentials live server-side only — never bundled into the client app.
const DEV_DEFAULT_PASSWORD = 'changeme';

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// Demo rooms/tenants/invoices are seeded in development by default, and in
// production only when explicitly requested via SEED_DEMO_DATA=true.
function isDemoSeedEnabled() {
  if (process.env.SEED_DEMO_DATA === 'true') {
    return true;
  }
  if (process.env.SEED_DEMO_DATA === 'false') {
    return false;
  }
  return !isProduction();
}

function resolveSuperAdminPassword() {
  if (process.env.SUPER_ADMIN_PASSWORD) {
    return process.env.SUPER_ADMIN_PASSWORD;
  }

  if (!isProduction()) {
    return DEV_DEFAULT_PASSWORD;
  }

  // Never bootstrap production with a well-known default. Generate a one-time
  // password and surface it in the deploy logs instead.
  const generated = generateTempPassword(14);
  console.warn(
    `[seed] SUPER_ADMIN_PASSWORD is not set — generated a one-time super admin password: ${generated}`,
  );
  console.warn('[seed] Log in with it and change it immediately, or set SUPER_ADMIN_PASSWORD before first deploy.');
  return generated;
}

async function seedDatabase(prisma) {
  const existingOwner = await prisma.owner.findFirst({
    select: { id: true },
  });

  const existingSuperAdmin = await prisma.superAdmin.findFirst({ select: { id: true } });

  if (existingOwner) {
    if (!existingSuperAdmin) {
      const seed = createSeedState();
      const superAdminHash = await hashPassword(resolveSuperAdminPassword());
      await prisma.superAdmin.create({
        data: {
          ...seed.superAdmin,
          passwordHash: superAdminHash,
          mustChangePassword: true,
        },
      });
    }
    return;
  }

  if (existingSuperAdmin) {
    return;
  }

  if (!isDemoSeedEnabled()) {
    // Production bootstrap: create only the super admin, no demo data.
    const seed = createSeedState();
    const superAdminHash = await hashPassword(resolveSuperAdminPassword());
    await prisma.superAdmin.create({
      data: {
        ...seed.superAdmin,
        passwordHash: superAdminHash,
        mustChangePassword: true,
      },
    });
    return;
  }

  const seed = createSeedState();

  const [superAdminHash, ownerHash, tenant1Hash, tenant2Hash] = await Promise.all([
    hashPassword(resolveSuperAdminPassword()),
    hashPassword(DEV_DEFAULT_PASSWORD),
    hashPassword(DEV_DEFAULT_PASSWORD),
    hashPassword(DEV_DEFAULT_PASSWORD),
  ]);

  const tenantsWithPasswords = seed.tenants.map((tenant) => ({
    ...tenant,
    passwordHash:
      tenant.id === 'tenant-1' ? tenant1Hash : tenant.id === 'tenant-2' ? tenant2Hash : null,
    mustChangePassword: true,
    invitedAt: seed.referenceDate,
    invitedByOwnerId: seed.owner.id,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.superAdmin.create({
      data: {
        ...seed.superAdmin,
        passwordHash: superAdminHash,
        mustChangePassword: true,
      },
    });

    await tx.owner.create({
      data: {
        ...seed.owner,
        passwordHash: ownerHash,
        mustChangePassword: true,
        invitedAt: seed.referenceDate,
        invitedBySuperAdminId: seed.superAdmin.id,
      },
    });

    await tx.property.create({
      data: seed.property,
    });

    await tx.settlementAccount.create({
      data: seed.settlementAccount,
    });

    await tx.room.createMany({
      data: seed.rooms,
    });

    await tx.roomMeter.createMany({
      data: seed.roomMeters,
    });

    await tx.tenant.createMany({
      data: tenantsWithPasswords,
    });

    await tx.tenancy.createMany({
      data: seed.tenancies,
    });

    await tx.contract.createMany({
      data: seed.contracts,
    });

    await tx.invoice.createMany({
      data: seed.invoices.map((invoice) => ({
        ...invoice,
        paymentSubmissionId: invoice.paymentSubmissionId || null,
        paidAt: invoice.paidAt || null,
      })),
    });

    await tx.meterReading.createMany({
      data: seed.meterReadings,
    });

    await tx.paymentSubmission.createMany({
      data: seed.paymentSubmissions.map((submission) => ({
        ...submission,
        reviewedAt: submission.reviewedAt || null,
        reviewerNote: submission.reviewerNote || '',
      })),
    });

    await tx.reminder.createMany({
      data: seed.reminders.map((reminder) => ({
        ...reminder,
        lastAttemptAt: reminder.lastAttemptAt || null,
      })),
    });

    await tx.auditTrail.createMany({
      data: seed.auditTrail.map((entry) => ({
        ...entry,
        createdAt: seed.referenceDate,
      })),
    });
  });
}

module.exports = {
  seedDatabase,
};
