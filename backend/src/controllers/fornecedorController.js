const { PrismaClient } = require('@prisma/client');
const { getTenantId, toFloat, toInt } = require('../lib/validate');
const prisma = new PrismaClient();

exports.listar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const fornecedores = await prisma.fornecedor.findMany({
      where: { tenantId, ativo: true },
      include: { _count: { select: { precos: true } } },
      orderBy: { nome: 'asc' }
    });
    res.json(fornecedores);
  } catch (e) {
    console.error('[forn:listar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.criar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { nome, cnpj, vendedor, telefone, prazoPagamento, observacoes } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatorio.' });
    const f = await prisma.fornecedor.create({
      data: { nome: nome.trim(), cnpj: cnpj||null, vendedor: vendedor||null, telefone: telefone||null, prazoPagamento: prazoPagamento||null, observacoes: observacoes||null, tenantId }
    });
    res.json(f);
  } catch (e) {
    console.error('[forn:criar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { nome, cnpj, vendedor, telefone, prazoPagamento, observacoes } = req.body;
    await prisma.fornecedor.updateMany({
      where: { id, tenantId },
      data: { ...(nome && {nome: nome.trim()}), cnpj, vendedor, telefone, prazoPagamento, observacoes }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('[forn:atualizar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.deletar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    await prisma.fornecedor.updateMany({ where: { id, tenantId }, data: { ativo: false } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[forn:deletar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.listarPrecos = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const fornecedorId = toInt(req.params.id);
    const precos = await prisma.precoFornecedor.findMany({
      where: { fornecedorId, tenantId },
      include: { produto: true },
      orderBy: { produto: { nome: 'asc' } }
    });
    res.json(precos);
  } catch (e) {
    console.error('[forn:precos]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.salvarPreco = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const fornecedorId = toInt(req.params.id);
    const { produtoId, unidade, preco } = req.body;
    const precoNum = toFloat(preco);
    if (!produtoId || !precoNum || precoNum <= 0)
      return res.status(400).json({ erro: 'Produto e preco obrigatorios.' });

    const existente = await prisma.precoFornecedor.findUnique({
      where: { fornecedorId_produtoId: { fornecedorId, produtoId: toInt(produtoId) } }
    });

    let precoAnterior = null;
    if (existente) {
      precoAnterior = existente.precoAtual;
      await prisma.historicoPreco.create({
        data: { precoFornecedorId: existente.id, preco: existente.precoAtual, tenantId }
      });
    }

    const result = await prisma.precoFornecedor.upsert({
      where: { fornecedorId_produtoId: { fornecedorId, produtoId: toInt(produtoId) } },
      update: { precoAtual: precoNum, precoAnterior, unidade: unidade || 'KG' },
      create: { fornecedorId, produtoId: toInt(produtoId), precoAtual: precoNum, unidade: unidade || 'KG', tenantId },
    });
    res.json(result);
  } catch (e) {
    console.error('[forn:salvarPreco]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.removerPreco = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.precoId);
    await prisma.precoFornecedor.deleteMany({ where: { id, tenantId } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[forn:removerPreco]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.comparacao = async (req, res) => {
  try {
    const tenantId = getTenantId(req);

    const fornecedores = await prisma.fornecedor.findMany({
      where: { tenantId, ativo: true },
      orderBy: { nome: 'asc' }
    });

    const precos = await prisma.precoFornecedor.findMany({
      where: { tenantId },
      include: { produto: true }
    });

    const porProduto = {};
    for (const p of precos) {
      if (!porProduto[p.produtoId]) {
        porProduto[p.produtoId] = { produto: p.produto, precos: {} };
      }
      porProduto[p.produtoId].precos[p.fornecedorId] = {
        preco: p.precoAtual,
        precoAnterior: p.precoAnterior,
        unidade: p.unidade,
        updatedAt: p.updatedAt,
      };
    }

    const linhas = Object.values(porProduto).map(item => {
      const valores = Object.entries(item.precos);
      let menor = null;
      for (const [fornecedorId, { preco }] of valores) {
        if (menor === null || preco < menor.preco) menor = { fornecedorId: toInt(fornecedorId), preco };
      }
      return { ...item, melhor: menor };
    }).sort((a, b) => a.produto.nome.localeCompare(b.produto.nome));

    res.json({ fornecedores, linhas });
  } catch (e) {
    console.error('[forn:comparacao]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.alertas = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const setedias = new Date(); setedias.setDate(setedias.getDate() - 7);

    const precos = await prisma.precoFornecedor.findMany({
      where: {
        tenantId,
        precoAnterior: { not: null },
        updatedAt: { gte: setedias }
      },
      include: { produto: true, fornecedor: true }
    });

    const alertas = precos.map(p => {
      const variacao = ((p.precoAtual - p.precoAnterior) / p.precoAnterior) * 100;
      return {
        id: p.id,
        produto: p.produto.nome,
        fornecedor: p.fornecedor.nome,
        precoAnterior: p.precoAnterior,
        precoAtual: p.precoAtual,
        unidade: p.unidade,
        variacao: +variacao.toFixed(1),
        tipo: variacao > 0 ? 'alta' : 'baixa',
        data: p.updatedAt,
      };
    }).filter(a => Math.abs(a.variacao) >= 1)
      .sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao));

    res.json(alertas);
  } catch (e) {
    console.error('[forn:alertas]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.historico = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const precoId = toInt(req.params.precoId);
    const dias = toInt(req.query.dias) || 30;
    const desde = new Date(); desde.setDate(desde.getDate() - dias);

    const historico = await prisma.historicoPreco.findMany({
      where: { precoFornecedorId: precoId, tenantId, data: { gte: desde } },
      orderBy: { data: 'asc' }
    });

    const atual = await prisma.precoFornecedor.findFirst({
      where: { id: precoId, tenantId },
      include: { fornecedor: true, produto: true }
    });

    if (atual) {
      historico.push({ id: 'atual', preco: atual.precoAtual, data: atual.updatedAt });
    }

    res.json({ historico, precoAtual: atual });
  } catch (e) {
    console.error('[forn:historico]', e.message);
    res.status(500).json({ erro: e.message });
  }
};
