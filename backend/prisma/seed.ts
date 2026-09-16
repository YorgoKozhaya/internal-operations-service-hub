import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/prisma/seed-database';

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
