const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/fornecedorController');

router.use(auth);

router.get('/',         ctrl.listar);
router.post('/',        ctrl.criar);
router.patch('/:id',    ctrl.atualizar);
router.delete('/:id',   ctrl.deletar);

router.get('/:id/precos',           ctrl.listarPrecos);
router.post('/:id/precos',          ctrl.salvarPreco);
router.delete('/precos/:precoId',   ctrl.removerPreco);

router.get('/comparacao/tabela',    ctrl.comparacao);
router.get('/comparacao/alertas',   ctrl.alertas);
router.get('/precos/:precoId/historico', ctrl.historico);

module.exports = router;
