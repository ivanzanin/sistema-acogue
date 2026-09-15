const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/superAdminController');
router.use(ctrl.verificarSecret);
router.get('/',        ctrl.listarTenants);
router.post('/',       ctrl.criarTenant);
router.patch('/:id',   ctrl.alterarStatus);
router.delete('/:id',  ctrl.deletarTenant);
module.exports = router;
