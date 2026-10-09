require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const path       = require('path');
const fs         = require('fs');
const rateLimit  = require('express-rate-limit');

const authRoutes         = require('./src/routes/authRoutes');
const adminRoutes        = require('./src/routes/adminRoutes');
const desossaRoutes      = require('./src/routes/desossaRoutes');
const estoqueCaixaRoutes = require('./src/routes/estoqueCaixaRoutes');
const produtoRoutes      = require('./src/routes/produtoRoutes');
const superAdminRoutes   = require('./src/routes/superAdminRoutes');
const dashboardRoutes    = require('./src/routes/dashboardRoutes');
const caixaRoutes        = require('./src/routes/caixaRoutes');
const backupRoutes       = require('./src/routes/backupRoutes');
const historicoRoutes    = require('./src/routes/historicoRoutes');
const comandaRoutes      = require('./src/routes/comandaRoutes');
const fornecedorRoutes   = require('./src/routes/fornecedorRoutes');
const contasPagarRoutes  = require('./src/routes/contasPagarRoutes');
const assadosRoutes      = require('./src/routes/assadosRoutes');
const fiscalRoutes       = require('./src/routes/fiscalRoutes');

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(morgan('dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { erro: 'Muitas tentativas. Aguarde 15 minutos.' },
});
app.use('/auth/login', loginLimiter);

app.use('/auth',         authRoutes);
app.use('/admin',        adminRoutes);
app.use('/desossa',      desossaRoutes);
app.use('/gestao',       estoqueCaixaRoutes);
app.use('/produtos',     produtoRoutes);
app.use('/superadmin',   superAdminRoutes);
app.use('/dashboard',    dashboardRoutes);
app.use('/caixa',        caixaRoutes);
app.use('/backup',       backupRoutes);
app.use('/historico',    historicoRoutes);
app.use('/comandas',     comandaRoutes);
app.use('/fornecedores', fornecedorRoutes);
app.use('/contas-pagar', contasPagarRoutes);
app.use('/assados',      assadosRoutes);
app.use('/fiscal',       fiscalRoutes);

// Upload de logo
const jwt = require('jsonwebtoken');
app.post('/api/tenant/logo', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer '))
    return res.status(401).json({ erro: 'Token nao fornecido.' });
  let tenantId;
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'acougue_secret_dev');
    tenantId = decoded.id;
  } catch {
    return res.status(401).json({ erro: 'Token invalido.' });
  }
  const logosDir = path.join(__dirname, 'public', 'logos');
  if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });
  const ext      = req.headers['content-type']?.split('/')[1]?.split(';')[0] || 'jpg';
  const fileName = `logo_${tenantId}.${ext}`;
  const filePath = path.join(logosDir, fileName);
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', async () => {
    try {
      fs.writeFileSync(filePath, Buffer.concat(chunks));
      const logoUrl = `/logos/${fileName}`;
      const prisma  = require('./src/lib/prisma');
      await prisma.clienteTenant.update({ where: { id: tenantId }, data: { logoUrl } });
      res.json({ logoUrl });
    } catch (e) {
      console.error('[logo:upload]', e.message);
      res.status(500).json({ erro: 'Erro ao salvar logo.' });
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

const publicPath = path.join(__dirname, 'public');
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const PORT   = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`\n  Acougue SaaS em http://localhost:${PORT}\n`);
  const { backupAutomatico } = require('./src/controllers/backupController');
  setTimeout(backupAutomatico, 3000);
  setInterval(backupAutomatico, 24 * 60 * 60 * 1000);
});

const shutdown = () => {
  server.close(() => {
    require('./src/lib/prisma').$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
