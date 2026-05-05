const { createSeedState } = require('../src/data/seed');
const { hashPassword } = require('./password');

async function seedDatabase(prisma) {
  const existingOwner = await prisma.owner.findFirst({
    select: { id: true },
  });

  if (existingOwner) {
    const existingSuperAdmin = await prisma.superAdmin.findFirst({ select: { id: true } });
    if (!existingSuperAdmin) {
      const seed = createSeedState();
      const superAdminHash = await hashPassword(seed.seedPasswords.superAdmin);
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

  const seed = createSeedState();

  const [superAdminHash, ownerHash, tenant1Hash, tenant2Hash] = await Promise.all([
    hashPassword(seed.seedPasswords.superAdmin),
    hashPassword(seed.seedPasswords.owner),
    hashPassword(seed.seedPasswords.tenants['tenant-1']),
    hashPassword(seed.seedPasswords.tenants['tenant-2']),
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
