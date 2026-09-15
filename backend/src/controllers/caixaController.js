const prisma = require('../lib/prisma');
const { inicioDia } = require('../lib/dateUtils');
const { toFloat, getTenantId } = require('../lib/validate');

exports.abrirCaixa = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { valorInicial } = req.body;
    const jaAberto = await prisma.caixaOperacao.findFirst({
      where: { tenantId, tipo: 'ABERTURA', data: { gte: inicioDia() } }
    });
    if (jaAberto) return res.status(400).json({ erro: 'Caixa ja foi aberto hoje.' });
    const op = await prisma.caixaOperacao.create({
      data: { tenantId, tipo: 'ABERTURA', valor: toFloat(valorInicial) || 0, observacao: 'Abertura do caixa', data: new Date() }
    });
    res.status(201).json(op);
  } catch (e) {
    console.error('[caixa:abrir]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao abrir caixa.' });
  }
};

exports.registrarMovimento = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { tipo, valor, observacao } = req.body;
    if (!['SAIDA', 'ENTRADA'].includes(tipo)) return res.status(400).json({ erro: 'Tipo invalido. Use SAIDA ou ENTRADA.' });
    const v = toFloat(valor);
    if (!v || v <= 0) return res.status(400).json({ erro: 'Valor deve ser maior que zero.' });
    const op = await prisma.caixaOperacao.create({
      data: { tenantId, tipo, valor: v, observacao: observacao || '', data: new Date() }
    });
    res.status(201).json(op);
  } catch (e) {
    console.error('[caixa:movimento]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao registrar movimento.' });
  }
};

exports.fecharCaixa = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { valorFinal } = req.body;
    const vendas = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioDia() }, cancelado: false }
    });
    const totalVendas = vendas.reduce((s, v) => s + v.valorTotal, 0);
    const porForma = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0 };
    for (const v of vendas) porForma[v.formaPagamento] = (porForma[v.formaPagamento] || 0) + v.valorTotal;

    const operacoes = await prisma.caixaOperacao.findMany({
      where: { tenantId, data: { gte: inicioDia() } }, orderBy: { data: 'asc' }
    });
    const abertura    = operacoes.find(o => o.tipo === 'ABERTURA')?.valor || 0;
    const sangrias    = operacoes.filter(o => o.tipo === 'SAIDA').reduce((s, o) => s + o.valor, 0);
    const suprimentos = operacoes.filter(o => o.tipo === 'ENTRADA').reduce((s, o) => s + o.valor, 0);
    const saldoEsperado = abertura + porForma.DINHEIRO + suprimentos - sangrias;
    const vf = toFloat(valorFinal) || 0;
    const diferenca = vf - saldoEsperado;

    const resumo = { abertura, totalVendas, porForma, suprimentos, sangrias, saldoEsperado, diferenca, qtdVendas: vendas.length };
    await prisma.caixaOperacao.create({
      data: { tenantId, tipo: 'FECHAMENTO', valor: vf, observacao: JSON.stringify(resumo), data: new Date() }
    });
    res.json({
      resumo: {
        ...resumo,
        saldoEsperado: parseFloat(saldoEsperado.toFixed(2)),
        valorInformado: vf,
        diferenca: parseFloat(diferenca.toFixed(2)),
        status: Math.abs(diferenca) < 0.01 ? 'CONFERIDO' : diferenca > 0 ? 'SOBRA' : 'FALTA'
      }
    });
  } catch (e) {
    console.error('[caixa:fechar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao fechar caixa.' });
  }
};

exports.statusCaixa = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const operacoes = await prisma.caixaOperacao.findMany({
      where: { tenantId, data: { gte: inicioDia() } }, orderBy: { data: 'asc' }
    });
    const vendas = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioDia() } }, orderBy: { createdAt: 'asc' }
    });
    const vendasAtivas = vendas.filter(v => !v.cancelado);
    const totalVendas  = vendasAtivas.reduce((s, v) => s + v.valorTotal, 0);
    const aberto    = operacoes.some(o => o.tipo === 'ABERTURA');
    const fechado   = operacoes.some(o => o.tipo === 'FECHAMENTO');
    const abertura  = operacoes.find(o => o.tipo === 'ABERTURA')?.valor || 0;
    const sangrias  = operacoes.filter(o => o.tipo === 'SAIDA').reduce((s, o) => s + o.valor, 0);
    const suprimentos = operacoes.filter(o => o.tipo === 'ENTRADA').reduce((s, o) => s + o.valor, 0);
    const porForma = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0 };
    for (const v of vendasAtivas) porForma[v.formaPagamento] = (porForma[v.formaPagamento] || 0) + v.valorTotal;

    res.json({
      aberto, fechado, abertura, totalVendas, sangrias, suprimentos, porForma,
      saldoAtual: parseFloat((abertura + totalVendas + suprimentos - sangrias).toFixed(2)),
      operacoes, qtdVendas: vendasAtivas.length,
      vendas: vendas.map(v => ({
        id: v.id, horario: v.createdAt, total: v.valorTotal,
        formaPagamento: v.formaPagamento, troco: v.troco, cancelado: v.cancelado,
        itens: (() => { try { return JSON.parse(v.itensJson); } catch { return []; } })(),
      }))
    });
  } catch (e) {
    console.error('[caixa:status]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar status.' });
  }
};

exports.reabrirCaixa = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const fechamento = await prisma.caixaOperacao.findFirst({
      where: { tenantId, tipo: 'FECHAMENTO', data: { gte: inicioDia() } },
      orderBy: { data: 'desc' }
    });
    if (!fechamento) return res.status(400).json({ erro: 'Nenhum fechamento encontrado hoje.' });
    await prisma.caixaOperacao.delete({ where: { id: fechamento.id } });
    res.json({ mensagem: 'Caixa reaberto com sucesso.' });
  } catch (e) {
    console.error('[caixa:reabrir]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao reabrir caixa.' });
  }
};
