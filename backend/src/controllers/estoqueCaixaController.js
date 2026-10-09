const prisma = require('../lib/prisma');
const { inicioDia, fimDia } = require('../lib/dateUtils');
const { toFloat, getTenantId } = require('../lib/validate');
const { emitirNfceParaVenda } = require('../services/nfceService');

exports.registrarDesossa = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { cortes, custoKg } = req.body;
    if (!Array.isArray(cortes) || cortes.length === 0)
      return res.status(400).json({ erro: 'Array de cortes obrigatorio.' });

    // Busca produtos existentes antes da transaction
    const produtosExistentes = {};
    for (const ct of cortes) {
      const p = await prisma.produto.findFirst({ where: { nome: ct.nome, tenantId, unidade: 'KG' } });
      if (p) produtosExistentes[ct.nome] = p;
    }

    const ops = [];
    for (const ct of cortes) {
      const precoVenda = toFloat(ct.precoVendaKg) || 0;
      const custo = toFloat(custoKg) || 0;

      // Cria ou atualiza produto na tabela Produtos com preços da desossa
      if (precoVenda > 0) {
        const existente = produtosExistentes[ct.nome];
        if (existente) {
          ops.push(prisma.produto.update({
            where: { id: existente.id },
            data: { precoVenda, custo, ativo: true }
          }));
        } else {
          ops.push(prisma.produto.create({
            data: { nome: ct.nome, precoVenda, custo, estoqueAtual: 0, unidade: 'KG', categoria: 'Bovino', tenantId }
          }));
        }
      }
    }

    const resultado = await prisma.$transaction(ops);
    res.json({ mensagem: 'Produtos e preços da desossa atualizados.', itens: resultado });
  } catch (e) {
    console.error('[estoque:desossa]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao registrar desossa.' });
  }
};

exports.registrarVenda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { itens, formaPagamento = 'DINHEIRO', valorPago = 0, pagamentos, emitirNfce, cpfDestinatario } = req.body;
    if (!Array.isArray(itens) || itens.length === 0)
      return res.status(400).json({ erro: 'Array de itens obrigatorio.' });

    let finalForma = formaPagamento;
    let finalPagamentosJson = null;
    const totalVenda = itens.reduce((s, i) => s + (toFloat(i.total) || 0), 0);
    let vp = toFloat(valorPago) || 0;
    let troco = 0;

    if (Array.isArray(pagamentos) && pagamentos.length > 0) {
      const formasValidas = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'VOUCHER'];
      let somaPags = 0;
      let totalDinheiroDevido = 0;
      let totalDinheiroPago = 0;

      for (const p of pagamentos) {
        if (!formasValidas.includes(p.forma))
          return res.status(400).json({ erro: `Forma de pagamento invalida: ${p.forma}` });
        const val = toFloat(p.valor) || 0;
        if (val <= 0)
          return res.status(400).json({ erro: 'Cada pagamento deve ter valor maior que zero.' });
        somaPags += val;

        if (p.forma === 'DINHEIRO') {
          totalDinheiroDevido += val;
          const vpItem = toFloat(p.valorPago);
          if (vpItem && vpItem > 0) {
            totalDinheiroPago += vpItem;
          } else {
            totalDinheiroPago += val;
          }
        }
      }

      if (Math.abs(somaPags - totalVenda) > 0.05) {
        return res.status(400).json({
          erro: `A soma dos pagamentos (R$ ${somaPags.toFixed(2)}) nao confere com o total da venda (R$ ${totalVenda.toFixed(2)}).`
        });
      }

      const primeiraForma = pagamentos[0].forma;
      const todasIguais = pagamentos.every(p => p.forma === primeiraForma);
      finalForma = todasIguais ? primeiraForma : 'MULTIPLO';
      finalPagamentosJson = JSON.stringify(pagamentos);

      if (totalDinheiroPago > totalDinheiroDevido) {
        troco = Math.max(0, totalDinheiroPago - totalDinheiroDevido);
        vp = totalVenda + troco;
      } else {
        vp = totalVenda;
        troco = 0;
      }
    } else {
      if (!['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'VOUCHER'].includes(formaPagamento))
        return res.status(400).json({ erro: 'Forma de pagamento invalida.' });
      vp = toFloat(valorPago) || totalVenda;
      troco = formaPagamento === 'DINHEIRO' ? Math.max(0, vp - totalVenda) : 0;
      finalPagamentosJson = JSON.stringify([{ forma: formaPagamento, valor: totalVenda, valorPago: vp, troco }]);
    }

    // Controle de estoque exclusivo para Assados (sessão aberta)
    const ops = [];
    for (const item of itens) {
      const qtdOuPeso = item.unidade === 'UN' ? (toFloat(item.quantidade) || 1) : (toFloat(item.peso) || 0);

      // 1. Se vendido diretamente com o nome de um produto assado na sessão aberta
      const assadoDireto = await prisma.produtoAssado.findFirst({
        where: { tenantId, nome: item.nome, sessao: { status: 'ABERTA' } }
      });
      if (assadoDireto) {
        ops.push(prisma.produtoAssado.update({
          where: { id: assadoDireto.id },
          data: { estoqueAtual: Math.max(0, assadoDireto.estoqueAtual - qtdOuPeso) }
        }));
      }

      // 2. Se vinculado a um produto de origem do açougue
      const prodOrigem = await prisma.produto.findFirst({ where: { nome: item.nome, tenantId, ativo: true } });
      if (prodOrigem) {
        const assadosVinculados = await prisma.produtoAssado.findMany({
          where: { tenantId, produtoOrigemId: prodOrigem.id, sessao: { status: 'ABERTA' } }
        });
        for (const pa of assadosVinculados) {
          ops.push(prisma.produtoAssado.update({
            where: { id: pa.id },
            data: { estoqueAtual: Math.max(0, pa.estoqueAtual - qtdOuPeso) }
          }));
        }
      }
    }

    if (ops.length > 0) await prisma.$transaction(ops);
    const vendaData = {
      data: inicioDia(),
      valorTotal: totalVenda,
      itensJson: JSON.stringify(itens),
      formaPagamento: finalForma,
      valorPago: vp,
      troco,
      tenantId,
    };
    if (finalPagamentosJson) {
      vendaData.pagamentosJson = finalPagamentosJson;
    }

    let novaVenda;
    try {
      novaVenda = await prisma.caixa.create({ data: vendaData });
    } catch (createErr) {
      if (vendaData.pagamentosJson && createErr.message && createErr.message.includes('pagamentosJson')) {
        console.warn('[estoque:venda] Prisma sem campo pagamentosJson no client/banco, salvando venda sem ele:', createErr.message);
        delete vendaData.pagamentosJson;
        novaVenda = await prisma.caixa.create({ data: vendaData });
      } else {
        throw createErr;
      }
    }

    let nfceResultado = null;
    if (emitirNfce) {
      try {
        const pagamentosArr = Array.isArray(pagamentos) && pagamentos.length > 0
          ? pagamentos
          : [{ forma: finalForma, valor: totalVenda, valorPago: vp, troco }];

        nfceResultado = await emitirNfceParaVenda({
          tenantId,
          vendaId: novaVenda.id,
          caixaId: novaVenda.id,
          itens,
          total: totalVenda,
          pagamentos: pagamentosArr,
          troco,
          cpfDestinatario: cpfDestinatario || null,
        });
      } catch (nfceErr) {
        console.error('[estoque:venda:nfce]', nfceErr.message);
        nfceResultado = { erro: nfceErr.message };
      }
    }

    res.json({
      mensagem: 'Venda registrada.',
      vendaId: novaVenda.id,
      total: totalVenda,
      troco,
      nfce: nfceResultado,
    });
  } catch (e) {
    console.error('[estoque:venda]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao registrar venda.' });
  }
};

exports.cancelarVenda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const venda = await prisma.caixa.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!venda) return res.status(404).json({ erro: 'Venda nao encontrada.' });
    if (venda.cancelado) return res.status(400).json({ erro: 'Venda ja cancelada.' });
    if (new Date(venda.data).toDateString() !== new Date().toDateString())
      return res.status(400).json({ erro: 'Apenas vendas do dia atual podem ser canceladas.' });

    const itens = JSON.parse(venda.itensJson);
    const ops = [];

    // Se algum item cancelado pertencer a uma sessão de assados aberta, devolve ao estoque
    for (const i of itens) {
      const qtdOuPeso = i.unidade === 'UN' ? (toFloat(i.quantidade) || 1) : (toFloat(i.peso) || 0);
      const assadoDireto = await prisma.produtoAssado.findFirst({
        where: { tenantId, nome: i.nome, sessao: { status: 'ABERTA' } }
      });
      if (assadoDireto) {
        ops.push(prisma.produtoAssado.update({
          where: { id: assadoDireto.id },
          data: { estoqueAtual: assadoDireto.estoqueAtual + qtdOuPeso }
        }));
      }
    }

    ops.push(prisma.caixa.update({ where: { id: parseInt(id) }, data: { cancelado: true, canceladoEm: new Date() } }));
    if (ops.length > 0) await prisma.$transaction(ops);
    res.json({ mensagem: 'Venda cancelada com sucesso.' });
  } catch (e) {
    console.error('[estoque:cancelar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao cancelar venda.' });
  }
};

exports.resumoCaixaHoje = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const vendas = await prisma.caixa.findMany({
      where: { data: { gte: inicioDia() }, tenantId }, orderBy: { createdAt: 'desc' }
    });
    const ativas   = vendas.filter(v => !v.cancelado);
    const totalDia = ativas.reduce((s, v) => s + v.valorTotal, 0);
    const porForma = { DINHEIRO: 0, PIX: 0, DEBITO: 0, CREDITO: 0, VOUCHER: 0 };
    for (const v of ativas) {
      if (v.pagamentosJson) {
        try {
          const pags = JSON.parse(v.pagamentosJson);
          if (Array.isArray(pags) && pags.length > 0) {
            for (const p of pags) {
              const f = p.forma || 'DINHEIRO';
              porForma[f] = (porForma[f] || 0) + (toFloat(p.valor) || 0);
            }
            continue;
          }
        } catch (e) {}
      }
      porForma[v.formaPagamento] = (porForma[v.formaPagamento] || 0) + v.valorTotal;
    }

    res.json({
      totalDia, porForma, totalCanceladas: vendas.filter(v => v.cancelado).length,
      ultimasVendas: vendas.slice(0, 20).map(v => ({
        id: v.id, horario: v.createdAt, total: v.valorTotal,
        formaPagamento: v.formaPagamento, troco: v.troco, cancelado: v.cancelado,
        pagamentos: (() => { try { return v.pagamentosJson ? JSON.parse(v.pagamentosJson) : null; } catch { return null; } })(),
        itens: (() => { try { return JSON.parse(v.itensJson); } catch { return []; } })(),
      })),
    });
  } catch (e) {
    console.error('[estoque:resumo]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar resumo.' });
  }
};

exports.listarEstoque = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
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

    const estoqueKG = await prisma.estoque.findMany({ where: { tenantId }, orderBy: { nomeCorte: 'asc' } });
    const agora = new Date();
    const limite = new Date(agora); limite.setDate(agora.getDate() + 3);

    const kgComStatus = estoqueKG.map(e => {
      let statusValidade = 'OK';
      if (e.validade) {
        const val = new Date(e.validade);
        if (val < agora)       statusValidade = 'VENCIDO';
        else if (val < limite) statusValidade = 'VENCENDO';
      }
      return { ...e, tipo: 'KG', statusValidade };
    });

    const produtosUN = await prisma.produto.findMany({ where: { tenantId, unidade: 'UN', ativo: true }, orderBy: { nome: 'asc' } });
    const unComStatus = produtosUN.map(p => {
      let statusValidade = 'OK';
      if (p.validade) {
        const val = new Date(p.validade);
        if (val < agora)       statusValidade = 'VENCIDO';
        else if (val < limite) statusValidade = 'VENCENDO';
      }
      return {
        id: `un_${p.id}`, produtoId: p.id, nomeCorte: p.nome, pesoKg: p.estoqueAtual,
        validade: p.validade, tenantId: p.tenantId, updatedAt: p.updatedAt,
        tipo: 'UN', categoria: p.categoria, statusValidade,
      };
    });

    res.json([...kgComStatus, ...unComStatus]);
  } catch (e) {
    console.error('[estoque:listar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar estoque.' });
  }
};

exports.removerEstoque = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    if (!id.startsWith('un_')) {
      await prisma.estoque.deleteMany({ where: { id: parseInt(id), tenantId } });
    } else {
      const produtoId = parseInt(id.replace('un_', ''));
      await prisma.produto.updateMany({ where: { id: produtoId, tenantId }, data: { estoqueAtual: 0 } });
    }
    res.json({ mensagem: 'Item removido do estoque.' });
  } catch (e) {
    console.error('[estoque:remover]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao remover.' });
  }
};

exports.alertasValidade = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const agora = new Date();
    const amanha = new Date(agora); amanha.setDate(agora.getDate() + 1);
    const limite3dias = new Date(agora); limite3dias.setDate(agora.getDate() + 3);

    // KG vencidos ou vencendo
    const estoqueKG = await prisma.estoque.findMany({
      where: { tenantId, validade: { not: null } }
    });

    // UN vencidos ou vencendo
    const produtosUN = await prisma.produto.findMany({
      where: { tenantId, ativo: true, validade: { not: null } }
    });

    const alertas = [];

    for (const e of estoqueKG) {
      const val = new Date(e.validade);
      if (val < agora) alertas.push({ nome: e.nomeCorte, tipo: 'KG', status: 'VENCIDO', validade: e.validade });
      else if (val < limite3dias) alertas.push({ nome: e.nomeCorte, tipo: 'KG', status: 'VENCENDO', validade: e.validade });
    }

    for (const p of produtosUN) {
      const val = new Date(p.validade);
      if (val < agora) alertas.push({ nome: p.nome, tipo: 'UN', status: 'VENCIDO', validade: p.validade });
      else if (val < limite3dias) alertas.push({ nome: p.nome, tipo: 'UN', status: 'VENCENDO', validade: p.validade });
    }

    res.json({ alertas, totalVencidos: alertas.filter(a => a.status === 'VENCIDO').length, totalVencendo: alertas.filter(a => a.status === 'VENCENDO').length });
  } catch (e) {
    console.error('[alertas:validade]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar alertas.' });
  }
};

exports.vendasPorProduto = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { dias = '30' } = req.query;

    const agora = new Date();
    let dataInicio = null;
    const dataFim = fimDia();

    if (dias === 'hoje' || dias === '0' || dias === 0) {
      dataInicio = inicioDia();
    } else if (dias === 'todas') {
      dataInicio = null;
    } else {
      const numDias = parseInt(dias) || 30;
      dataInicio = new Date(agora);
      dataInicio.setDate(dataInicio.getDate() - (numDias - 1));
      dataInicio.setHours(0, 0, 0, 0);
    }

    const whereClause = {
      tenantId,
      cancelado: false,
    };

    if (dataInicio) {
      whereClause.OR = [
        { data: { gte: dataInicio, lte: dataFim } },
        { createdAt: { gte: dataInicio, lte: dataFim } },
      ];
    }

    const vendas = await prisma.caixa.findMany({
      where: whereClause,
      select: {
        id: true,
        data: true,
        createdAt: true,
        valorTotal: true,
        itensJson: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const produtosMap = {};
    let totalFaturamentoPeriodo = 0;
    let totalKgPeriodo = 0;
    let totalUnPeriodo = 0;

    for (const v of vendas) {
      try {
        const itens = JSON.parse(v.itensJson);
        if (!Array.isArray(itens)) continue;

        const produtosNaVenda = new Set();

        for (const item of itens) {
          const nome = (item.nome || 'Diversos').trim();
          const totalItem = parseFloat(item.total || 0) || 0;
          const pesoItem = parseFloat(item.peso || item.pesoKg || 0) || 0;
          const qtdItem = parseFloat(item.quantidade || item.qtd || (item.unidade === 'UN' ? 1 : 0)) || 0;
          const unidade = (item.unidade || (pesoItem > 0 ? 'KG' : 'UN')).toUpperCase();

          if (!produtosMap[nome]) {
            produtosMap[nome] = {
              nome,
              unidade: unidade === 'UN' ? 'UN' : 'KG',
              totalKg: 0,
              totalUn: 0,
              faturamento: 0,
              qtdTransacoes: 0,
            };
          }

          produtosMap[nome].faturamento += totalItem;
          totalFaturamentoPeriodo += totalItem;

          if (unidade === 'UN') {
            const qtd = qtdItem > 0 ? qtdItem : 1;
            produtosMap[nome].totalUn += qtd;
            totalUnPeriodo += qtd;
          } else {
            const peso = pesoItem > 0 ? pesoItem : (qtdItem > 0 ? qtdItem : 0);
            produtosMap[nome].totalKg += peso;
            totalKgPeriodo += peso;
          }

          if (!produtosNaVenda.has(nome)) {
            produtosNaVenda.add(nome);
            produtosMap[nome].qtdTransacoes += 1;
          }
        }
      } catch (err) {}
    }

    const lista = Object.values(produtosMap).map(p => {
      const volumePrincipal = p.unidade === 'UN' ? p.totalUn : p.totalKg;
      const precoMedio = volumePrincipal > 0 ? p.faturamento / volumePrincipal : 0;
      const percentualReceita = totalFaturamentoPeriodo > 0 ? (p.faturamento / totalFaturamentoPeriodo) * 100 : 0;

      return {
        ...p,
        volume: volumePrincipal,
        precoMedio: parseFloat(precoMedio.toFixed(2)),
        percentualReceita: parseFloat(percentualReceita.toFixed(1)),
      };
    });

    lista.sort((a, b) => b.faturamento - a.faturamento);

    res.json({
      periodo: dias,
      totalVendas: vendas.length,
      totalFaturamento: totalFaturamentoPeriodo,
      totalKg: parseFloat(totalKgPeriodo.toFixed(3)),
      totalUn: Math.round(totalUnPeriodo),
      totalItensDistintos: lista.length,
      produtos: lista,
    });
  } catch (e) {
    console.error('[gestao:vendasPorProduto]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao calcular vendas por produto.' });
  }
};
