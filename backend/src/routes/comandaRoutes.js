const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/comandaController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);
router.get('/',                       ctrl.listar);
router.post('/',                      ctrl.criar);
router.get('/:id',                    ctrl.buscar);
router.post('/:id/itens',             ctrl.adicionarItem);
router.delete('/:id/itens/:itemId',   ctrl.removerItem);
router.post('/:id/fechar',            ctrl.fechar);
router.post('/:id/cancelar',          ctrl.cancelar);
router.post('/:id/fechar-sem-cobrar', ctrl.fecharSemCobrar);

module.exports = router;
