const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany();
  console.log("Users:", JSON.stringify(users, null, 2));
  
  const tickets = await prisma.ticket.findMany({
    include: { client: true, aiProposal: true }
  });
  console.log("Latest Tickets:", JSON.stringify(tickets.slice(-2), null, 2));

  await prisma.$disconnect();
}

check();
