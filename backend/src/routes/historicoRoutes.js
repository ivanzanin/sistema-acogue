const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/historicoController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);
router.get('/vendas',    ctrl.historico);
router.get('/relatorio', ctrl.relatorioPeriodo);

module.exports = router;
