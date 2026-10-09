const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/fiscalController');
const auth    = require('../middleware/authMiddleware');

router.use(auth);

router.get('/config',        ctrl.obterConfig);
router.post('/config',       ctrl.salvarConfig);
router.get('/notas',         ctrl.listarNfce);
router.get('/notas/:id/xml', ctrl.baixarXml);

module.exports = router;
