const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/contasPagarController');

router.use(auth);
router.get('/',            ctrl.listar);
router.get('/resumo',      ctrl.resumo);
router.post('/',           ctrl.criar);
router.patch('/:id',       ctrl.atualizar);
router.patch('/:id/pagar', ctrl.pagar);
router.delete('/:id',      ctrl.cancelar);

module.exports = router;
