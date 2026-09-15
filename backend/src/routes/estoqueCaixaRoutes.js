const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/estoqueCaixaController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);
router.post('/desossa',       ctrl.registrarDesossa);
router.post('/venda',         ctrl.registrarVenda);
router.patch('/venda/:id/cancelar', ctrl.cancelarVenda);
router.get('/caixa/hoje',     ctrl.resumoCaixaHoje);
router.get('/estoque',        ctrl.listarEstoque);
router.get('/alertas/validade', ctrl.alertasValidade);
router.delete('/estoque/:id',  ctrl.removerEstoque);
module.exports = router;
