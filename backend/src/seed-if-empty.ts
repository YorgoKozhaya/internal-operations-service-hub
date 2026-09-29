import { PrismaClient } from '@prisma/client';
import { loadEnv } from './load-env';
import { seedDatabase } from './prisma/seed-database';

loadEnv();

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = await prisma.user.count();

  if (users > 0) {
    console.log(`Database already has ${users} users. Leaving stored requests in place.`);
    return;
  }

  await seedDatabase(prisma);
  console.log('Seeded demo departments, people, and requests.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
