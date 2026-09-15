const prisma = require('../lib/prisma');
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
    const { lancarNoCaixa } = req.body;
    const sessao = await prisma.sessaoAssados.findFirst({
      where: { tenantId, status: 'ABERTA' },
      include: { produtos: true, vendasDiretas: true, comandas: { include: { itens: true } } },
    });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });

    const relatorio = _montarRelatorio(sessao);
    const totalAssados = relatorio.totalAssados;
    const totalNormal  = relatorio.totalNormal;

    if (lancarNoCaixa && totalAssados > 0) {
      await prisma.caixaOperacao.create({
        data: {
          tenantId, tipo: 'ENTRADA', valor: totalAssados,
          observacao: `Assados - Sessao #${sessao.id}`, data: new Date(),
        },
      });
    }

    await prisma.sessaoAssados.update({
      where: { id: sessao.id },
      data: { status: 'FECHADA', fechadoEm: new Date(), totalAssados, totalNormal },
    });

    res.json({ ok: true, relatorio });
  } catch (e) {
    console.error('[assados:fecharSessao]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Produtos do módulo Assados ────────────────────────────────

exports.adicionarProduto = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });
    const { nome, preco, unidade, estoqueInicial, codigoBarras, emoji, produtoOrigemId } = req.body;
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
        produtoOrigemId: toInt(produtoOrigemId) || null,
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
        ...(nome             && { nome: nome.trim() }),
        ...(preco            && { preco: toFloat(preco) }),
        ...(unidade          && { unidade }),
        ...(estoqueAtual !== undefined && { estoqueAtual: toFloat(estoqueAtual) || 0 }),
        ...(codigoBarras !== undefined && { codigoBarras: codigoBarras || null }),
        ...(emoji            && { emoji }),
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

// ── Busca de produtos normais (para adicionar em comandas) ────

exports.buscarProdutoNormal = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    const produtos = await prisma.produto.findMany({
      where: { tenantId, ativo: true, nome: { contains: q } },
      take: 12,
      orderBy: { nome: 'asc' },
    });
    res.json(produtos);
  } catch (e) {
    console.error('[assados:buscarNormal]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Helpers internos ──────────────────────────────────────────

async function _descontarEstoqueNormal(tenantId, produtoId, quantidade) {
  const p = await prisma.produto.findFirst({ where: { id: produtoId, tenantId, ativo: true } });
  if (!p) return null;
  const novoEstoque = Math.max(0, p.estoqueAtual - quantidade);
  await prisma.produto.update({ where: { id: p.id }, data: { estoqueAtual: novoEstoque } });
  if (p.unidade === 'KG') {
    await prisma.estoque.upsert({
      where: { nomeCorte_tenantId: { nomeCorte: p.nome, tenantId } },
      update: { pesoKg: novoEstoque },
      create: { nomeCorte: p.nome, pesoKg: novoEstoque, tenantId },
    });
  }
  return p;
}

async function _devolverEstoqueNormal(tenantId, produtoId, quantidade) {
  const p = await prisma.produto.findFirst({ where: { id: produtoId, tenantId } });
  if (!p) return;
  const novoEstoque = p.estoqueAtual + quantidade;
  await prisma.produto.update({ where: { id: p.id }, data: { estoqueAtual: novoEstoque } });
  if (p.unidade === 'KG') {
    await prisma.estoque.upsert({
      where: { nomeCorte_tenantId: { nomeCorte: p.nome, tenantId } },
      update: { pesoKg: novoEstoque },
      create: { nomeCorte: p.nome, pesoKg: novoEstoque, tenantId },
    });
  }
}

async function _recalcularTotaisComanda(comandaId) {
  const itens = await prisma.itemComandaAssado.findMany({ where: { comandaId } });
  let totalAssados = 0, totalNormal = 0;
  for (const i of itens) {
    if (i.tipo === 'NORMAL') totalNormal += i.total;
    else totalAssados += i.total;
  }
  await prisma.comandaAssado.update({
    where: { id: comandaId },
    data: { totalAssados, totalNormal, total: totalAssados + totalNormal },
  });
}

// ── Comandas / Reservas ───────────────────────────────────────

exports.criarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });
    const { nomeCliente, telefone, pago, observacoes, itens } = req.body;
    if (!nomeCliente?.trim()) return res.status(400).json({ erro: 'Nome do cliente obrigatorio.' });

    let totalAssados = 0;
    let totalNormal  = 0;
    const itensData = [];

    if (itens?.length) {
      for (const item of itens) {
        const tipo = item.tipo || 'ASSADO';

        if (tipo === 'NORMAL') {
          // Produto normal: desconta do estoque do açougue imediatamente
          const qtd   = toFloat(item.quantidade) || 1;
          const preco = toFloat(item.preco) || 0;
          const total = toFloat(item.total) || preco * qtd;

          if (item.produtoNormalId) {
            await _descontarEstoqueNormal(tenantId, toInt(item.produtoNormalId), qtd);
          }
          totalNormal += total;
          itensData.push({
            produtoNormalId: toInt(item.produtoNormalId) || null,
            nome: item.nome, preco, quantidade: qtd,
            unidade: item.unidade || 'UN',
            total, tipo: 'NORMAL',
          });
        } else {
          // Assado: desconta unidade do estoque de assados
          const produto = await prisma.produtoAssado.findFirst({ where: { id: toInt(item.produtoId), tenantId } });
          if (!produto) continue;
          const qtd = toFloat(item.quantidade) || 1;
          // KG: valor recalculado no pagamento. UN: valor fixo aqui.
          const itemTotal = produto.unidade === 'UN' ? produto.preco * qtd : 0;
          totalAssados += itemTotal;
          await prisma.produtoAssado.update({
            where: { id: produto.id },
            data: { estoqueAtual: Math.max(0, produto.estoqueAtual - qtd) },
          });
          itensData.push({
            produtoAssadoId: produto.id,
            nome: produto.nome, preco: produto.preco,
            quantidade: qtd, unidade: produto.unidade,
            total: itemTotal, tipo: 'ASSADO',
          });
        }
      }
    }

    const total = totalAssados + totalNormal;
    const comanda = await prisma.comandaAssado.create({
      data: {
        sessaoId: sessao.id, tenantId,
        nomeCliente: nomeCliente.trim(),
        telefone: telefone || null,
        pago: !!pago,
        status: pago ? 'PAGO' : 'RESERVADO',
        total, totalAssados, totalNormal,
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
    const itemTotal = produto.unidade === 'UN' ? produto.preco * qtd : 0;

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

    await _recalcularTotaisComanda(comandaId);
    const updated = await prisma.comandaAssado.findFirst({ where: { id: comandaId }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:adicionarItem]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.adicionarItemNormalComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const comandaId = toInt(req.params.id);
    const { produtoNormalId, quantidade } = req.body;

    const comanda = await prisma.comandaAssado.findFirst({ where: { id: comandaId, tenantId } });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada.' });

    const produto = await prisma.produto.findFirst({ where: { id: toInt(produtoNormalId), tenantId, ativo: true } });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    const qtd = toFloat(quantidade) || 1;
    const itemTotal = produto.precoVenda * qtd;

    // Desconta do estoque do açougue imediatamente
    await _descontarEstoqueNormal(tenantId, produto.id, qtd);

    await prisma.itemComandaAssado.create({
      data: {
        comandaId, produtoNormalId: produto.id,
        nome: produto.nome, preco: produto.precoVenda,
        quantidade: qtd, unidade: produto.unidade || 'UN',
        total: itemTotal, tipo: 'NORMAL',
      },
    });

    await _recalcularTotaisComanda(comandaId);
    const updated = await prisma.comandaAssado.findFirst({ where: { id: comandaId }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:adicionarItemNormal]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

exports.removerItemComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const itemId = toInt(req.params.itemId);
    const item = await prisma.itemComandaAssado.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ erro: 'Item nao encontrado.' });

    // Devolve ao estoque correto
    if (item.tipo === 'NORMAL' && item.produtoNormalId) {
      await _devolverEstoqueNormal(tenantId, item.produtoNormalId, item.quantidade);
    } else if (item.produtoAssadoId) {
      await prisma.produtoAssado.updateMany({
        where: { id: item.produtoAssadoId, tenantId },
        data: { estoqueAtual: { increment: item.quantidade } },
      });
    }

    await prisma.itemComandaAssado.delete({ where: { id: itemId } });
    await _recalcularTotaisComanda(item.comandaId);

    const updated = await prisma.comandaAssado.findFirst({ where: { id: item.comandaId }, include: { itens: true } });
    res.json(updated);
  } catch (e) {
    console.error('[assados:removerItem]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

/**
 * Finaliza pagamento da comanda.
 * Para itens KG (assados): recebe peso real, desconta açougue por peso.
 * Para itens UN (assados, frango): desconta 1 unidade do açougue.
 * Para itens NORMAL: já foram descontados ao adicionar. Apenas contabiliza.
 *
 * Lança no caixa principal o valor dos itens normais (totalNormal).
 *
 * Body: { formaPagamento, itensComPeso: [{itemId, pesoKg}] }
 */
exports.pagarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);
    const { formaPagamento, itensComPeso } = req.body;

    const comanda = await prisma.comandaAssado.findFirst({
      where: { id, tenantId },
      include: { itens: true },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada.' });
    if (comanda.pago) return res.status(400).json({ erro: 'Comanda ja paga.' });

    let totalAssados = 0;
    let totalNormal  = 0;
    const itensNormaisParaCaixa = [];

    for (const item of comanda.itens) {

      if (item.tipo === 'NORMAL') {
        // Já foi descontado ao adicionar. Só contabiliza.
        totalNormal += item.total;
        itensNormaisParaCaixa.push({
          produtoId: item.produtoNormalId,
          nome: item.nome,
          quantidade: item.quantidade,
          preco: item.preco,
          total: item.total,
          unidade: item.unidade,
        });
        continue;
      }

      // Itens ASSADO
      const pesoInfo = itensComPeso?.find(i => toInt(i.itemId) === item.id);
      const pesoKg   = pesoInfo?.pesoKg ? toFloat(pesoInfo.pesoKg) : null;
      let itemTotal  = item.total;

      if (item.unidade === 'KG' && pesoKg) {
        itemTotal = item.preco * pesoKg;
        // Desconta KG do açougue
        if (item.produtoAssadoId) {
          const prodAssado = await prisma.produtoAssado.findFirst({ where: { id: item.produtoAssadoId } });
          if (prodAssado?.produtoOrigemId) {
            await prisma.produto.update({
              where: { id: prodAssado.produtoOrigemId },
              data: { estoqueAtual: { decrement: pesoKg } },
            }).catch(() => {});
          }
        }
        await prisma.itemComandaAssado.update({
          where: { id: item.id },
          data: { pesoKg, total: itemTotal, quantidade: pesoKg },
        });
      } else if (item.unidade === 'UN') {
        // Frango ou item por unidade: desconta 1 unidade do açougue
        if (item.produtoAssadoId) {
          const prodAssado = await prisma.produtoAssado.findFirst({ where: { id: item.produtoAssadoId } });
          if (prodAssado?.produtoOrigemId) {
            await prisma.produto.update({
              where: { id: prodAssado.produtoOrigemId },
              data: { estoqueAtual: { decrement: item.quantidade } },
            }).catch(() => {});
          }
        }
      }

      totalAssados += itemTotal;
    }

    const totalFinal = totalAssados + totalNormal;

    await prisma.comandaAssado.update({
      where: { id },
      data: {
        pago: true,
        status: 'PAGO',
        formaPagamento: formaPagamento || 'DINHEIRO',
        total: totalFinal,
        totalAssados,
        totalNormal,
      },
    });

    // Lança itens normais no caixa principal
    if (totalNormal > 0) {
      await prisma.caixa.create({
        data: {
          tenantId, data: new Date(),
          valorTotal: totalNormal,
          itensJson: JSON.stringify(itensNormaisParaCaixa),
          formaPagamento: formaPagamento || 'DINHEIRO',
          valorPago: totalNormal,
          troco: 0,
        },
      });
    }

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

exports.cancelarComanda = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = toInt(req.params.id);

    const comanda = await prisma.comandaAssado.findFirst({
      where: { id, tenantId },
      include: { itens: true },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada.' });
    if (comanda.pago) return res.status(400).json({ erro: 'Comanda ja paga, nao pode cancelar.' });

    // Devolve TUDO ao estoque correto
    for (const item of comanda.itens) {
      if (item.tipo === 'NORMAL' && item.produtoNormalId) {
        await _devolverEstoqueNormal(tenantId, item.produtoNormalId, item.quantidade);
      } else if (item.produtoAssadoId) {
        await prisma.produtoAssado.updateMany({
          where: { id: item.produtoAssadoId, tenantId },
          data: { estoqueAtual: { increment: item.quantidade } },
        });
      }
    }

    await prisma.comandaAssado.update({ where: { id }, data: { status: 'CANCELADO' } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[assados:cancelarComanda]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Venda Direta ──────────────────────────────────────────────

exports.buscarProdutoScan = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { codigo } = req.params;
    const sessao = await prisma.sessaoAssados.findFirst({ where: { tenantId, status: 'ABERTA' } });

    if (sessao) {
      const prodAssado = await prisma.produtoAssado.findFirst({
        where: { sessaoId: sessao.id, tenantId, codigoBarras: codigo },
      });
      if (prodAssado) return res.json({ tipo: 'ASSADO', produto: prodAssado });
    }

    let prodNormal = await prisma.produto.findFirst({ where: { codigoBarras: codigo, tenantId, ativo: true } });
    if (!prodNormal && /^2\d{12}$/.test(codigo)) {
      const codCurto = parseInt(codigo.substring(1, 7), 10).toString();
      prodNormal = await prisma.produto.findFirst({
        where: { tenantId, ativo: true, codigoBarras: { in: [codCurto, codigo.substring(1, 7)] } },
      });
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
        if (item.produtoAssadoId) {
          const p = await prisma.produtoAssado.findFirst({ where: { id: item.produtoAssadoId, tenantId } });
          if (p) {
            await prisma.produtoAssado.update({
              where: { id: p.id },
              data: { estoqueAtual: Math.max(0, p.estoqueAtual - item.quantidade) },
            });
            if (p.produtoOrigemId) {
              const decremento = p.unidade === 'KG' ? (toFloat(item.pesoKg) || item.quantidade) : item.quantidade;
              await prisma.produto.update({
                where: { id: p.produtoOrigemId },
                data: { estoqueAtual: { decrement: decremento } },
              }).catch(() => {});
            }
          }
        }
      } else {
        totalNormal += item.total;
        itensNormais.push(item);
        if (item.produtoNormalId) {
          await _descontarEstoqueNormal(tenantId, item.produtoNormalId, item.quantidade);
        }
      }
    }

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

// ── Resumo / Relatório ────────────────────────────────────────

exports.resumoSessao = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const sessao = await prisma.sessaoAssados.findFirst({
      where: { tenantId, status: 'ABERTA' },
      include: { vendasDiretas: true, comandas: { include: { itens: true } }, produtos: true },
    });
    if (!sessao) return res.status(404).json({ erro: 'Nenhuma sessao aberta.' });
    res.json(_montarRelatorio(sessao));
  } catch (e) {
    console.error('[assados:resumo]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

function _montarRelatorio(sessao) {
  const produtosMap = {};

  const _addItem = (item) => {
    if (item.tipo === 'NORMAL') return; // relatório só de assados
    const key = item.nome;
    if (!produtosMap[key]) {
      produtosMap[key] = { nome: item.nome, unidade: item.unidade, totalKg: 0, totalUn: 0, receita: 0, qtdComandas: 0, precoMedio: 0 };
    }
    const p = produtosMap[key];
    if (item.unidade === 'UN') p.totalUn += item.quantidade;
    else                       p.totalKg += item.pesoKg || item.quantidade;
    p.receita     += item.total;
    p.qtdComandas += 1;
  };

  for (const comanda of sessao.comandas.filter(c => c.pago)) {
    for (const item of comanda.itens) _addItem(item);
  }
  for (const venda of sessao.vendasDiretas) {
    let itens = [];
    try { itens = JSON.parse(venda.itensJson || '[]'); } catch {}
    for (const item of itens.filter(i => i.tipo === 'ASSADO')) {
      _addItem({
        nome: item.nome, unidade: item.unidade || 'KG',
        quantidade: item.quantidade || 0, pesoKg: item.pesoKg || null,
        total: item.total || 0, tipo: 'ASSADO',
      });
    }
  }

  for (const p of Object.values(produtosMap)) {
    if (p.unidade === 'KG' && p.totalKg > 0) p.precoMedio = +(p.receita / p.totalKg).toFixed(2);
  }

  const totalAssados = sessao.vendasDiretas.reduce((s, v) => s + v.totalAssados, 0)
    + sessao.comandas.filter(c => c.pago).reduce((s, c) => s + (c.totalAssados || c.total), 0);
  const totalNormal  = sessao.vendasDiretas.reduce((s, v) => s + v.totalNormal, 0)
    + sessao.comandas.filter(c => c.pago).reduce((s, c) => s + (c.totalNormal || 0), 0);

  const pagamentos = {};
  for (const c of sessao.comandas.filter(c => c.pago)) {
    const fp = c.formaPagamento || 'DINHEIRO';
    pagamentos[fp] = (pagamentos[fp] || 0) + (c.totalAssados || c.total);
  }
  for (const v of sessao.vendasDiretas) {
    const fp = v.formaPagamento || 'DINHEIRO';
    pagamentos[fp] = (pagamentos[fp] || 0) + v.totalAssados;
  }

  const estoqueRestante = sessao.produtos
    .filter(p => p.estoqueAtual > 0)
    .map(p => ({ nome: p.nome, quantidade: p.estoqueAtual, unidade: p.unidade, emoji: p.emoji }));

  const totalComandas = sessao.comandas.filter(c => c.pago).length + sessao.vendasDiretas.length;
  const ticketMedio   = totalComandas > 0 ? +((totalAssados) / totalComandas).toFixed(2) : 0;
  const duracaoMin    = sessao.fechadoEm
    ? Math.round((new Date(sessao.fechadoEm) - new Date(sessao.abertoEm)) / 60000)
    : Math.round((new Date() - new Date(sessao.abertoEm)) / 60000);

  return {
    sessaoId: sessao.id, abertoEm: sessao.abertoEm,
    totalAssados: +totalAssados.toFixed(2),
    totalNormal:  +totalNormal.toFixed(2),
    totalGeral:   +(totalAssados + totalNormal).toFixed(2),
    totalComandas, ticketMedio, duracaoMin, pagamentos,
    porProduto: Object.values(produtosMap).sort((a, b) => b.receita - a.receita),
    estoqueRestante,
    qtdVendas:   sessao.vendasDiretas.length,
    qtdComandas: sessao.comandas.filter(c => c.pago).length,
  };
}
