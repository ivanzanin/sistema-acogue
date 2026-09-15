
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const prisma  = require('../lib/prisma');
const JWT_SECRET     = process.env.JWT_SECRET || 'acougue_secret_dev';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'acougue_refresh_dev';

exports.login = async (req, res) => {
  const { cnpj, senha } = req.body;
  if (!cnpj || !senha)
    return res.status(400).json({ erro: 'CNPJ e senha sao obrigatorios.' });
  try {
    const cliente = await prisma.clienteTenant.findUnique({
      where: { cnpj: cnpj.replace(/\D/g, '') }
    });
    if (!cliente) return res.status(401).json({ erro: 'CNPJ nao cadastrado.' });

    // Suporta senha em texto puro (legado) e bcrypt
    let senhaValida = false;
    if (cliente.senha.startsWith('$2')) {
      senhaValida = await bcrypt.compare(senha, cliente.senha);
    } else {
      senhaValida = senha === cliente.senha;
      // Migra para bcrypt automaticamente
      if (senhaValida) {
        const hash = await bcrypt.hash(senha, 10);
        await prisma.clienteTenant.update({ where: { id: cliente.id }, data: { senha: hash } });
      }
    }
    if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta.' });

    if (cliente.statusPagamento === 'BLOQUEADO' || cliente.statusPagamento === 'INATIVO')
      return res.status(403).json({ erro: 'Acesso bloqueado por falta de pagamento.' });

    const payload = { id: cliente.id, cnpj: cliente.cnpj, nomeAcougue: cliente.nomeAcougue };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    const refreshToken = jwt.sign({ id: cliente.id }, REFRESH_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      refreshToken,
      cliente: {
        id: cliente.id,
        nomeAcougue: cliente.nomeAcougue,
        cnpj: cliente.cnpj,
        nomeResponsavel: cliente.nomeResponsavel,
        logoUrl: cliente.logoUrl || null,
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro interno ao autenticar.' });
  }
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ erro: 'refreshToken obrigatorio.' });
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const cliente = await prisma.clienteTenant.findUnique({ where: { id: decoded.id } });
    if (!cliente) return res.status(401).json({ erro: 'Cliente nao encontrado.' });
    if (cliente.statusPagamento === 'BLOQUEADO' || cliente.statusPagamento === 'INATIVO')
      return res.status(403).json({ erro: 'Acesso bloqueado.' });
    const token = jwt.sign(
      { id: cliente.id, cnpj: cliente.cnpj, nomeAcougue: cliente.nomeAcougue },
      JWT_SECRET, { expiresIn: '12h' }
    );
    res.json({ token });
  } catch (e) {
    res.status(401).json({ erro: 'Refresh token invalido ou expirado.' });
  }
};

exports.me = async (req, res) => {
  try {
    if (req.user?.isAdmin) {
      return res.json({ id: 'admin', nomeAcougue: 'Admin', isAdmin: true });
    }
    const cliente = await prisma.clienteTenant.findUnique({ where: { id: req.user.id } });
    if (!cliente) return res.status(404).json({ erro: 'Cliente nao encontrado.' });
    res.json({
      id: cliente.id,
      nomeAcougue: cliente.nomeAcougue,
      cnpj: cliente.cnpj,
      nomeResponsavel: cliente.nomeResponsavel,
      logoUrl: cliente.logoUrl || null,
    });
  } catch (e) {
    console.error('[auth:me]', e.message);
    res.status(500).json({ erro: 'Erro ao buscar dados do cliente.' });
  }
};

exports.adminLogin = async (req, res) => {
  const { usuario, senha } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || '1404';

  if (!usuario || !senha)
    return res.status(400).json({ erro: 'Usuario e senha obrigatorios.' });

  if (usuario !== ADMIN_USER || senha !== ADMIN_PASS)
    return res.status(401).json({ erro: 'Credenciais de admin invalidas.' });

  const token = jwt.sign(
    { id: 'admin', isAdmin: true, nomeAcougue: 'Admin' },
    JWT_SECRET, { expiresIn: '12h' }
  );
  res.json({ token, isAdmin: true, cliente: { id: 'admin', nomeAcougue: 'Admin', isAdmin: true } });
};
