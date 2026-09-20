const prisma = require('../lib/prisma');
const { inicioDia } = require('../lib/dateUtils');
const { toFloat, toInt, getTenantId } = require('../lib/validate');

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
      const atualizada = await prisma.comanda.findUnique({ where: { id: comanda.id }, include: { itens: { orderBy: { criadoEm: 'asc' } } } });
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

    if (isUN && produto.estoqueAtual < qtd)
      return res.status(400).json({ erro: `Estoque insuficiente: ${produto.nome}. Disponivel: ${produto.estoqueAtual} un` });

    const ops = [
      prisma.itemComanda.create({ data: { comandaId: comanda.id, produtoId: produto.id, nome: produto.nome, precoKg: precoUnitarioItem, pesoKg: qtd, total } }),
      prisma.comanda.update({ where: { id: comanda.id }, data: { total: { increment: total } } }),
    ];

    if (isUN) {
      ops.push(prisma.produto.update({ where: { id: produto.id }, data: { estoqueAtual: { decrement: qtd } } }));
    } else {
      const estoque = await prisma.estoque.findUnique({ where: { nomeCorte_tenantId: { nomeCorte: produto.nome, tenantId } } });
      if (estoque) ops.push(prisma.estoque.update({ where: { id: estoque.id }, data: { pesoKg: { decrement: qtd } } }));
    }

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

    const isDiversos = item.produto?.codigoBarras === '999' || item.produto?.nome === 'Diversos';
    if (!isDiversos) {
      if (item.produto?.unidade === 'UN') {
        ops.push(prisma.produto.update({ where: { id: item.produtoId }, data: { estoqueAtual: { increment: item.pesoKg } } }));
      } else {
        const estoque = await prisma.estoque.findUnique({ where: { nomeCorte_tenantId: { nomeCorte: item.nome, tenantId } } });
        if (estoque) ops.push(prisma.estoque.update({ where: { id: estoque.id }, data: { pesoKg: { increment: item.pesoKg } } }));
      }
    }

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
    const { formaPagamento = 'DINHEIRO', valorPago = 0 } = req.body;
    const comanda = await prisma.comanda.findFirst({
      where: { id: toInt(req.params.id), tenantId, status: 'ABERTA' },
      include: { itens: { include: { produto: true } } },
    });
    if (!comanda) return res.status(404).json({ erro: 'Comanda nao encontrada ou fechada.' });
    if (comanda.itens.length === 0) return res.status(400).json({ erro: 'Comanda sem itens.' });

    const isVoucher = formaPagamento === 'VOUCHER';

    // Se pagar com VOUCHER, a promocao sai e o que vale e o precoVenda normal
    let totalCobrado = 0;
    const itensFinalizados = comanda.itens.map(i => {
      const isDiversos = i.produto?.codigoBarras === '999' || i.produto?.nome === 'Diversos';
      let precoUnitario = i.precoKg;
      if (isVoucher && !isDiversos && i.produto?.precoVenda > 0) {
        precoUnitario = i.produto.precoVenda;
      }
      const totalItem = +(i.pesoKg * precoUnitario).toFixed(2);
      totalCobrado += totalItem;
      return {
        nome: i.nome,
        peso: i.pesoKg,
        precoKg: precoUnitario,
        total: totalItem,
        unidade: i.produto?.unidade || 'KG',
        quantidade: i.pesoKg,
      };
    });
    totalCobrado = +totalCobrado.toFixed(2);

    const vp = toFloat(valorPago) || totalCobrado;
    const troco = formaPagamento === 'DINHEIRO' ? Math.max(0, vp - totalCobrado) : 0;

    await prisma.$transaction([
      prisma.caixa.create({
        data: {
          data: inicioDia(),
          valorTotal: totalCobrado,
          itensJson: JSON.stringify(itensFinalizados),
          formaPagamento,
          valorPago: vp,
          troco,
          tenantId,
        },
      }),
      prisma.comanda.update({
        where: { id: comanda.id },
        data: { status: 'FECHADA', fechadaEm: new Date(), total: totalCobrado }
      }),
    ]);
    res.json({ mensagem: 'Comanda fechada.', total: totalCobrado, troco });
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

    // Estorna estoque dos itens UN consumidos
    for (const item of comanda.itens) {
      const isDiversos = item.produto?.codigoBarras === '999' || item.produto?.nome === 'Diversos';
      if (!isDiversos && item.produto?.unidade === 'UN') {
        await prisma.produto.updateMany({
          where: { id: item.produtoId, tenantId },
          data: { estoqueAtual: { increment: item.pesoKg } },
        });
      }
    }

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
