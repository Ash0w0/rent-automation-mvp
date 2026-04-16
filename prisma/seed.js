require('dotenv/config');

const { createPrismaClient } = require('../server/prisma');
const { seedDatabase } = require('../server/seed');

async function main() {
  const prisma = createPrismaClient();

  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
