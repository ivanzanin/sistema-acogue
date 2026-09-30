const prisma = require('../lib/prisma');
const { inicioMes, inicioSemana, inicioDia, fimDia } = require('../lib/dateUtils');
const { getTenantId } = require('../lib/validate');

exports.resumo = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const agora = new Date();
    const fimMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

    // Vendas de Hoje
    const vendasHoje = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioDia(), lte: fimDia() }, cancelado: false },
    });
    const faturamentoHoje = vendasHoje.reduce((s, v) => s + (Number(v.valorTotal) || 0), 0);
    const totalVendasHoje = vendasHoje.length;
    const ticketMedioHoje = totalVendasHoje > 0 ? faturamentoHoje / totalVendasHoje : 0;

    // Vendas do Mês
    const vendasMes = await prisma.caixa.findMany({
      where: { tenantId, data: { gte: inicioMes(), lte: fimMes }, cancelado: false },
    });
    const faturamentoMes = vendasMes.reduce((s, v) => s + (Number(v.valorTotal) || 0), 0);
    const totalVendas    = vendasMes.length;
    const ticketMedio    = totalVendas > 0 ? faturamentoMes / totalVendas : 0;

    // Auto-recuperação: limpa registros corrompidos com valores astronômicos (> 100000)
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

    // Análise de Volume de Carne Vendida (KG) e Top Cortes no mês
    const cortesMap = {};
    let totalKgVendido = 0;

    for (const venda of vendasMes) {
      try {
        const itens = JSON.parse(venda.itensJson);
        for (const item of itens) {
          const nome = item.nome || 'Desconhecido';
          const valorItem = parseFloat(item.total || 0);
          const pesoItem = parseFloat(item.peso || item.pesoKg || 0);

          if (!cortesMap[nome]) cortesMap[nome] = { receita: 0, peso: 0 };
          cortesMap[nome].receita += valorItem;

          if (isFinite(pesoItem) && pesoItem > 0 && pesoItem < 10000) {
            cortesMap[nome].peso += pesoItem;
            totalKgVendido += pesoItem;
          }
        }
      } catch {}
    }

    const diaDoMes = Math.max(1, agora.getDate());
    const mediaKgDia = totalKgVendido / diaDoMes;

    const top3 = Object.entries(cortesMap)
      .sort((a, b) => b[1].receita - a[1].receita)
      .slice(0, 3)
      .map(([nome, d]) => ({ nome, ...d }));

    // Análise de Métodos de Pagamento no Mês
    const pagamentosMap = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0, VOUCHER: 0 };
    let totalPagamentos = 0;

    for (const v of vendasMes) {
      let processado = false;
      if (v.pagamentosJson) {
        try {
          const pags = JSON.parse(v.pagamentosJson);
          if (Array.isArray(pags) && pags.length > 0) {
            for (const p of pags) {
              const f = p.forma || 'DINHEIRO';
              const val = Number(p.valor) || 0;
              pagamentosMap[f] = (pagamentosMap[f] || 0) + val;
              totalPagamentos += val;
            }
            processado = true;
          }
        } catch {}
      }
      if (!processado) {
        const f = v.formaPagamento || 'DINHEIRO';
        const val = Number(v.valorTotal) || 0;
        pagamentosMap[f] = (pagamentosMap[f] || 0) + val;
        totalPagamentos += val;
      }
    }

    const formasPagamento = Object.entries(pagamentosMap)
      .filter(([_, valor]) => valor > 0)
      .map(([forma, valor]) => ({
        forma,
        valor,
        percentual: totalPagamentos > 0 ? Math.round((valor / totalPagamentos) * 100) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // Análise de Dia Mais Forte da Semana
    const diasSemanaNomes = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const fatPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];
    const qtdPorDiaSemana = [0, 0, 0, 0, 0, 0, 0];

    for (const v of vendasMes) {
      const d = new Date(v.data || v.createdAt);
      const diaSem = d.getDay();
      fatPorDiaSemana[diaSem] += (Number(v.valorTotal) || 0);
      qtdPorDiaSemana[diaSem]++;
    }

    let maxDiaIdx = 6;
    let maxFatDia = 0;
    for (let i = 0; i < 7; i++) {
      if (fatPorDiaSemana[i] > maxFatDia) {
        maxFatDia = fatPorDiaSemana[i];
        maxDiaIdx = i;
      }
    }
    const diaMaisForte = {
      nome: diasSemanaNomes[maxDiaIdx],
      total: maxFatDia,
      vendas: qtdPorDiaSemana[maxDiaIdx],
      percentual: faturamentoMes > 0 ? Math.round((maxFatDia / faturamentoMes) * 100) : 0,
    };

    // Análise de Horário de Maior Fluxo
    const faixasHorario = {
      'Manhã (07h - 12h)': 0,
      'Almoço/Tarde (12h - 17h)': 0,
      'Noite (17h - 22h)': 0,
    };
    for (const v of vendasMes) {
      const hora = new Date(v.createdAt).getHours();
      if (hora >= 7 && hora < 12) faixasHorario['Manhã (07h - 12h)']++;
      else if (hora >= 12 && hora < 17) faixasHorario['Almoço/Tarde (12h - 17h)']++;
      else faixasHorario['Noite (17h - 22h)']++;
    }
    let melhorFaixa = 'Manhã (07h - 12h)';
    let maxFaixaQtd = 0;
    for (const [faixa, qtd] of Object.entries(faixasHorario)) {
      if (qtd > maxFaixaQtd) {
        maxFaixaQtd = qtd;
        melhorFaixa = faixa;
      }
    }
    const horarioPico = {
      faixa: melhorFaixa,
      totalVendas: maxFaixaQtd,
      percentual: totalVendas > 0 ? Math.round((maxFaixaQtd / totalVendas) * 100) : 0,
    };

    // Faturamento últimos 7 dias (gráfico)
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
      faturamentoHoje,
      totalVendasHoje,
      ticketMedioHoje,
      faturamentoMes,
      totalVendas,
      ticketMedio,
      volumeVendido: {
        totalKg: totalKgVendido,
        mediaKgDia,
      },
      formasPagamento,
      diaMaisForte,
      horarioPico,
      top3,
      faturamentoDiario: Object.entries(porDia).map(([dia, total]) => ({ dia, total })),
    });
  } catch (e) {
    console.error('[dashboard]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao carregar dashboard.' });
  }
};
