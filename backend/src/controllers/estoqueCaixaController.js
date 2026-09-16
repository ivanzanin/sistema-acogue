const prisma = require('../lib/prisma');
const { inicioDia } = require('../lib/dateUtils');
const { toFloat, getTenantId } = require('../lib/validate');

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
      const peso = toFloat(ct.pesoKg) || 0;
      const precoVenda = toFloat(ct.precoVendaKg) || 0;
      const custo = toFloat(custoKg) || 0;

      // 1. Atualiza tabela Estoque (saldo de kg)
      ops.push(prisma.estoque.upsert({
        where: { nomeCorte_tenantId: { nomeCorte: ct.nome, tenantId } },
        update: { pesoKg: { increment: peso }, ...(ct.validade && { validade: new Date(ct.validade) }) },
        create: { nomeCorte: ct.nome, pesoKg: peso, tenantId, validade: ct.validade ? new Date(ct.validade) : null },
      }));

      // 2. Cria ou atualiza produto na tabela Produtos (para aparecer no PDV)
      if (precoVenda > 0) {
        const existente = produtosExistentes[ct.nome];
        if (existente) {
          ops.push(prisma.produto.update({
            where: { id: existente.id },
            data: { precoVenda, custo, estoqueAtual: { increment: peso }, ativo: true }
          }));
        } else {
          ops.push(prisma.produto.create({
            data: { nome: ct.nome, precoVenda, custo, estoqueAtual: peso, unidade: 'KG', categoria: 'Bovino', tenantId }
          }));
        }
      }
    }

    const resultado = await prisma.$transaction(ops);
    res.json({ mensagem: 'Estoque e produtos atualizados.', itens: resultado });
  } catch (e) {
    console.error('[estoque:desossa]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao registrar desossa.' });
  }
};

exports.registrarVenda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { itens, formaPagamento = 'DINHEIRO', valorPago = 0, pagamentos } = req.body;
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

    // Verificar e preparar decrementos
    const ops = [];
    for (const item of itens) {
      if (item.unidade === 'UN') {
        const produto = await prisma.produto.findFirst({ where: { nome: item.nome, tenantId, ativo: true } });
        const qtd = toFloat(item.quantidade) || 1;
        if (produto && produto.estoqueAtual < qtd)
          return res.status(400).json({ erro: `Estoque insuficiente: ${item.nome}. Disponivel: ${produto.estoqueAtual} un` });
        if (produto) ops.push(prisma.produto.update({ where: { id: produto.id }, data: { estoqueAtual: { decrement: qtd } } }));
        // Sincroniza com produtos assados vinculados (modulo Assados)
        if (produto) {
          const assadosVinculados = await prisma.produtoAssado.findMany({
            where: { tenantId, produtoOrigemId: produto.id, sessao: { status: 'ABERTA' } }
          });
          for (const pa of assadosVinculados) {
            ops.push(prisma.produtoAssado.update({
              where: { id: pa.id },
              data: { estoqueAtual: Math.max(0, pa.estoqueAtual - qtd) }
            }));
          }
        }
      } else {
        const estoque = await prisma.estoque.findUnique({ where: { nomeCorte_tenantId: { nomeCorte: item.nome, tenantId } } });
        const peso = toFloat(item.peso) || 0;
        if (estoque && estoque.pesoKg < peso)
          return res.status(400).json({ erro: `Estoque insuficiente: ${item.nome}. Disponivel: ${estoque.pesoKg.toFixed(3)} kg` });
        if (estoque) ops.push(prisma.estoque.updateMany({ where: { nomeCorte: item.nome, tenantId }, data: { pesoKg: { decrement: peso } } }));
        // Sincroniza assados vinculados (busca produto principal pelo nome)
        const prodKG = await prisma.produto.findFirst({ where: { nome: item.nome, tenantId, ativo: true } });
        if (prodKG) {
          const assadosVinculados = await prisma.produtoAssado.findMany({
            where: { tenantId, produtoOrigemId: prodKG.id, sessao: { status: 'ABERTA' } }
          });
          for (const pa of assadosVinculados) {
            ops.push(prisma.produtoAssado.update({
              where: { id: pa.id },
              data: { estoqueAtual: Math.max(0, pa.estoqueAtual - peso) }
            }));
          }
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
    res.json({ mensagem: 'Venda registrada.', vendaId: novaVenda.id, total: totalVenda, troco });
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
    const ops = itens.map(i => {
      if (i.unidade === 'UN') {
        return prisma.produto.updateMany({ where: { nome: i.nome, tenantId }, data: { estoqueAtual: { increment: toFloat(i.quantidade) || 1 } } });
      }
      return prisma.estoque.updateMany({ where: { nomeCorte: i.nome, tenantId }, data: { pesoKg: { increment: toFloat(i.peso) || 0 } } });
    });
    ops.push(prisma.caixa.update({ where: { id: parseInt(id) }, data: { cancelado: true, canceladoEm: new Date() } }));
    await prisma.$transaction(ops);
    res.json({ mensagem: 'Venda cancelada e estoque estornado.' });
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
