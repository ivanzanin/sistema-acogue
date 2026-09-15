const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { toFloat, toInt } = require('../lib/validate');

const ocultarSenha = (c) => ({ ...c, senha: undefined });

exports.listarClientes = async (req, res) => {
  try {
    const clientes = await prisma.clienteTenant.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(clientes.map(ocultarSenha));
  } catch (e) {
    console.error('[admin:listar]', e.message);
    res.status(500).json({ erro: 'Erro ao buscar clientes.' });
  }
};

exports.criarCliente = async (req, res) => {
  const { nomeAcougue, cnpj, nomeResponsavel, telefone, senha, diaVencimento, valorMensal } = req.body;
  if (!nomeAcougue || !cnpj || !nomeResponsavel || !telefone || !diaVencimento || !valorMensal)
    return res.status(400).json({ erro: 'Todos os campos sao obrigatorios.' });
  const dia = toInt(diaVencimento);
  const valor = toFloat(valorMensal);
  if (!dia || dia < 1 || dia > 31) return res.status(400).json({ erro: 'Dia de vencimento invalido.' });
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor mensal invalido.' });
  try {
    const cnpjLimpo = cnpj.replace(/\D/g, '');
    const senhaHash = await bcrypt.hash(senha || '1234', 10);
    const cliente = await prisma.clienteTenant.create({
      data: {
        nomeAcougue, cnpj: cnpjLimpo, nomeResponsavel, telefone,
        senha: senhaHash, diaVencimento: dia, valorMensal: valor,
        dbConnectionString: `file:./tenant_${cnpjLimpo}.db`
      }
    });
    res.status(201).json(ocultarSenha(cliente));
  } catch (e) {
    console.error('[admin:criar]', e.message);
    if (e.code === 'P2002') return res.status(400).json({ erro: 'CNPJ ja cadastrado.' });
    res.status(500).json({ erro: 'Erro ao criar cliente.' });
  }
};

exports.atualizarStatus = async (req, res) => {
  const { id } = req.params;
  const { statusPagamento } = req.body;
  if (!['ATIVO', 'BLOQUEADO', 'INATIVO'].includes(statusPagamento))
    return res.status(400).json({ erro: 'Status invalido.' });
  try {
    const cliente = await prisma.clienteTenant.update({
      where: { id: String(id) }, data: { statusPagamento }
    });
    res.json(ocultarSenha(cliente));
  } catch (e) {
    console.error('[admin:status]', e.message);
    res.status(500).json({ erro: 'Erro ao atualizar.' });
  }
};
