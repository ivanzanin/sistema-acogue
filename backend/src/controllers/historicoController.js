const prisma = require('../lib/prisma');
const { parseDataLocal, parseDataLocalFim } = require('../lib/dateUtils');
const { getTenantId } = require('../lib/validate');

exports.historico = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { de, ate, pagina = 1, limite = 50 } = req.query;

    const where = { tenantId };
    if (de || ate) {
      where.data = {};
      if (de)  where.data.gte = parseDataLocal(de);
      if (ate) where.data.lte = parseDataLocalFim(ate);
    }

    const [total, vendas] = await Promise.all([
      prisma.caixa.count({ where }),
      prisma.caixa.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (parseInt(pagina) - 1) * parseInt(limite), take: parseInt(limite) })
    ]);
    const faturamento = await prisma.caixa.aggregate({ where: { ...where, cancelado: false }, _sum: { valorTotal: true } });

    res.json({
      total, paginas: Math.ceil(total / parseInt(limite)), paginaAtual: parseInt(pagina),
      faturamentoTotal: faturamento._sum.valorTotal || 0,
      vendas: vendas.map(v => ({
        id: v.id, data: v.createdAt, total: v.valorTotal, cancelado: v.cancelado, formaPagamento: v.formaPagamento,
        pagamentos: (() => { try { return v.pagamentosJson ? JSON.parse(v.pagamentosJson) : null; } catch { return null; } })(),
        itens: (() => { try { return JSON.parse(v.itensJson); } catch { return []; } })()
      }))
    });
  } catch (e) {
    console.error('[historico]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar historico.' });
  }
};

exports.relatorioPeriodo = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { de, ate } = req.query;

    const where = { tenantId, cancelado: false };
    if (de || ate) {
      where.data = {};
      if (de)  where.data.gte = parseDataLocal(de);
      if (ate) where.data.lte = parseDataLocalFim(ate);
    }

    const vendas = await prisma.caixa.findMany({ where, orderBy: { data: 'asc' } });
    const porDia = {}, cortesMap = {};
    for (const venda of vendas) {
      const dia = new Date(venda.createdAt).toLocaleDateString('pt-BR');
      porDia[dia] = (porDia[dia] || 0) + venda.valorTotal;
      try {
        for (const item of JSON.parse(venda.itensJson)) {
          const nome = item.nome || 'Desconhecido';
          if (!cortesMap[nome]) cortesMap[nome] = { receita: 0, peso: 0, qtd: 0 };
          cortesMap[nome].receita += parseFloat(item.total || 0);
          cortesMap[nome].peso   += parseFloat(item.peso  || 0);
          cortesMap[nome].qtd   += 1;
        }
      } catch {}
    }

    res.json({
      totalVendas: vendas.length,
      faturamentoTotal: vendas.reduce((s, v) => s + v.valorTotal, 0),
      ticketMedio: vendas.length > 0 ? vendas.reduce((s, v) => s + v.valorTotal, 0) / vendas.length : 0,
      faturamentoDiario: Object.entries(porDia).map(([dia, total]) => ({ dia, total })),
      topCortes: Object.entries(cortesMap).sort((a, b) => b[1].receita - a[1].receita).slice(0, 10).map(([nome, d]) => ({ nome, ...d })),
    });
  } catch (e) {
    console.error('[historico:relatorio]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao gerar relatorio.' });
  }
};
