const prisma = require('../lib/prisma');
const desossaService = require('../services/desossaService');
const { getTenantId } = require('../lib/validate');

// ── Lista todos os templates ──────────────────────────────────
exports.listarTemplates = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const templates = await prisma.desossaTemplate.findMany({
      where: { tenantId },
      include: { cortes: { orderBy: { nomeCorte: 'asc' } } },
      orderBy: { ultimaVez: { sort: 'desc', nulls: 'last' } },
    });
    res.json(templates);
  } catch (e) {
    console.error('[desossa:listar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Cria template vazio ───────────────────────────────────────
exports.criarTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { nome } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatorio.' });

    const existe = await prisma.desossaTemplate.findUnique({
      where: { nome_tenantId: { nome: nome.trim(), tenantId } },
    });
    if (existe) return res.status(400).json({ erro: 'Ja existe uma desossa com esse nome.' });

    const template = await prisma.desossaTemplate.create({
      data: { tenantId, nome: nome.trim() },
      include: { cortes: true },
    });
    res.json(template);
  } catch (e) {
    console.error('[desossa:criar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Deleta template ───────────────────────────────────────────
exports.deletarTemplate = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const id = parseInt(req.params.id);
    await prisma.desossaTemplate.deleteMany({ where: { id, tenantId } });
    res.json({ ok: true });
  } catch (e) {
    console.error('[desossa:deletar]', e.message);
    res.status(500).json({ erro: e.message });
  }
};

// ── Calcula sem salvar ────────────────────────────────────────
exports.calcularDesossa = (req, res) => {
  try {
    const pesoEntrada = parseFloat(req.body.pesoEntrada);
    const custoKg     = parseFloat(req.body.custoKg);
    const cortes      = req.body.cortes;

    if (!pesoEntrada || pesoEntrada <= 0) return res.status(400).json({ erro: 'Peso de entrada invalido.' });
    if (!custoKg     || custoKg <= 0)     return res.status(400).json({ erro: 'Custo por kg invalido.' });
    if (!Array.isArray(cortes) || cortes.length === 0) return res.status(400).json({ erro: 'Adicione pelo menos um corte.' });

    const cortesNorm = cortes.map(c => ({
      nome:         c.nome || c.nomeCorte,
      pesoKg:       parseFloat(c.pesoKg)       || 0,
      precoVendaKg: parseFloat(c.precoVendaKg) || 0,
    }));

    const resultado = desossaService.calcularRendimento(pesoEntrada, custoKg, cortesNorm);
    res.json(resultado);
  } catch (e) {
    console.error('[desossa:calcular]', e.message);
    res.status(500).json({ erro: 'Erro ao calcular desossa: ' + e.message });
  }
};

// ── Registra desossa: salva template + atualiza estoque ───────
exports.registrarDesossa = async (req, res) => {
  try {
    const tenantId   = getTenantId(req);
    const templateId = parseInt(req.params.id);
    const { pesoEntrada, custoKg, cortes } = req.body;

    const pesoNum  = parseFloat(pesoEntrada);
    const custoNum = parseFloat(custoKg);

    if (!pesoNum  || pesoNum  <= 0) return res.status(400).json({ erro: 'Peso de entrada invalido.' });
    if (!custoNum || custoNum <= 0) return res.status(400).json({ erro: 'Custo por kg invalido.' });
    if (!Array.isArray(cortes) || cortes.length === 0) return res.status(400).json({ erro: 'Adicione pelo menos um corte.' });

    const template = await prisma.desossaTemplate.findFirst({ where: { id: templateId, tenantId } });
    if (!template) return res.status(404).json({ erro: 'Template nao encontrado.' });

    const cortesNorm = cortes.map(c => ({
      nome:         (c.nome || c.nomeCorte || '').trim(),
      pesoKg:       parseFloat(c.pesoKg)       || 0,
      precoVendaKg: parseFloat(c.precoVendaKg) || 0,
      validade:     c.validade ? new Date(c.validade) : null,
    })).filter(c => c.nome && c.pesoKg > 0);

    // Calcula resultado
    const resultado = desossaService.calcularRendimento(
      pesoNum, custoNum,
      cortesNorm.map(c => ({ nome: c.nome, pesoKg: c.pesoKg, precoVendaKg: c.precoVendaKg }))
    );

    // Atualiza template com novos valores (salva pra próxima vez)
    await prisma.desossaCorteTemplate.deleteMany({ where: { templateId } });
    await prisma.desossaTemplate.update({
      where: { id: templateId },
      data: {
        pesoEntrada: pesoNum,
        custoKg:     custoNum,
        vezes:       { increment: 1 },
        ultimaVez:   new Date(),
        cortes: {
          create: cortesNorm.map(c => ({
            nomeCorte:    c.nome,
            pesoKg:       c.pesoKg,
            precoVendaKg: c.precoVendaKg,
            validade:     c.validade,
          })),
        },
      },
    });

    // Atualiza estoque e produtos
    for (const corte of cortesNorm) {
      const corteResult = resultado.cortes.find(r => r.nome === corte.nome);
      const precoVenda  = corte.precoVendaKg;

      // Estoque
      await prisma.estoque.upsert({
        where: { nomeCorte_tenantId: { nomeCorte: corte.nome, tenantId } },
        update: { pesoKg: { increment: corte.pesoKg }, validade: corte.validade || undefined },
        create: { nomeCorte: corte.nome, pesoKg: corte.pesoKg, tenantId, validade: corte.validade },
      });

      // Produto
      const prodExiste = await prisma.produto.findFirst({ where: { nome: corte.nome, tenantId } });
      if (prodExiste) {
        await prisma.produto.update({
          where: { id: prodExiste.id },
          data: {
            precoVenda:   precoVenda > 0 ? precoVenda : prodExiste.precoVenda,
            custo:        corteResult?.custoRateado ? corteResult.custoRateado / corte.pesoKg : prodExiste.custo,
            estoqueAtual: { increment: corte.pesoKg },
          },
        });
      } else {
        await prisma.produto.create({
          data: {
            nome:        corte.nome,
            precoVenda:  precoVenda > 0 ? precoVenda : 0,
            custo:       corteResult ? corteResult.custoRateado / corte.pesoKg : custoNum,
            estoqueAtual: corte.pesoKg,
            unidade:     'KG',
            tenantId,
          },
        });
      }
    }

    res.json({ ok: true, resultado });
  } catch (e) {
    console.error('[desossa:registrar]', e.message);
    res.status(500).json({ erro: 'Erro ao registrar: ' + e.message });
  }
};
