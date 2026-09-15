// Atualiza a logo de todos os tenants que nao tem logo
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.clienteTenant.updateMany({
    where: { OR: [{ logoUrl: null }, { logoUrl: '' }] },
    data: { logoUrl: '/logos/logo_rezende_quadrada.png' }
  });
  console.log(`[logo] ${result.count} cliente(s) atualizado(s) com a logo.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
