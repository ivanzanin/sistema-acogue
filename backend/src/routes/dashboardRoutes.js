const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/dashboardController');
const auth = require('../middleware/authMiddleware');
router.use(auth);
router.get('/resumo', ctrl.resumo);
module.exports = router;
