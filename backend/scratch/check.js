const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'admin@agency.com' }
  });

  if (!user) {
    console.log('User admin@agency.com not found in database');
    return;
  }

  console.log('User found in database:', user.email);
  console.log('Password hash:', user.passwordHash);

  if (!user.passwordHash) {
    console.log('No password hash set for this user');
    return;
  }

  const candidates = ['123456', 'admin1234', 'admin123', 'Ahmed@20302030'];
  for (const pass of candidates) {
    const match = await bcrypt.compare(pass, user.passwordHash);
    console.log(`Password: "${pass}" -> ${match ? 'MATCH' : 'NO MATCH'}`);
  }
}

check()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
