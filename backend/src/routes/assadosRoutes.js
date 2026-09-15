const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/assadosController');

router.use(auth);

// Sessão
router.get('/sessao-ativa',     ctrl.sessaoAtiva);
router.post('/abrir',           ctrl.abrirSessao);
router.post('/fechar',          ctrl.fecharSessao);
router.get('/resumo',           ctrl.resumoSessao);

// Produtos da sessão
router.post('/produtos',        ctrl.adicionarProduto);
router.patch('/produtos/:id',   ctrl.atualizarProduto);
router.delete('/produtos/:id',  ctrl.removerProduto);

// Busca de produtos normais (para incluir em comandas/vendas)
router.get('/buscar-normal',    ctrl.buscarProdutoNormal);

// Reservas / Comandas
router.post('/comandas',                       ctrl.criarComanda);
router.post('/comandas/:id/itens',             ctrl.adicionarItemComanda);
router.post('/comandas/:id/itens-normais',     ctrl.adicionarItemNormalComanda);
router.delete('/comandas/:id/itens/:itemId',   ctrl.removerItemComanda);
router.patch('/comandas/:id/pagar',            ctrl.pagarComanda);
router.patch('/comandas/:id/entregar',         ctrl.entregarComanda);
router.patch('/comandas/:id/cancelar',         ctrl.cancelarComanda);

// Venda direta
router.get('/scan/:codigo',     ctrl.buscarProdutoScan);
router.post('/venda-direta',    ctrl.vendaDireta);

module.exports = router;
