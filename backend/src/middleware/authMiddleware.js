const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'acougue_secret_dev';

module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token nao fornecido.' });
  try {
    req.user = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token invalido ou expirado.' });
  }
};
