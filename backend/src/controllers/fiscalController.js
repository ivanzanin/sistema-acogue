const prisma = require('../lib/prisma');
const { getTenantId } = require('../lib/validate');
const { emitirNfceParaVenda } = require('../services/nfceService');

exports.obterConfig = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    let config = await prisma.configFiscal.findUnique({ where: { tenantId } });

    if (!config) {
      config = await prisma.configFiscal.create({
        data: {
          tenantId,
          ambiente: 1, // Produção
          cnpj: '68879953000105',
          razaoSocial: 'L H REZENDE DA SILVA ACOUGUE LTDA',
          nomeFantasia: 'Casa de Carne Rezende',
          inscricaoEstadual: '',
          uf: 'PR',
          municipio: 'Astorga',
          codigoIbgeMunicipio: '4102109',
          tokenCsc: '6CRSC5ZHMECONKZQUJKB0OCQSM1WCEP5I55D',
          idTokenCsc: '000001',
          serie: 1,
          ultimoNumero: 0,
          emitirOpcional: true,
        }
      });
    }

    res.json(config);
  } catch (e) {
    console.error('[fiscal:obterConfig]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao obter configurações fiscais.' });
  }
};

exports.salvarConfig = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      ambiente,
      cnpj,
      razaoSocial,
      nomeFantasia,
      inscricaoEstadual,
      uf,
      municipio,
      codigoIbgeMunicipio,
      tokenCsc,
      idTokenCsc,
      serie,
      ultimoNumero,
      certificadoSenha,
      emitirOpcional,
    } = req.body;

    const data = {
      ambiente: ambiente !== undefined ? parseInt(ambiente) : 1,
      cnpj: (cnpj || '').replace(/\D/g, '') || '68879953000105',
      razaoSocial: razaoSocial || 'L H REZENDE DA SILVA ACOUGUE LTDA',
      nomeFantasia: nomeFantasia || 'Casa de Carne Rezende',
      inscricaoEstadual: (inscricaoEstadual || '').trim(),
      uf: uf || 'PR',
      municipio: municipio || 'Astorga',
      codigoIbgeMunicipio: codigoIbgeMunicipio || '4102109',
      tokenCsc: (tokenCsc || '').trim() || '6CRSC5ZHMECONKZQUJKB0OCQSM1WCEP5I55D',
      idTokenCsc: (idTokenCsc || '').trim() || '000001',
      serie: serie ? parseInt(serie) : 1,
      ultimoNumero: ultimoNumero !== undefined ? parseInt(ultimoNumero) : 0,
      emitirOpcional: emitirOpcional !== undefined ? !!emitirOpcional : true,
    };

    if (certificadoSenha !== undefined) {
      data.certificadoSenha = certificadoSenha;
    }

    const config = await prisma.configFiscal.upsert({
      where: { tenantId },
      create: { tenantId, ...data },
      update: data,
    });

    res.json({ mensagem: 'Configurações fiscais salvas com sucesso.', config });
  } catch (e) {
    console.error('[fiscal:salvarConfig]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao salvar configurações fiscais.' });
  }
};

exports.listarNfce = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const notas = await prisma.nfceEmitida.findMany({
      where: { tenantId },
      orderBy: { dataEmissao: 'desc' },
      take: 50,
    });
    res.json(notas);
  } catch (e) {
    console.error('[fiscal:listarNfce]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao listar notas fiscais.' });
  }
};

exports.baixarXml = async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const nota = await prisma.nfceEmitida.findFirst({
      where: { id: parseInt(id), tenantId }
    });
    if (!nota || !nota.xmlAutorizado) {
      return res.status(404).json({ erro: 'XML da nota fiscal não encontrado.' });
    }

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=NFCe_${nota.chaveAcesso}.xml`);
    res.send(nota.xmlAutorizado);
  } catch (e) {
    console.error('[fiscal:baixarXml]', e.message);
    res.status(500).json({ erro: e.message || 'Erro ao baixar XML.' });
  }
};
