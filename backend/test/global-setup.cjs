const { copyFileSync, existsSync } = require('fs');
const { join } = require('path');

module.exports = async function globalSetup() {
  const prismaDir = join(__dirname, '..', 'prisma');
  const devDb = join(prismaDir, 'dev.db');
  const testDb = join(prismaDir, 'test.db');

  if (!existsSync(devDb)) {
    throw new Error('prisma/dev.db is missing. Run npx prisma db push from backend first.');
  }

  copyFileSync(devDb, testDb);
};
