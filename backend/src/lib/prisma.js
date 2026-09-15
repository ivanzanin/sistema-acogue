const { PrismaClient } = require('@prisma/client');

if (!global.__prisma) {
  global.__prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error'] : [],
  });
}

module.exports = global.__prisma;
