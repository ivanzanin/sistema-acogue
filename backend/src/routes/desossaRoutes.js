const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/desossaController');
const auth    = require('../middleware/authMiddleware');

router.get   ('/',              auth, ctrl.listarTemplates);
router.post  ('/',              auth, ctrl.criarTemplate);
router.delete('/:id',           auth, ctrl.deletarTemplate);
router.post  ('/calcular',      auth, ctrl.calcularDesossa);
router.post  ('/:id/registrar', auth, ctrl.registrarDesossa);

module.exports = router;
