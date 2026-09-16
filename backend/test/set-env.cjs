const { join } = require('path');

process.env.DATABASE_URL = `file:${join(__dirname, '..', 'prisma', 'test.db').replace(/\\/g, '/')}`;
