const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/caixaController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);
router.get('/status',      ctrl.statusCaixa);
router.post('/abrir',      ctrl.abrirCaixa);
router.post('/movimento',  ctrl.registrarMovimento);
router.post('/fechar',     ctrl.fecharCaixa);
router.post('/reabrir',    ctrl.reabrirCaixa);

module.exports = router;
