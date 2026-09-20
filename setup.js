// setup.js — executado pelo iniciar.bat a cada inicialização
// - Sempre sobrescreve schema.prisma, controller e routes (garante atualização automática)
// - Só cria o .env se ainda não existir (preserva configurações do cliente)
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const root   = __dirname;

fs.mkdirSync(path.join(root, 'backend', 'prisma'),             { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'backups'),            { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'public', 'logos'),    { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'src', 'controllers'), { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'src', 'routes'),      { recursive: true });

// ── .env: só cria se não existir ─────────────────────────────
const envPath = path.join(root, 'backend', '.env');
if (!fs.existsSync(envPath)) {
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const refreshSecret = crypto.randomBytes(32).toString('hex');
  const superAdminSecret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(envPath,
`DATABASE_URL="file:./prisma/acougue_admin.db"
PORT=3000
JWT_SECRET=${jwtSecret}
REFRESH_SECRET=${refreshSecret}
SUPER_ADMIN_SECRET=${superAdminSecret}
`);
  console.log('[setup] .env criado com chaves criptograficas seguras.');
} else {
  console.log('[setup] .env ja existe - mantido.');
}

// ── schema.prisma: sempre sobrescreve ────────────────────────
const schema = `generator client {
  provider   = "prisma-client-js"
  engineType = "library"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model ClienteTenant {
  id                 String            @id @default(uuid())
  nomeAcougue        String
  cnpj               String            @unique
  nomeResponsavel    String
  telefone           String
  senha              String            @default("1234")
  statusPagamento    String            @default("ATIVO")
  diaVencimento      Int
  valorMensal        Float
  logoUrl            String?
  dbConnectionString String            @unique
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  produtos           Produto[]
  estoques           Estoque[]
  caixas             Caixa[]
  caixaOperacoes     CaixaOperacao[]
  comandas           Comanda[]
  fornecedores       Fornecedor[]
  precosFornecedor   PrecoFornecedor[]
  historicosPreco    HistoricoPreco[]
  contasPagar        ContaPagar[]
  sessoesAssado      SessaoAssados[]
  desossaTemplates   DesossaTemplate[]
}

model Produto {
  id           Int               @id @default(autoincrement())
  nome         String
  precoVenda   Float
  precoPromocao Float?
  custo        Float             @default(0)
  estoqueAtual Float             @default(0)
  unidade      String            @default("KG")
  categoria    String            @default("Bovino")
  ativo        Boolean           @default(true)
  validade     DateTime?
  codigoBarras String?
  tenantId     String
  tenant       ClienteTenant     @relation(fields: [tenantId], references: [id])
  itensComanda ItemComanda[]
  precos       PrecoFornecedor[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
}

model Estoque {
  id        Int           @id @default(autoincrement())
  nomeCorte String
  pesoKg    Float         @default(0)
  validade  DateTime?
  tenantId  String
  tenant    ClienteTenant @relation(fields: [tenantId], references: [id])
  updatedAt DateTime      @updatedAt

  @@unique([nomeCorte, tenantId])
}

model Caixa {
  id             Int           @id @default(autoincrement())
  data           DateTime
  valorTotal     Float
  itensJson      String
  formaPagamento String        @default("DINHEIRO")
  valorPago      Float         @default(0)
  troco          Float         @default(0)
  cancelado      Boolean       @default(false)
  canceladoEm    DateTime?
  tenantId       String
  tenant         ClienteTenant @relation(fields: [tenantId], references: [id])
  createdAt      DateTime      @default(now())
  pagamentosJson String?
}

model CaixaOperacao {
  id         Int           @id @default(autoincrement())
  tipo       String
  valor      Float
  observacao String        @default("")
  data       DateTime
  tenantId   String
  tenant     ClienteTenant @relation(fields: [tenantId], references: [id])
  createdAt  DateTime      @default(now())
}

model Comanda {
  id          Int           @id @default(autoincrement())
  nomeCliente String
  numeroMesa  Int
  status      String        @default("ABERTA")
  total       Float         @default(0)
  tenantId    String
  tenant      ClienteTenant @relation(fields: [tenantId], references: [id])
  itens       ItemComanda[]
  criadaEm    DateTime      @default(now())
  fechadaEm   DateTime?
}

model ItemComanda {
  id        Int      @id @default(autoincrement())
  comandaId Int
  comanda   Comanda  @relation(fields: [comandaId], references: [id])
  produtoId Int
  produto   Produto  @relation(fields: [produtoId], references: [id])
  nome      String
  precoKg   Float
  pesoKg    Float
  total     Float
  criadoEm  DateTime @default(now())
}

model Fornecedor {
  id             Int               @id @default(autoincrement())
  nome           String
  cnpj           String?
  vendedor       String?
  telefone       String?
  prazoPagamento String?
  observacoes    String?
  ativo          Boolean           @default(true)
  tenantId       String
  tenant         ClienteTenant     @relation(fields: [tenantId], references: [id])
  precos         PrecoFornecedor[]
  contasPagar    ContaPagar[]
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
}

model PrecoFornecedor {
  id            Int              @id @default(autoincrement())
  fornecedorId  Int
  fornecedor    Fornecedor       @relation(fields: [fornecedorId], references: [id], onDelete: Cascade)
  produtoId     Int
  produto       Produto          @relation(fields: [produtoId], references: [id], onDelete: Cascade)
  unidade       String           @default("KG")
  precoAtual    Float
  precoAnterior Float?
  tenantId      String
  tenant        ClienteTenant    @relation(fields: [tenantId], references: [id])
  historico     HistoricoPreco[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@unique([fornecedorId, produtoId])
}

model HistoricoPreco {
  id                Int             @id @default(autoincrement())
  precoFornecedorId Int
  precoFornecedor   PrecoFornecedor @relation(fields: [precoFornecedorId], references: [id], onDelete: Cascade)
  preco             Float
  data              DateTime        @default(now())
  tenantId          String
  tenant            ClienteTenant   @relation(fields: [tenantId], references: [id])
}

model ContaPagar {
  id             Int           @id @default(autoincrement())
  tenantId       String
  tenant         ClienteTenant @relation(fields: [tenantId], references: [id])
  fornecedorId   Int?
  fornecedor     Fornecedor?   @relation(fields: [fornecedorId], references: [id])
  descricao      String
  valor          Float
  categoria      String        @default("Outros")
  dataEmissao    DateTime      @default(now())
  dataVencimento DateTime
  dataPagamento  DateTime?
  formaPagamento String?
  status         String        @default("PENDENTE")
  observacoes    String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

model SessaoAssados {
  id            Int                   @id @default(autoincrement())
  tenantId      String
  tenant        ClienteTenant         @relation(fields: [tenantId], references: [id])
  status        String                @default("ABERTA")
  abertoEm      DateTime              @default(now())
  fechadoEm     DateTime?
  totalAssados  Float                 @default(0)
  totalNormal   Float                 @default(0)
  produtos      ProdutoAssado[]
  comandas      ComandaAssado[]
  vendasDiretas VendaDiretaAssado[]
}

model ProdutoAssado {
  id              Int           @id @default(autoincrement())
  sessaoId        Int
  sessao          SessaoAssados @relation(fields: [sessaoId], references: [id], onDelete: Cascade)
  produtoOrigemId Int?
  tenantId        String
  nome            String
  preco           Float         @default(0)
  unidade         String        @default("UN")
  estoqueInicial  Float         @default(0)
  estoqueAtual    Float         @default(0)
  codigoBarras    String?
  emoji           String?
  criadoEm        DateTime      @default(now())
}

model ComandaAssado {
  id             Int                 @id @default(autoincrement())
  sessaoId       Int
  sessao         SessaoAssados       @relation(fields: [sessaoId], references: [id], onDelete: Cascade)
  tenantId       String
  nomeCliente    String
  telefone       String?
  pago           Boolean             @default(false)
  status         String              @default("RESERVADO")
  total          Float               @default(0)
  totalAssados   Float               @default(0)
  totalNormal    Float               @default(0)
  observacoes    String?
  formaPagamento String?
  entregueEm     DateTime?
  criadaEm       DateTime            @default(now())
  itens          ItemComandaAssado[]
}

model ItemComandaAssado {
  id              Int           @id @default(autoincrement())
  comandaId       Int
  comanda         ComandaAssado @relation(fields: [comandaId], references: [id], onDelete: Cascade)
  produtoAssadoId Int?
  produtoNormalId Int?
  nome            String
  preco           Float         @default(0)
  quantidade      Float         @default(1)
  pesoKg          Float?
  unidade         String        @default("UN")
  total           Float         @default(0)
  tipo            String        @default("ASSADO")
}

model VendaDiretaAssado {
  id             Int           @id @default(autoincrement())
  sessaoId       Int
  sessao         SessaoAssados @relation(fields: [sessaoId], references: [id], onDelete: Cascade)
  tenantId       String
  itensJson      String        @default("[]")
  totalAssados   Float         @default(0)
  totalNormal    Float         @default(0)
  total          Float         @default(0)
  formaPagamento String        @default("DINHEIRO")
  valorPago      Float         @default(0)
  criadoEm       DateTime      @default(now())
}

model DesossaTemplate {
  id           Int                    @id @default(autoincrement())
  tenantId     String
  tenant       ClienteTenant          @relation(fields: [tenantId], references: [id])
  nome         String
  pesoEntrada  Float                  @default(0)
  custoKg      Float                  @default(0)
  vezes        Int                    @default(0)
  ultimaVez    DateTime?
  cortes       DesossaCorteTemplate[]

  @@unique([nome, tenantId])
}

model DesossaCorteTemplate {
  id           Int             @id @default(autoincrement())
  templateId   Int
  template     DesossaTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  nomeCorte    String
  pesoKg       Float           @default(0)
  precoVendaKg Float           @default(0)
  validade     DateTime?
}
`;
fs.writeFileSync(path.join(root, 'backend', 'prisma', 'schema.prisma'), schema);
console.log('[setup] schema.prisma atualizado (v16 - Pagamentos e Correcoes).');

// ── contasPagarController.js ──────────────────────────────────
const controller = `const { PrismaClient } = require('@prisma/client');
const { getTenantId, toFloat, toInt } = require('../lib/validate');
const prisma = new PrismaClient();

function calcularStatus(conta) {
  if (conta.status === 'PAGO' || conta.status === 'CANCELADO') return conta.status;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(conta.dataVencimento); venc.setHours(0, 0, 0, 0);
  return venc < hoje ? 'VENCIDO' : 'PENDENTE';
}

exports.listar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { fornecedorId, categoria } = req.query;
    const where = { tenantId, status: { not: 'CANCELADO' } };
    if (fornecedorId) where.fornecedorId = toInt(fornecedorId);
    if (categoria)    where.categoria    = categoria;
    const contas = await prisma.contaPagar.findMany({
      where,
      include: { fornecedor: { select: { id: true, nome: true, telefone: true } } },
      orderBy: { dataVencimento: 'asc' },
    });
    res.json(contas.map(c => ({ ...c, status: calcularStatus(c) })));
  } catch (e) {
    console.error('[contas:listar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.resumo = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const em7dias = new Date(hoje); em7dias.setDate(em7dias.getDate() + 7);
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes    = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);
    const todas = await prisma.contaPagar.findMany({ where: { tenantId, status: { not: 'CANCELADO' } } });
    let totalPendente = 0, totalVencido = 0, totalPagoMes = 0, totalAVencer7 = 0, qtdVencidas = 0, qtdAVencer7 = 0;
    for (const c of todas) {
      const status = calcularStatus(c);
      const venc   = new Date(c.dataVencimento);
      if (status === 'PAGO') {
        const pg = new Date(c.dataPagamento);
        if (pg >= inicioMes && pg <= fimMes) totalPagoMes += c.valor;
      } else if (status === 'VENCIDO') {
        totalVencido += c.valor; qtdVencidas++;
      } else {
        totalPendente += c.valor;
        if (venc >= hoje && venc <= em7dias) { totalAVencer7 += c.valor; qtdAVencer7++; }
      }
    }
    res.json({ totalPendente, totalVencido, totalPagoMes, totalAVencer7, qtdVencidas, qtdAVencer7 });
  } catch (e) {
    console.error('[contas:resumo]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.criar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { fornecedorId, descricao, valor, categoria, dataEmissao, dataVencimento, observacoes } = req.body;
    if (!descricao && !descricao.trim()) return res.status(400).json({ erro: 'Descricao obrigatoria.' });
    if (!dataVencimento) return res.status(400).json({ erro: 'Data de vencimento obrigatoria.' });
    const valorNum = toFloat(valor);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ erro: 'Valor invalido.' });
    const conta = await prisma.contaPagar.create({
      data: {
        tenantId,
        fornecedorId: fornecedorId ? toInt(fornecedorId) : null,
        descricao: descricao.trim(),
        valor: valorNum,
        categoria: categoria || 'Outros',
        dataEmissao:    dataEmissao    ? new Date(dataEmissao)    : new Date(),
        dataVencimento: new Date(dataVencimento),
        observacoes: observacoes || null,
        status: 'PENDENTE',
      },
      include: { fornecedor: { select: { id: true, nome: true } } },
    });
    res.json({ ...conta, status: calcularStatus(conta) });
  } catch (e) {
    console.error('[contas:criar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { fornecedorId, descricao, valor, categoria, dataEmissao, dataVencimento, observacoes } = req.body;
    const valorNum = toFloat(valor);
    await prisma.contaPagar.updateMany({
      where: { id, tenantId },
      data: {
        ...(fornecedorId !== undefined && { fornecedorId: fornecedorId ? toInt(fornecedorId) : null }),
        ...(descricao    && { descricao: descricao.trim() }),
        ...(valorNum && valorNum > 0 && { valor: valorNum }),
        ...(categoria    && { categoria }),
        ...(dataEmissao  && { dataEmissao: new Date(dataEmissao) }),
        ...(dataVencimento && { dataVencimento: new Date(dataVencimento) }),
        ...(observacoes !== undefined && { observacoes }),
      },
    });
    const conta = await prisma.contaPagar.findFirst({
      where: { id, tenantId },
      include: { fornecedor: { select: { id: true, nome: true } } },
    });
    res.json({ ...conta, status: calcularStatus(conta) });
  } catch (e) {
    console.error('[contas:atualizar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.pagar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { dataPagamento, formaPagamento } = req.body;
    if (!formaPagamento) return res.status(400).json({ erro: 'Forma de pagamento obrigatoria.' });
    await prisma.contaPagar.updateMany({
      where: { id, tenantId },
      data: {
        status: 'PAGO',
        dataPagamento:  dataPagamento ? new Date(dataPagamento) : new Date(),
        formaPagamento: formaPagamento.trim(),
      },
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[contas:pagar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    await prisma.contaPagar.updateMany({ where: { id, tenantId }, data: { status: 'CANCELADO' } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[contas:cancelar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};
`;
fs.writeFileSync(
  path.join(root, 'backend', 'src', 'controllers', 'contasPagarController.js'),
  controller
);
console.log('[setup] contasPagarController.js atualizado.');

// ── contasPagarRoutes.js ──────────────────────────────────────
const routes = `const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/contasPagarController');

router.use(auth);
router.get('/',            ctrl.listar);
router.get('/resumo',      ctrl.resumo);
router.post('/',           ctrl.criar);
router.patch('/:id',       ctrl.atualizar);
router.patch('/:id/pagar', ctrl.pagar);
router.delete('/:id',      ctrl.cancelar);

module.exports = router;
`;
fs.writeFileSync(
  path.join(root, 'backend', 'src', 'routes', 'contasPagarRoutes.js'),
  routes
);
console.log('[setup] contasPagarRoutes.js atualizado.');
