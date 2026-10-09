const prisma = require('../lib/prisma');
const { inicioDia } = require('../lib/dateUtils');
const { toFloat, toInt, getTenantId } = require('../lib/validate');
const { emitirNfceParaVenda } = require('../services/nfceService');

exports.listar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { ordem = 'desc' } = req.query;
    const comandas = await prisma.comanda.findMany({
      where: { tenantId, status: 'ABERTA' },
      include: { itens: { include: { produto: true }, orderBy: { criadoEm: 'asc' } } },
      orderBy: { criadaEm: ordem === 'asc' ? 'asc' : 'desc' },
    });
    res.json(comandas);
  } catch (e) {
    console.error('[comanda:listar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao listar.' });
  }
};

exports.criar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { nomeCliente, numeroMesa } = req.body;
    if (!nomeCliente?.trim()) return res.status(400).json({ erro: 'Nome do cliente obrigatorio.' });
    const mesa = toInt(numeroMesa) || 0;

    const comanda = await prisma.comanda.create({
      data: { nomeCliente: nomeCliente.trim(), numeroMesa: mesa, tenantId },
      include: { itens: { include: { produto: true } } },
    });
    res.status(201).json(comanda);
  } catch (e) {
    console.error('[comanda:criar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao criar.' });
  }
};

exports.buscar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const comanda = await prisma.comanda.findFirst({
      where: { id: toInt(req.params.id), tenantId },
      include: { itens: { include: { produto: true }, orderBy: { criadoEm: 'asc' } } },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada.' });
    res.json(comanda);
  } catch (e) {
    console.error('[comanda:buscar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar.' });
  }
};

exports.adicionarItem = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { produtoId, pesoKg, isDiversos, nome: nomeCustom, precoUnitario, precoKg: precoKgBody } = req.body;
    const qtd = toFloat(pesoKg) || toFloat(req.body.qtd);
    const pId = toInt(produtoId);

    const comanda = await prisma.comanda.findFirst({ where: { id: toInt(req.params.id), tenantId, status: 'ABERTA' } });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada ou fechada.' });

    // Se for item avulso / diversos (999)
    if (isDiversos || pId === 999) {
      const preco = toFloat(precoUnitario) || toFloat(precoKgBody);
      if (!preco || preco <= 0) return res.status(400).json({ erro: 'Valor unitario invalido.' });
      const quantidade = (!qtd || qtd <= 0) ? 1 : qtd;
      const total = +(preco * quantidade).toFixed(2);
      const nomeItem = (nomeCustom && String(nomeCustom).trim()) || 'Diversos';

      // Localiza ou cria produto generico "Diversos" para o tenant
      let produtoDiversos = await prisma.produto.findFirst({
        where: { tenantId, OR: [{ codigoBarras: '999' }, { nome: 'Diversos' }] }
      });
      if (!produtoDiversos) {
        produtoDiversos = await prisma.produto.create({
          data: {
            nome: 'Diversos',
            precoVenda: 0,
            unidade: 'UN',
            categoria: 'Diversos',
            codigoBarras: '999',
            tenantId,
            ativo: true,
            estoqueAtual: 999999,
          }
        });
      }

      const ops = [
        prisma.itemComanda.create({
          data: {
            comandaId: comanda.id,
            produtoId: produtoDiversos.id,
            nome: nomeItem,
            precoKg: preco,
            pesoKg: quantidade,
            total,
          }
        }),
        prisma.comanda.update({ where: { id: comanda.id }, data: { total: { increment: total } } }),
      ];

      await prisma.$transaction(ops);
      const atualizada = await prisma.comanda.findUnique({
        where: { id: comanda.id },
        include: { itens: { include: { produto: true }, orderBy: { criadoEm: 'asc' } } }
      });
      return res.status(201).json(atualizada);
    }

    if (!pId || !qtd || qtd <= 0) return res.status(400).json({ erro: 'Produto e quantidade validos obrigatorios.' });

    const produto = await prisma.produto.findFirst({ where: { id: pId, tenantId, ativo: true } });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    const isUN = produto.unidade === 'UN';
    const precoUnitarioItem = (produto.precoPromocao && produto.precoPromocao > 0)
      ? produto.precoPromocao
      : produto.precoVenda;
    const total = +(qtd * precoUnitarioItem).toFixed(2);

    const ops = [
      prisma.itemComanda.create({ data: { comandaId: comanda.id, produtoId: produto.id, nome: produto.nome, precoKg: precoUnitarioItem, pesoKg: qtd, total } }),
      prisma.comanda.update({ where: { id: comanda.id }, data: { total: { increment: total } } }),
    ];

    await prisma.$transaction(ops);
    const atualizada = await prisma.comanda.findUnique({
      where: { id: comanda.id },
      include: { itens: { include: { produto: true }, orderBy: { criadoEm: 'asc' } } }
    });
    res.status(201).json(atualizada);
  } catch (e) {
    console.error('[comanda:addItem]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao adicionar item.' });
  }
};

exports.removerItem = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const item = await prisma.itemComanda.findFirst({
      where: { id: toInt(req.params.itemId), comandaId: toInt(req.params.id) },
      include: { produto: true },
    });
    if (!item) return res.status(404).json({ erro: 'Item nao encontrado.' });

    const ops = [
      prisma.itemComanda.delete({ where: { id: item.id } }),
      prisma.comanda.update({ where: { id: toInt(req.params.id) }, data: { total: { decrement: item.total } } }),
    ];

    await prisma.$transaction(ops);
    res.json({ mensagem: 'Item removido.' });
  } catch (e) {
    console.error('[comanda:remItem]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao remover item.' });
  }
};

exports.fechar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { formaPagamento = 'DINHEIRO', valorPago = 0, pagamentos, emitirNfce, cpfDestinatario } = req.body;
    const comanda = await prisma.comanda.findFirst({
      where: { id: toInt(req.params.id), tenantId, status: 'ABERTA' },
      include: { itens: { include: { produto: true }, orderBy: { criadoEm: 'asc' } } },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada ou fechada.' });
    if (comanda.itens.length === 0) return res.status(400).json({ erro: 'Comanda sem itens.' });

    const isVoucherAtivo = (!pagamentos?.length && formaPagamento === 'VOUCHER') ||
      (Array.isArray(pagamentos) && pagamentos.some(p => p.forma === 'VOUCHER'));

    // Se pagar com VOUCHER (único ou em divisão), os itens em promoção voltam ao preço de venda normal
    let totalCobrado = 0;
    const itensFinalizados = comanda.itens.map(i => {
      const isDiversos = i.produto?.codigoBarras === '999' || i.produto?.nome === 'Diversos' || i.nome?.toLowerCase().includes('diversos');
      let precoUnitario = i.precoKg;
      if (isVoucherAtivo && !isDiversos && i.produto?.precoVenda > 0) {
        precoUnitario = i.produto.precoVenda;
      }
      const totalItem = +(i.pesoKg * precoUnitario).toFixed(2);
      totalCobrado += totalItem;
      return {
        id: i.produtoId,
        produtoId: i.produtoId,
        nome: i.nome,
        peso: i.pesoKg,
        precoKg: precoUnitario,
        total: totalItem,
        unidade: i.produto?.unidade || 'KG',
        quantidade: i.pesoKg,
        criadoEm: i.criadoEm,
      };
    });
    totalCobrado = +totalCobrado.toFixed(2);

    let finalForma = formaPagamento;
    let finalPagamentosJson = null;
    let vp = 0;
    let troco = 0;

    if (Array.isArray(pagamentos) && pagamentos.length > 0) {
      finalForma = 'MULTIPLO';
      finalPagamentosJson = JSON.stringify(pagamentos);
      vp = pagamentos.reduce((acc, p) => acc + (toFloat(p.valorPago) || toFloat(p.valor) || 0), 0);
      const somaDinheiro = pagamentos
        .filter(p => p.forma === 'DINHEIRO')
        .reduce((acc, p) => {
          const vP = toFloat(p.valorPago);
          const v = toFloat(p.valor);
          return acc + (vP > v ? vP - v : 0);
        }, 0);
      troco = somaDinheiro;
    } else {
      if (!['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'VOUCHER'].includes(formaPagamento))
        return res.status(400).json({ erro: 'Forma de pagamento invalida.' });
      vp = toFloat(valorPago) || totalCobrado;
      troco = formaPagamento === 'DINHEIRO' ? Math.max(0, vp - totalCobrado) : 0;
      finalPagamentosJson = JSON.stringify([{ forma: formaPagamento, valor: totalCobrado, valorPago: vp, troco }]);
    }

    // Controle de estoque exclusivo para Assados (sessão aberta)
    const ops = [];
    for (const item of itensFinalizados) {
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
      valorTotal: totalCobrado,
      itensJson: JSON.stringify(itensFinalizados),
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
        delete vendaData.pagamentosJson;
        novaVenda = await prisma.caixa.create({ data: vendaData });
      } else {
        throw createErr;
      }
    }

    await prisma.comanda.update({
      where: { id: comanda.id },
      data: { status: 'FECHADA', fechadaEm: new Date(), total: totalCobrado }
    });

    let nfceResultado = null;
    if (emitirNfce) {
      try {
        const pagamentosArr = Array.isArray(pagamentos) && pagamentos.length > 0
          ? pagamentos
          : [{ forma: finalForma, valor: totalCobrado, valorPago: vp, troco }];

        nfceResultado = await emitirNfceParaVenda({
          tenantId,
          vendaId: novaVenda.id,
          caixaId: novaVenda.id,
          itens: itensFinalizados,
          total: totalCobrado,
          pagamentos: pagamentosArr,
          troco,
          cpfDestinatario: cpfDestinatario || null,
        });
      } catch (nfceErr) {
        console.error('[comanda:fechar:nfce]', nfceErr.message);
        nfceResultado = { erro: nfceErr.message };
      }
    }

    res.json({
      mensagem: 'Comanda fechada com sucesso.',
      total: totalCobrado,
      troco,
      vendaId: novaVenda.id,
      nfce: nfceResultado,
    });
  } catch (e) {
    console.error('[comanda:fechar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao fechar comanda.' });
  }
};

exports.fecharSemCobrar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const comanda = await prisma.comanda.findFirst({
      where: { id: toInt(req.params.id), tenantId, status: 'ABERTA' },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada ou ja fechada.' });

    await prisma.comanda.update({
      where: { id: comanda.id },
      data: { status: 'FECHADA', fechadaEm: new Date() },
    });

    res.json({ mensagem: 'Comanda fechada sem cobranca.' });
  } catch (e) {
    console.error('[comanda:fecharSemCobrar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao fechar comanda.' });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const comanda = await prisma.comanda.findFirst({
      where: { id: toInt(req.params.id), tenantId, status: 'ABERTA' },
      include: { itens: { include: { produto: true } } },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada ou ja fechada.' });


    // Deleta itens e cancela a comanda
    await prisma.itemComanda.deleteMany({ where: { comandaId: comanda.id } });
    await prisma.comanda.update({
      where: { id: comanda.id },
      data: { status: 'CANCELADA', fechadaEm: new Date(), total: 0 },
    });

    res.json({ mensagem: 'Comanda cancelada.' });
  } catch (e) {
    console.error('[comanda:cancelar]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao cancelar comanda.' });
  }
};
