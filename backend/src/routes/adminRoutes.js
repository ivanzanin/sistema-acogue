const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/adminController');
const auth    = require('../middleware/authMiddleware');

// Rotas admin protegidas por JWT
router.get('/clientes',              auth, ctrl.listarClientes);
router.post('/clientes',             auth, ctrl.criarCliente);
router.patch('/clientes/:id/status', auth, ctrl.atualizarStatus);
module.exports = router;
