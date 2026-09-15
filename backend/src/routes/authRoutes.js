const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/authController');
const auth    = require('../middleware/authMiddleware');

router.post('/login',       ctrl.login);
router.post('/refresh',     ctrl.refresh);
router.post('/admin-login', ctrl.adminLogin);
router.get ('/me',          auth, ctrl.me);

module.exports = router;
