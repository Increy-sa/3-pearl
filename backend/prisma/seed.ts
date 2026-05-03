import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin1234', 10);

  await prisma.user.upsert({
    where: { email: 'admin@agency.com' },
    update: {
      name: 'مدير النظام',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
    create: {
      email: 'admin@agency.com',
      name: 'مدير النظام',
      role: 'ADMIN',
      isActive: true,
      passwordHash,
    },
  });

  console.log('Admin user seeded: admin@agency.com');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    throw error;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
