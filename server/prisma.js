const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

let cachedClient = null;

function createPrismaClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required before starting the Prisma backend.');
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  cachedClient = new PrismaClient({ adapter });
  return cachedClient;
}

module.exports = {
  createPrismaClient,
};
