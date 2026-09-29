const prisma = require('../lib/prisma');
const { inicioMes, inicioSemana } = require('../lib/dateUtils');
const { getTenantId } = require('../lib/validate');

exports.resumo = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const agora = new Date();
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

    const vendasMes = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioMes(), lte: fimMes }, cancelado: false },
    });
    const faturamentoMes = vendasMes.reduce((s, v) => s + v.valorTotal, 0);
    const totalVendas    = vendasMes.length;
    const ticketMedio    = totalVendas > 0 ? faturamentoMes / totalVendas : 0;

    // Auto-recuperação: limpa registros corrompidos com valores astronômicos (ex: teclas presas como 66666... ou 75555...)
    try {
      await prisma.estoque.updateMany({
        where: { tenantId, pesoKg: { gt: 100000 } },
        data: { pesoKg: 0 },
      });
      await prisma.produto.updateMany({
        where: { tenantId, estoqueAtual: { gt: 100000 }, codigoBarras: { not: '999' } },
        data: { estoqueAtual: 0 },
      });
    } catch {}

    // Estoque KG + UN
    const estoqueKG = await prisma.estoque.findMany({ where: { tenantId } });
    const produtosUN = await prisma.produto.findMany({ where: { tenantId, unidade: 'UN', ativo: true } });
    
    const totalKg = estoqueKG.reduce((s, e) => {
      const v = Number(e.pesoKg);
      return s + (isFinite(v) && v > 0 && v < 100000 ? v : 0);
    }, 0);

    const totalUn = produtosUN.reduce((s, p) => {
      if (p.codigoBarras === '999' || p.nome?.toLowerCase() === 'diversos') return s;
      const v = Number(p.estoqueAtual);
      return s + (isFinite(v) && v > 0 && v < 100000 ? v : 0);
    }, 0);

    const alertasBaixo = estoqueKG.filter(e => {
      const v = Number(e.pesoKg);
      return isFinite(v) && v < 3 && v > 0;
    }).length + produtosUN.filter(p => {
      if (p.codigoBarras === '999' || p.nome?.toLowerCase() === 'diversos') return false;
      const v = Number(p.estoqueAtual);
      return isFinite(v) && v <= 5 && v > 0;
    }).length;

    // Top 3 cortes do mês
    const cortesMap = {};
    for (const venda of vendasMes) {
      try {
        for (const item of JSON.parse(venda.itensJson)) {
          const nome = item.nome || 'Desconhecido';
          if (!cortesMap[nome]) cortesMap[nome] = { receita: 0, peso: 0 };
          cortesMap[nome].receita += parseFloat(item.total || 0);
          cortesMap[nome].peso   += parseFloat(item.peso || 0);
        }
      } catch {}
    }
    const top3 = Object.entries(cortesMap).sort((a, b) => b[1].receita - a[1].receita).slice(0, 3)
      .map(([nome, d]) => ({ nome, ...d }));

    // Faturamento últimos 7 dias
    const vendasSemana = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioSemana() }, cancelado: false },
    });
    const porDia = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      porDia[d.toLocaleDateString('pt-BR', { weekday: 'short' })] = 0;
    }
    for (const v of vendasSemana) {
      const dia = new Date(v.createdAt).toLocaleDateString('pt-BR', { weekday: 'short' });
      if (porDia[dia] !== undefined) porDia[dia] += v.valorTotal;
    }

    res.json({
      faturamentoMes, totalVendas, ticketMedio,
      estoque: { totalKg, totalUn, itens: estoqueKG.length + produtosUN.length, alertasBaixo },
      top3,
      faturamentoDiario: Object.entries(porDia).map(([dia, total]) => ({ dia, total })),
    });
  } catch (e) {
    console.error('[dashboard]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao carregar dashboard.' });
  }
};
