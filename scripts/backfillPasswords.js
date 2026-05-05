#!/usr/bin/env node
/*
 * Sets a random passwordHash and mustChangePassword=true on any existing Owner/Tenant
 * rows that have no passwordHash. After running this, those users must reset their
 * password via the appropriate flow (super-admin → owner, owner → tenant, or
 * forgot-password OTP for owners/super-admins) before they can log in.
 */
const crypto = require('node:crypto');
const { hashPassword } = require('../server/password');
const { createPrismaClient } = require('../server/prisma');

async function main() {
  const prisma = createPrismaClient();

  const [owners, tenants] = await Promise.all([
    prisma.owner.findMany({ where: { passwordHash: null }, select: { id: true } }),
    prisma.tenant.findMany({ where: { passwordHash: null }, select: { id: true } }),
  ]);

  console.log(`Backfilling ${owners.length} owners and ${tenants.length} tenants.`);

  for (const owner of owners) {
    const hash = await hashPassword(crypto.randomBytes(16).toString('hex'));
    await prisma.owner.update({
      where: { id: owner.id },
      data: { passwordHash: hash, mustChangePassword: true },
    });
  }

  for (const tenant of tenants) {
    const hash = await hashPassword(crypto.randomBytes(16).toString('hex'));
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { passwordHash: hash, mustChangePassword: true },
    });
  }

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
