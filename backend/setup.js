// setup.js — executado pelo iniciar.bat a cada inicialização
// - Sempre sobrescreve schema.prisma, controller e routes (garante atualização automática)
// - Só cria o .env se ainda não existir (preserva configurações do cliente)
const fs   = require('fs');
const path = require('path');
const root = __dirname;

fs.mkdirSync(path.join(root, 'backend', 'prisma'),             { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'backups'),            { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'public', 'logos'),    { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'src', 'controllers'), { recursive: true });
fs.mkdirSync(path.join(root, 'backend', 'src', 'routes'),      { recursive: true });

// ── .env: só cria se não existir ─────────────────────────────
const envPath = path.join(root, 'backend', '.env');
if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath,
`DATABASE_URL="file:./prisma/acougue_admin.db"
PORT=3000
JWT_SECRET=acougue_super_secret_2024
REFRESH_SECRET=acougue_refresh_secret_2024
SUPER_ADMIN_SECRET=superadmin_dono_saas_2024
`);
  console.log('[setup] .env criado.');
} else {
  console.log('[setup] .env ja existe - mantido.');
}

// ── schema.prisma: sempre sobrescreve ────────────────────────
const schema = `generator client {
  provider = "prisma-client-js"
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
  sessoesAssados     SessaoAssados[]
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
  id            Int                 @id @default(autoincrement())
  tenantId      String
  tenant        ClienteTenant       @relation(fields: [tenantId], references: [id])
  status        String              @default("ABERTA")
  totalAssados  Float               @default(0)
  totalNormal   Float               @default(0)
  abertoEm      DateTime            @default(now())
  fechadoEm     DateTime?
  produtos      ProdutoAssado[]
  comandas      ComandaAssado[]
  vendasDiretas VendaDiretaAssado[]
}

model ProdutoAssado {
  id             Int           @id @default(autoincrement())
  sessaoId       Int
  sessao         SessaoAssados @relation(fields: [sessaoId], references: [id])
  tenantId       String
  nome           String
  preco          Float
  unidade        String        @default("UN")
  estoqueInicial Float         @default(0)
  estoqueAtual   Float         @default(0)
  codigoBarras   String?
  emoji          String?       @default("🔥")
}

model ComandaAssado {
  id             Int                @id @default(autoincrement())
  sessaoId       Int
  sessao         SessaoAssados      @relation(fields: [sessaoId], references: [id])
  tenantId       String
  nomeCliente    String
  telefone       String?
  status         String             @default("RESERVADO")
  pago           Boolean            @default(false)
  formaPagamento String?
  total          Float              @default(0)
  observacoes    String?
  itens          ItemComandaAssado[]
  criadaEm       DateTime           @default(now())
  entregueEm     DateTime?
}

model ItemComandaAssado {
  id              Int           @id @default(autoincrement())
  comandaId       Int
  comanda         ComandaAssado @relation(fields: [comandaId], references: [id])
  produtoAssadoId Int?
  produtoNormalId Int?
  nome            String
  preco           Float
  quantidade      Float
  unidade         String        @default("UN")
  total           Float
  tipo            String        @default("ASSADO")
}

model VendaDiretaAssado {
  id             Int           @id @default(autoincrement())
  sessaoId       Int
  sessao         SessaoAssados @relation(fields: [sessaoId], references: [id])
  tenantId       String
  itensJson      String
  totalAssados   Float         @default(0)
  totalNormal    Float         @default(0)
  total          Float         @default(0)
  formaPagamento String        @default("DINHEIRO")
  valorPago      Float         @default(0)
  criadaEm       DateTime      @default(now())
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

// ── assadosController.js ────────────────────────────────────
const assadosController = `const prisma = require('../lib/prisma');
const { getTenantId, toFloat, toInt } = require('../lib/validate');

// ── Sessão ────────────────────────────────────────────────────

exports.sessaoAtiva = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({
      where: { tenantId, status: 'ABERTA' },
      include: {
        produtos: { orderBy: { nome: 'asc' } },
        comandas: {
          where: { status: { not: 'ENTREGUE' } },
          include: { itens: true },
          orderBy: { criadaEm: 'asc' },
        },
        vendasDiretas: true,
      },
    });
    const entregues = sessao ? await prisma.comandaAssado.findMany({
      where: { sessaoId: sessao.id, status: 'ENTREGUE' },
      include: { itens: true },
      orderBy: { entregueEm: 'desc' },
    }) : [];
    res.json({ sessao, entregues });
  } catch (e) {
    console.error('[assados:sessaoAtiva]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.abrirSessao = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const aberta = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (aberta) return res.status(400).json({ erro: 'Ja existe uma sessao aberta.' });
    const sessao = await prisma.sessaoAssados.create({ data: { tenantId } });
    res.json(sessao);
  } catch (e) {
    console.error('[assados:abrirSessao]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.fecharSessao = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { lancarNoCaixa, transferirEstoque } = req.body;
    const sessao = await prisma.sessaoAssados.findFirst({
      where: { tenantId, status: 'ABERTA' },
      include: { produtos: true, vendasDiretas: true, comandas: { include: { itens: true } } },
    });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });

    // Calcula totais
    const totalAssados = sessao.vendasDiretas.reduce((s, v) => s + v.totalAssados, 0)
      + sessao.comandas.filter(c => c.pago).reduce((s, c) => s + c.total, 0);
    const totalNormal = sessao.vendasDiretas.reduce((s, v) => s + v.totalNormal, 0);

    // Lança no caixa principal se solicitado
    if (lancarNoCaixa && totalAssados > 0) {
      await prisma.caixaOperacao.create({
        data: {
          tenantId,
          tipo: 'ENTRADA',
          valor: totalAssados,
          observacao: \`Assados - Sessao #\${sessao.id}\`,
          data: new Date(),
        },
      });
    }

    // Transfere estoque sobrando para estoque principal
    if (transferirEstoque) {
      for (const p of sessao.produtos) {
        if (p.estoqueAtual > 0 && p.unidade === 'KG') {
          await prisma.estoque.upsert({
            where: { nomeCorte_tenantId: { nomeCorte: p.nome, tenantId } },
            update: { pesoKg: { increment: p.estoqueAtual } },
            create: { nomeCorte: p.nome, pesoKg: p.estoqueAtual, tenantId },
          });
        } else if (p.estoqueAtual > 0 && p.unidade === 'UN') {
          const prod = await prisma.produto.findFirst({ where: { tenantId, nome: p.nome, ativo: true } });
          if (prod) {
            await prisma.produto.update({ where: { id: prod.id }, data: { estoqueAtual: { increment: p.estoqueAtual } } });
          }
        }
      }
    }

    await prisma.sessaoAssados.update({
      where: { id: sessao.id },
      data: { status: 'FECHADA', fechadoEm: new Date(), totalAssados, totalNormal },
    });

    res.json({ ok: true, totalAssados, totalNormal });
  } catch (e) {
    console.error('[assados:fecharSessao]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Produtos ──────────────────────────────────────────────────

exports.adicionarProduto = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });
    const { nome, preco, unidade, estoqueInicial, codigoBarras, emoji } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatorio.' });
    const valorNum = toFloat(preco);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ erro: 'Preco invalido.' });
    const estoque = toFloat(estoqueInicial) || 0;
    const produto = await prisma.produtoAssado.create({
      data: {
        sessaoId: sessao.id, tenantId,
        nome: nome.trim(), preco: valorNum,
        unidade: unidade || 'UN',
        estoqueInicial: estoque, estoqueAtual: estoque,
        codigoBarras: codigoBarras || null,
        emoji: emoji || '🔥',
      },
    });
    res.json(produto);
  } catch (e) {
    console.error('[assados:adicionarProduto]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizarProduto = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { nome, preco, unidade, estoqueAtual, codigoBarras, emoji } = req.body;
    const p = await prisma.produtoAssado.findFirst({ where: { id, tenantId } });
    if (!p) return res.status(404).json({ erro: 'Produto nao encontrado.' });
    const updated = await prisma.produtoAssado.update({
      where: { id },
      data: {
        ...(nome        && { nome: nome.trim() }),
        ...(preco       && { preco: toFloat(preco) }),
        ...(unidade     && { unidade }),
        ...(estoqueAtual !== undefined && { estoqueAtual: toFloat(estoqueAtual) || 0 }),
        ...(codigoBarras !== undefined && { codigoBarras: codigoBarras || null }),
        ...(emoji       && { emoji }),
      },
    });
    res.json(updated);
  } catch (e) {
    console.error('[assados:atualizarProduto]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.removerProduto = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    await prisma.produtoAssado.deleteMany({ where: { id, tenantId } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[assados:removerProduto]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Comandas / Reservas ───────────────────────────────────────

exports.criarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });
    const { nomeCliente, telefone, pago, observacoes, itens } = req.body;
    if (!nomeCliente?.trim()) return res.status(400).json({ erro: 'Nome do cliente obrigatorio.' });

    let total = 0;
    const itensData = [];

    if (itens?.length) {
      for (const item of itens) {
        const produto = await prisma.produtoAssado.findFirst({ where: { id: toInt(item.produtoId), tenantId } });
        if (!produto) continue;
        const qtd = toFloat(item.quantidade) || 1;
        const itemTotal = produto.preco * qtd;
        total += itemTotal;
        // Desconta do estoque do produto assado
        await prisma.produtoAssado.update({
          where: { id: produto.id },
          data: { estoqueAtual: Math.max(0, produto.estoqueAtual - qtd) },
        });
        itensData.push({
          produtoAssadoId: produto.id,
          nome: produto.nome,
          preco: produto.preco,
          quantidade: qtd,
          unidade: produto.unidade,
          total: itemTotal,
          tipo: 'ASSADO',
        });
      }
    }

    const comanda = await prisma.comandaAssado.create({
      data: {
        sessaoId: sessao.id, tenantId,
        nomeCliente: nomeCliente.trim(),
        telefone: telefone || null,
        pago: !!pago,
        status: pago ? 'PAGO' : 'RESERVADO',
        total,
        observacoes: observacoes || null,
        itens: { create: itensData },
      },
      include: { itens: true },
    });

    res.json(comanda);
  } catch (e) {
    console.error('[assados:criarComanda]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.adicionarItemComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const comandaId = toInt(req.params.id);
    const { produtoId, quantidade } = req.body;

    const comanda = await prisma.comandaAssado.findFirst({ where: { id: comandaId, tenantId } });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada.' });

    const produto = await prisma.produtoAssado.findFirst({ where: { id: toInt(produtoId), tenantId } });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    const qtd = toFloat(quantidade) || 1;
    const itemTotal = produto.preco * qtd;

    await prisma.produtoAssado.update({
      where: { id: produto.id },
      data: { estoqueAtual: Math.max(0, produto.estoqueAtual - qtd) },
    });

    await prisma.itemComandaAssado.create({
      data: {
        comandaId, produtoAssadoId: produto.id,
        nome: produto.nome, preco: produto.preco,
        quantidade: qtd, unidade: produto.unidade,
        total: itemTotal, tipo: 'ASSADO',
      },
    });

    await prisma.comandaAssado.update({
      where: { id: comandaId },
      data: { total: { increment: itemTotal } },
    });

    const updated = await prisma.comandaAssado.findFirst({ where: { id: comandaId }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:adicionarItem]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.removerItemComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const itemId = toInt(req.params.itemId);
    const item = await prisma.itemComandaAssado.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ erro: 'Item nao encontrado.' });

    // Estorna estoque
    if (item.produtoAssadoId) {
      await prisma.produtoAssado.updateMany({
        where: { id: item.produtoAssadoId, tenantId },
        data: { estoqueAtual: { increment: item.quantidade } },
      });
    }

    await prisma.comandaAssado.update({
      where: { id: item.comandaId },
      data: { total: { decrement: item.total } },
    });

    await prisma.itemComandaAssado.delete({ where: { id: itemId } });
    const updated = await prisma.comandaAssado.findFirst({ where: { id: item.comandaId }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:removerItem]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.pagarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { formaPagamento } = req.body;
    await prisma.comandaAssado.updateMany({
      where: { id, tenantId },
      data: { pago: true, status: 'PAGO', formaPagamento: formaPagamento || 'DINHEIRO' },
    });
    const updated = await prisma.comandaAssado.findFirst({ where: { id }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:pagarComanda]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.entregarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    await prisma.comandaAssado.updateMany({
      where: { id, tenantId },
      data: { status: 'ENTREGUE', entregueEm: new Date() },
    });
    const updated = await prisma.comandaAssado.findFirst({ where: { id }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:entregarComanda]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Venda Direta (frente de caixa) ───────────────────────────

exports.buscarProdutoScan = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { codigo } = req.params;
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });

    // 1) Busca nos produtos assados da sessão
    if (sessao) {
      const prodAssado = await prisma.produtoAssado.findFirst({
        where: { sessaoId: sessao.id, tenantId, codigoBarras: codigo },
      });
      if (prodAssado) return res.json({ tipo: 'ASSADO', produto: prodAssado });
    }

    // 2) Busca no sistema principal (igual ao produtoController)
    let prodNormal = await prisma.produto.findFirst({ where: { codigoBarras: codigo, tenantId, ativo: true } });
    if (!prodNormal && /^2\\d{12}$/.test(codigo)) {
      const codCurto = parseInt(codigo.substring(1, 7), 10).toString();
      const variacoes = [codCurto, codigo.substring(1, 7)];
      prodNormal = await prisma.produto.findFirst({ where: { tenantId, ativo: true, codigoBarras: { in: variacoes } } });
      if (prodNormal) {
        const valorReal = parseInt(codigo.substring(7, 12), 10) / 100;
        const pesoCalculado = prodNormal.precoVenda > 0 ? +(valorReal / prodNormal.precoVenda).toFixed(3) : null;
        return res.json({ tipo: 'NORMAL', produto: prodNormal, balancaInfo: { valorTotal: valorReal, pesoCalculado } });
      }
    }
    if (prodNormal) return res.json({ tipo: 'NORMAL', produto: prodNormal });

    res.status(404).json({ erro: 'Produto nao encontrado.' });
  } catch (e) {
    console.error('[assados:buscarScan]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.vendaDireta = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });

    const { itens, formaPagamento, valorPago } = req.body;
    if (!itens?.length) return res.status(400).json({ erro: 'Nenhum item na venda.' });

    let totalAssados = 0;
    let totalNormal  = 0;
    const itensNormais = [];

    for (const item of itens) {
      if (item.tipo === 'ASSADO') {
        totalAssados += item.total;
        // Desconta do estoque de assados
        if (item.produtoAssadoId) {
          const p = await prisma.produtoAssado.findFirst({ where: { id: item.produtoAssadoId, tenantId } });
          if (p) {
            await prisma.produtoAssado.update({
              where: { id: p.id },
              data: { estoqueAtual: Math.max(0, p.estoqueAtual - item.quantidade) },
            });
          }
        }
      } else {
        totalNormal += item.total;
        itensNormais.push(item);
        // Desconta do estoque normal
        if (item.produtoNormalId) {
          const p = await prisma.produto.findFirst({ where: { id: item.produtoNormalId, tenantId, ativo: true } });
          if (p) {
            const novoEstoque = Math.max(0, p.estoqueAtual - item.quantidade);
            await prisma.produto.update({ where: { id: p.id }, data: { estoqueAtual: novoEstoque } });
            if (p.unidade === 'KG') {
              await prisma.estoque.upsert({
                where: { nomeCorte_tenantId: { nomeCorte: p.nome, tenantId } },
                update: { pesoKg: novoEstoque },
                create: { nomeCorte: p.nome, pesoKg: novoEstoque, tenantId },
              });
            }
          }
        }
      }
    }

    // Registra venda direta no módulo assados
    await prisma.vendaDiretaAssado.create({
      data: {
        sessaoId: sessao.id, tenantId,
        itensJson: JSON.stringify(itens),
        totalAssados, totalNormal,
        total: totalAssados + totalNormal,
        formaPagamento: formaPagamento || 'DINHEIRO',
        valorPago: toFloat(valorPago) || totalAssados + totalNormal,
      },
    });

    // Lança itens normais no caixa principal
    if (totalNormal > 0) {
      await prisma.caixa.create({
        data: {
          tenantId, data: new Date(),
          valorTotal: totalNormal,
          itensJson: JSON.stringify(itensNormais),
          formaPagamento: formaPagamento || 'DINHEIRO',
          valorPago: toFloat(valorPago) || totalNormal,
          troco: 0,
        },
      });
    }

    res.json({ ok: true, totalAssados, totalNormal });
  } catch (e) {
    console.error('[assados:vendaDireta]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Resumo financeiro da sessão ───────────────────────────────

exports.resumoSessao = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({
      where: { tenantId, status: 'ABERTA' },
      include: {
        vendasDiretas: true,
        comandas: { where: { pago: true } },
        produtos: true,
      },
    });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });

    const totalVendasDiretas = sessao.vendasDiretas.reduce((s, v) => s + v.totalAssados, 0);
    const totalComandas = sessao.comandas.reduce((s, c) => s + c.total, 0);
    const totalGeral = totalVendasDiretas + totalComandas;
    const totalNormal = sessao.vendasDiretas.reduce((s, v) => s + v.totalNormal, 0);

    const estoqueRestante = sessao.produtos
      .filter(p => p.estoqueAtual > 0)
      .map(p => ({ nome: p.nome, quantidade: p.estoqueAtual, unidade: p.unidade, emoji: p.emoji }));

    res.json({ totalAssados: totalGeral, totalNormal, estoqueRestante, qtdVendas: sessao.vendasDiretas.length + sessao.comandas.length });
  } catch (e) {
    console.error('[assados:resumo]', e.message);
    res.status(500).json({ erro: e.message });
  }
};
`;
fs.writeFileSync(
  path.join(root, 'backend', 'src', 'controllers', 'assadosController.js'),
  assadosController
);
console.log('[setup] assadosController.js atualizado.');

// ── assadosRoutes.js ─────────────────────────────────────────
const assadosRoutes = `const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/assadosController');

router.use(auth);

// Sessão
router.get('/sessao-ativa',     ctrl.sessaoAtiva);
router.post('/abrir',           ctrl.abrirSessao);
router.post('/fechar',          ctrl.fecharSessao);
router.get('/resumo',           ctrl.resumoSessao);

// Produtos da sessão
router.post('/produtos',        ctrl.adicionarProduto);
router.patch('/produtos/:id',   ctrl.atualizarProduto);
router.delete('/produtos/:id',  ctrl.removerProduto);

// Reservas / Comandas
router.post('/comandas',               ctrl.criarComanda);
router.post('/comandas/:id/itens',     ctrl.adicionarItemComanda);
router.delete('/comandas/:id/itens/:itemId', ctrl.removerItemComanda);
router.patch('/comandas/:id/pagar',    ctrl.pagarComanda);
router.patch('/comandas/:id/entregar', ctrl.entregarComanda);

// Venda direta
router.get('/scan/:codigo',     ctrl.buscarProdutoScan);
router.post('/venda-direta',    ctrl.vendaDireta);

module.exports = router;
`;
fs.writeFileSync(
  path.join(root, 'backend', 'src', 'routes', 'assadosRoutes.js'),
  assadosRoutes
);
console.log('[setup] assadosRoutes.js atualizado.');
