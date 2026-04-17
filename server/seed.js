const { createSeedState } = require('../src/data/seed');

async function seedDatabase(prisma) {
  const existingOwner = await prisma.owner.findFirst({
    select: { id: true },
  });

  if (existingOwner) {
    return;
  }

  const seed = createSeedState();

  await prisma.$transaction(async (tx) => {
    await tx.owner.create({
      data: seed.owner,
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
      data: seed.tenants,
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
