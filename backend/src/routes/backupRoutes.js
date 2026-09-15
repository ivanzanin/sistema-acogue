const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/backupController');
const jwt     = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'acougue_secret_dev';

// Middleware que aceita token via header OU query param (para downloads)
const authFlexivel = (req, res, next) => {
  let token = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }
  if (!token) return res.status(401).json({ erro: 'Token nao fornecido.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token invalido.' });
  }
};

router.use(authFlexivel);
router.post('/fazer',         ctrl.fazerBackup);
router.get('/listar',         ctrl.listarBackups);
router.get('/download/:nome', ctrl.downloadBackup);

module.exports = router;
