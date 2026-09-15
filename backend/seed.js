const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const LOGO_PADRAO = '/logos/logo_rezende_quadrada.png';

async function main() {
  const existe = await prisma.clienteTenant.findUnique({ where: { cnpj: '00000000000100' } });
  if (!existe) {
    const senhaHash = await bcrypt.hash('1234', 10);
    await prisma.clienteTenant.create({
      data: {
        nomeAcougue: 'Acougue Teste',
        cnpj: '00000000000100',
        nomeResponsavel: 'Joao Silva',
        telefone: '(44) 99999-0000',
        senha: senhaHash,
        statusPagamento: 'ATIVO',
        diaVencimento: 10,
        valorMensal: 299.90,
        logoUrl: LOGO_PADRAO,
        dbConnectionString: 'file:./tenant_teste.db',
      }
    });
    console.log('[seed] Cliente criado: CNPJ 00.000.000/0001-00 / senha 1234');
  } else {
    // Atualiza logoUrl se não tiver
    if (!existe.logoUrl) {
      await prisma.clienteTenant.update({
        where: { cnpj: '00000000000100' },
        data: { logoUrl: LOGO_PADRAO }
      });
      console.log('[seed] Logo padrão definida para o cliente de teste.');
    } else {
      console.log('[seed] Cliente de teste ja existe.');
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
