const prisma = require('../lib/prisma');
const { toFloat, toInt, getTenantId } = require('../lib/validate');

exports.listar = async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: { tenantId: getTenantId(req), ativo: true },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
    res.json(produtos);
  } catch (e) { res.status(500).json({ erro: 'Erro ao listar produtos.' }); }
};

exports.criar = async (req, res) => {
  const tenantId = getTenantId(req);
  const { nome, precoVenda, custo, categoria, unidade, estoqueAtual, validade, codigoBarras } = req.body;
  if (!nome || !precoVenda) return res.status(400).json({ erro: 'Nome e precoVenda sao obrigatorios.' });
  try {
    const qtdInicial = parseFloat(estoqueAtual || 0);

    const produto = await prisma.produto.create({
      data: {
        nome: nome.trim(),
        precoVenda: parseFloat(precoVenda),
        custo: parseFloat(custo || 0),
        estoqueAtual: qtdInicial,
        unidade: unidade || 'KG',
        categoria: categoria || 'Bovino',
        validade: validade ? new Date(validade) : null,
        codigoBarras: codigoBarras || null,
        tenantId,
      },
    });

    // Se for KG e tiver estoque inicial, cria/atualiza na tabela Estoque
    if ((unidade || 'KG') === 'KG' && qtdInicial > 0) {
      await prisma.estoque.upsert({
        where: { nomeCorte_tenantId: { nomeCorte: nome.trim(), tenantId } },
        update: { pesoKg: { increment: qtdInicial } },
        create: { nomeCorte: nome.trim(), pesoKg: qtdInicial, tenantId },
      });
    }

    res.status(201).json(produto);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar produto.' });
  }
};

exports.atualizar = async (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { nome, precoVenda, custo, estoqueAtual, categoria, unidade, validade, codigoBarras } = req.body;
  try {
    const produtoAtual = await prisma.produto.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!produtoAtual) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    const novoNome   = nome        !== undefined ? nome.trim()             : produtoAtual.nome;
    const novaUnid   = unidade     !== undefined ? unidade                 : produtoAtual.unidade;
    const novoEstoque = estoqueAtual !== undefined ? parseFloat(estoqueAtual) : produtoAtual.estoqueAtual;

    await prisma.produto.updateMany({
      where: { id: parseInt(id), tenantId },
      data: {
        ...(nome         !== undefined && { nome: novoNome }),
        ...(precoVenda   !== undefined && { precoVenda: parseFloat(precoVenda) }),
        ...(custo        !== undefined && { custo: parseFloat(custo) }),
        ...(estoqueAtual !== undefined && { estoqueAtual: novoEstoque }),
        ...(categoria    !== undefined && { categoria }),
        ...(unidade      !== undefined && { unidade: novaUnid }),
        ...(validade     !== undefined && { validade: validade ? new Date(validade) : null }),
        ...(codigoBarras !== undefined && { codigoBarras: codigoBarras || null }),
      },
    });

    // Sincroniza tabela Estoque para produtos KG
    if (novaUnid === 'KG') {
      const nomeAntigo = produtoAtual.nome;

      // Se nome mudou, renomeia no estoque
      if (nome !== undefined && novoNome !== nomeAntigo) {
        const estoqueAntigo = await prisma.estoque.findUnique({
          where: { nomeCorte_tenantId: { nomeCorte: nomeAntigo, tenantId } }
        });
        if (estoqueAntigo) {
          // Verifica se já existe com novo nome
          const estoqueNovo = await prisma.estoque.findUnique({
            where: { nomeCorte_tenantId: { nomeCorte: novoNome, tenantId } }
          });
          if (estoqueNovo) {
            // Soma no existente e remove o antigo
            await prisma.estoque.update({
              where: { id: estoqueNovo.id },
              data: { pesoKg: estoqueNovo.pesoKg + estoqueAntigo.pesoKg }
            });
            await prisma.estoque.delete({ where: { id: estoqueAntigo.id } });
          } else {
            await prisma.estoque.update({
              where: { id: estoqueAntigo.id },
              data: { nomeCorte: novoNome }
            });
          }
        }
      }

      // Se estoqueAtual foi editado manualmente, atualiza tabela Estoque
      if (estoqueAtual !== undefined) {
        await prisma.estoque.upsert({
          where: { nomeCorte_tenantId: { nomeCorte: novoNome, tenantId } },
          update: { pesoKg: novoEstoque },
          create: { nomeCorte: novoNome, pesoKg: novoEstoque, tenantId },
        });
      }
    }

    const atualizado = await prisma.produto.findFirst({ where: { id: parseInt(id), tenantId } });
    res.json(atualizado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
};

exports.remover = async (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  try {
    const produto = await prisma.produto.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    // Soft delete do produto
    await prisma.produto.updateMany({
      where: { id: parseInt(id), tenantId },
      data: { ativo: false },
    });

    // Remove do estoque KG também
    if (produto.unidade === 'KG') {
      await prisma.estoque.deleteMany({
        where: { nomeCorte: produto.nome, tenantId }
      });
    }
    // Para UN: zera estoque mas mantém histórico
    if (produto.unidade === 'UN') {
      await prisma.produto.updateMany({
        where: { id: parseInt(id), tenantId },
        data: { estoqueAtual: 0 }
      });
    }

    res.json({ mensagem: 'Produto removido.' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao remover produto.' });
  }
};

exports.ajustarEstoque = async (req, res) => {
  const tenantId = getTenantId(req);
  const { id } = req.params;
  const { quantidade, operacao } = req.body;
  try {
    const produto = await prisma.produto.findFirst({ where: { id: parseInt(id), tenantId } });
    if (!produto) return res.status(404).json({ erro: 'Produto nao encontrado.' });

    let novoEstoque;
    if (operacao === 'adicionar')     novoEstoque = produto.estoqueAtual + parseFloat(quantidade);
    else if (operacao === 'remover')  novoEstoque = Math.max(0, produto.estoqueAtual - parseFloat(quantidade));
    else                              novoEstoque = parseFloat(quantidade);

    const atualizado = await prisma.produto.update({
      where: { id: parseInt(id) },
      data: { estoqueAtual: novoEstoque },
    });

    // Sincroniza tabela Estoque para KG
    if (produto.unidade === 'KG') {
      await prisma.estoque.upsert({
        where: { nomeCorte_tenantId: { nomeCorte: produto.nome, tenantId } },
        update: { pesoKg: novoEstoque },
        create: { nomeCorte: produto.nome, pesoKg: novoEstoque, tenantId },
      });
    }

    res.json(atualizado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao ajustar estoque.' });
  }
};

exports.buscarPorCodigo = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { codigo } = req.params;

    // 1. Tenta busca direta pelo código completo
    let produto = await prisma.produto.findFirst({
      where: { codigoBarras: codigo, tenantId, ativo: true }
    });
    if (produto) return res.json(produto);

    // 2. Código de balança (13 dígitos começando com 2)
    //    Tenta múltiplos formatos: PPPPP+VVVVV, PPPP+VVVVVV, PPPPPP+VVVV
    if (/^2\d{12}$/.test(codigo)) {
      // Tenta dividir o código em produto+valor de várias formas
      // Produto + Valor devem somar 11 (13 total - 1 prefixo - 1 verificador)
      const tentativas = [
        [6, 5],  // Toledo padrão: 6 dig produto + 5 dig valor (R$) ⭐
        [5, 6],  // Filizola: 5 dig produto + 6 dig valor
        [4, 7],  // 4 dig produto + 7 dig valor
        [7, 4],  // 7 dig produto + 4 dig valor
      ];

      for (const [pSize, vSize] of tentativas) {
        const codigoProduto = codigo.substring(1, 1 + pSize);
        const valorEmbutido = codigo.substring(1 + pSize, 1 + pSize + vSize);
        const valorReal     = parseInt(valorEmbutido, 10) / 100;
        const codCurto      = parseInt(codigoProduto, 10).toString();

        // Tenta achar produto com várias variações do código (com/sem zeros à esquerda)
        const variacoes = [codigoProduto, codCurto];
        // Adiciona variações com diferentes paddings
        for (let len = codCurto.length; len <= pSize; len++) {
          variacoes.push(codCurto.padStart(len, '0'));
        }
        const variacoesUnicas = [...new Set(variacoes)];

        produto = await prisma.produto.findFirst({
          where: {
            tenantId, ativo: true,
            codigoBarras: { in: variacoesUnicas }
          }
        });

        if (produto) {
          return res.json({
            ...produto,
            balancaInfo: {
              codigoCompleto: codigo,
              codigoProduto: codCurto,
              valorTotal: valorReal,
              pesoCalculado: produto.unidade === 'KG' && produto.precoVenda > 0
                ? +(valorReal / produto.precoVenda).toFixed(3)
                : null,
            }
          });
        }
      }

      // Não achou em nenhum formato — usa o formato 6+5 (Toledo) padrão pra mostrar mensagem
      const codigoProduto = codigo.substring(1, 7);
      const valorReal     = parseInt(codigo.substring(7, 12), 10) / 100;
      const codCurto      = parseInt(codigoProduto, 10).toString();
      return res.status(404).json({
        erro: 'Produto nao encontrado.',
        codigoBalanca: true,
        codigoProduto: codCurto,
        valorTotal: valorReal,
      });
    }

    res.status(404).json({ erro: 'Produto nao encontrado para este codigo.' });
  } catch (e) {
    console.error('[produto:barcode]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao buscar produto.' });
  }
};
