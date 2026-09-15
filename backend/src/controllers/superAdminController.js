const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { toFloat, toInt } = require('../lib/validate');
const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET || 'superadmin_dono_saas_2024';

exports.verificarSecret = (req, res, next) => {
  const secret = req.headers['x-super-admin'];
  if (secret !== SUPER_ADMIN_SECRET) return res.status(403).json({ erro: 'Acesso negado.' });
  next();
};

exports.listarTenants = async (req, res) => {
  try {
    const clientes = await prisma.clienteTenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { produtos: true } } },
    });
    res.json(clientes.map(c => ({ ...c, senha: undefined })));
  } catch (e) {
    console.error('[superadmin:listar]', e.message);
    res.status(500).json({ erro: 'Erro ao listar tenants.' });
  }
};

exports.criarTenant = async (req, res) => {
  const { nomeAcougue, cnpj, nomeResponsavel, telefone, diaVencimento, valorMensal } = req.body;
  if (!nomeAcougue || !cnpj || !nomeResponsavel || !telefone || !diaVencimento || !valorMensal)
    return res.status(400).json({ erro: 'Todos os campos sao obrigatorios.' });
  const dia = toInt(diaVencimento);
  const valor = toFloat(valorMensal);
  if (!dia || dia < 1 || dia > 31) return res.status(400).json({ erro: 'Dia de vencimento invalido (1-31).' });
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor mensal invalido.' });
  const cnpjLimpo = cnpj.replace(/\D/g, '');
  try {
    const senhaHash = await bcrypt.hash('1234', 10);
    const cliente = await prisma.clienteTenant.create({
      data: {
        nomeAcougue, cnpj: cnpjLimpo, nomeResponsavel, telefone,
        senha: senhaHash, statusPagamento: 'ATIVO',
        diaVencimento: dia, valorMensal: valor,
        dbConnectionString: `file:./tenant_${cnpjLimpo}.db`,
      },
    });
    res.status(201).json({ ...cliente, senha: undefined });
  } catch (e) {
    console.error('[superadmin:criar]', e.message);
    if (e.code === 'P2002') return res.status(400).json({ erro: 'CNPJ ja cadastrado.' });
    res.status(500).json({ erro: 'Erro ao criar tenant.' });
  }
};

exports.alterarStatus = async (req, res) => {
  const { id } = req.params;
  const { statusPagamento, nomeAcougue, nomeResponsavel, telefone, diaVencimento, valorMensal } = req.body;

  try {
    const data = {};
    if (statusPagamento) {
      if (!['ATIVO', 'BLOQUEADO', 'INATIVO'].includes(statusPagamento))
        return res.status(400).json({ erro: 'Status invalido.' });
      data.statusPagamento = statusPagamento;
    }
    if (nomeAcougue)    data.nomeAcougue    = nomeAcougue;
    if (nomeResponsavel) data.nomeResponsavel = nomeResponsavel;
    if (telefone)       data.telefone       = telefone;
    if (diaVencimento)  data.diaVencimento  = toInt(diaVencimento) || undefined;
    if (valorMensal)    data.valorMensal    = toFloat(valorMensal) || undefined;

    const cliente = await prisma.clienteTenant.update({ where: { id: String(id) }, data });
    res.json({ ...cliente, senha: undefined });
  } catch (e) {
    console.error('[superadmin:update]', e.message);
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
};

exports.deletarTenant = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.clienteTenant.delete({ where: { id: String(id) } });
    res.json({ mensagem: 'Tenant removido.' });
  } catch (e) {
    console.error('[superadmin:deletar]', e.message);
    res.status(500).json({ erro: 'Erro ao remover tenant.' });
  }
};
