const { PrismaClient } = require('@prisma/client');
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
