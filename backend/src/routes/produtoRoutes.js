const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/produtoController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);
router.get('/',              ctrl.listar);
router.post('/',             ctrl.criar);
router.put('/:id',           ctrl.atualizar);
router.delete('/:id',        ctrl.remover);
router.patch('/:id/estoque', ctrl.ajustarEstoque);

router.get('/barcode/:codigo', auth, ctrl.buscarPorCodigo);
module.exports = router;
