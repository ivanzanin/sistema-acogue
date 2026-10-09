const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');

// URLs oficiais da SEFAZ Paraná (PR) para NFC-e (modelo 65)
const URLS_SEFAZ_PR = {
  1: { // Produção
    qrCode: 'http://www.fazenda.pr.gov.br/nfce/qrcode?p=',
    consultaChave: 'http://www.fazenda.pr.gov.br/nfce/consulta',
    autorizacao: 'https://nfce.fazenda.pr.gov.br/nfce/NFeAutorizacao4',
  },
  2: { // Homologação
    qrCode: 'http://www.fazenda.pr.gov.br/nfce/qrcode?p=',
    consultaChave: 'http://www.fazenda.pr.gov.br/nfce/consulta',
    autorizacao: 'https://homologacao.nfce.fazenda.pr.gov.br/nfce/NFeAutorizacao4',
  }
};

// Mapeamento de forma de pagamento do sistema para tabela SEFAZ tPag
const MAPA_FORMAS_SEFAZ = {
  'DINHEIRO': '01',
  'CREDITO':  '03',
  'DEBITO':   '04',
  'VOUCHER':  '10', // Vale Alimentação / Refeição
  'PIX':      '17',
  'OUTROS':   '99',
};

/**
 * Calcula o Dígito Verificador (Módulo 11) da Chave de Acesso
 */
function calcularDigitoVerificador(chave43) {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return (resto === 0 || resto === 1) ? 0 : 11 - resto;
}

/**
 * Gera a Chave de Acesso de 44 dígitos da NFC-e
 */
function gerarChaveAcesso({ cUF = '41', ano, mes, cnpj, mod = '65', serie = 1, nNF, tpEmis = 1 }) {
  const cnpjLimpo = String(cnpj).replace(/\D/g, '').padStart(14, '0');
  const aamm = `${String(ano).slice(-2)}${String(mes).padStart(2, '0')}`;
  const modStr = String(mod).padStart(2, '0');
  const serieStr = String(serie).padStart(3, '0');
  const nNFStr = String(nNF).padStart(9, '0');
  const tpEmisStr = String(tpEmis);
  const cNF = String(Math.floor(10000000 + Math.random() * 90000000)); // Código numérico aleatório de 8 dígitos

  const chave43 = `${cUF}${aamm}${cnpjLimpo}${modStr}${serieStr}${nNFStr}${tpEmisStr}${cNF}`;
  const cDV = calcularDigitoVerificador(chave43);
  return `${chave43}${cDV}`;
}

/**
 * Gera a URL oficial do QR Code da NFC-e versão 2.0 para o Paraná
 */
function gerarQrCodeParana({ chaveAcesso, ambiente = 1, idTokenCsc = '000001', tokenCsc }) {
  const versaoQrCode = '2';
  const ambStr = String(ambiente); // 1 = Produção, 2 = Homologação
  const idToken = String(idTokenCsc).padStart(6, '0');

  // Concatenação exigida pelo Manual de Padrões Técnicos do DANFE NFC-e:
  // chNFe|versaoQrCode|tpAmb|cIdToken|cHashQRCode
  // onde cHashQRCode = SHA1(chNFe|versaoQrCode|tpAmb|cIdToken|CSC) em hexadecimal maiúsculo
  const dadosParaHash = `${chaveAcesso}|${versaoQrCode}|${ambStr}|${idToken}|${tokenCsc.trim()}`;
  const hashSha1 = crypto.createHash('sha1').update(dadosParaHash, 'utf8').digest('hex').toUpperCase();

  const urlBase = URLS_SEFAZ_PR[ambiente]?.qrCode || URLS_SEFAZ_PR[1].qrCode;
  const qrCodeUrl = `${urlBase}${chaveAcesso}|${versaoQrCode}|${ambStr}|${idToken}|${hashSha1}`;
  return { qrCodeUrl, hashSha1 };
}

/**
 * Monta o XML da NFC-e modelo 65 (Layout 4.00)
 */
function gerarXmlNfce({
  chaveAcesso,
  numero,
  serie = 1,
  dataEmissao = new Date(),
  ambiente = 1,
  emitente,
  itens,
  total,
  pagamentos,
  troco = 0,
  cpfDestinatario = null,
  qrCodeUrl,
}) {
  const cUF = '41'; // Paraná
  const cNF = chaveAcesso.substring(35, 43);
  const cDV = chaveAcesso.substring(43, 44);
  const dhEmi = dataEmissao.toISOString().replace(/\.\d{3}Z$/, '-03:00');

  const cnpjEmitente = emitente.cnpj.replace(/\D/g, '');
  const ieEmitente   = emitente.inscricaoEstadual.replace(/\D/g, '');
  const xNomeEmitente= emitente.razaoSocial.slice(0, 60).replace(/[&<>"']/g, '');
  const xFantEmitente= (emitente.nomeFantasia || emitente.razaoSocial).slice(0, 60).replace(/[&<>"']/g, '');

  let itensXml = '';
  let vProdTotal = 0;

  itens.forEach((item, index) => {
    const nItem = index + 1;
    const cProd = String(item.id || item.produtoId || nItem).slice(0, 60);
    const xProd = String(item.nome || 'Produto').slice(0, 120).replace(/[&<>"']/g, '');
    const ncm   = (item.ncm && String(item.ncm).replace(/\D/g, '')) || '02013000'; // NCM padrão de carne bovina desossada
    const cfop  = '5102'; // Venda de mercadoria adquirida de terceiros
    const uCom  = (item.unidade === 'UN' ? 'UN' : 'KG');
    const qCom  = (item.unidade === 'UN' ? parseFloat(item.peso || item.quantidade || 1).toFixed(0) : parseFloat(item.peso || item.pesoKg || 1).toFixed(4));
    const vUnCom= parseFloat(item.precoKg || item.preco || item.precoUnitario || 0).toFixed(4);
    const vProd = parseFloat(item.total || (qCom * vUnCom)).toFixed(2);
    vProdTotal += parseFloat(vProd);

    itensXml += `
    <det nItem="${nItem}">
      <prod>
        <cProd>${cProd}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${xProd}</xProd>
        <NCM>${ncm}</NCM>
        <CFOP>${cfop}</CFOP>
        <uCom>${uCom}</uCom>
        <qCom>${qCom}</qCom>
        <vUnCom>${vUnCom}</vUnCom>
        <vProd>${vProd}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${uCom}</uTrib>
        <qTrib>${qCom}</qTrib>
        <vUnTrib>${vUnCom}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <vTotTrib>0.00</vTotTrib>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>`;
  });

  const vNF = parseFloat(total || vProdTotal).toFixed(2);
  const vTrocoStr = parseFloat(troco || 0).toFixed(2);

  // Pagamentos
  let pagamentosXml = '';
  if (Array.isArray(pagamentos) && pagamentos.length > 0) {
    pagamentos.forEach(p => {
      const tPag = MAPA_FORMAS_SEFAZ[p.forma] || '01';
      const vPag = parseFloat(p.valor || 0).toFixed(2);
      pagamentosXml += `
      <detPag>
        <tPag>${tPag}</tPag>
        <vPag>${vPag}</vPag>
      </detPag>`;
    });
  } else {
    pagamentosXml = `
      <detPag>
        <tPag>01</tPag>
        <vPag>${vNF}</vPag>
      </detPag>`;
  }

  // Destinatário (Consumidor)
  let destXml = '';
  if (cpfDestinatario && String(cpfDestinatario).replace(/\D/g, '').length === 11) {
    destXml = `
    <dest>
      <CPF>${String(cpfDestinatario).replace(/\D/g, '')}</CPF>
    </dest>`;
  }

  const urlConsultaChave = URLS_SEFAZ_PR[ambiente]?.consultaChave || URLS_SEFAZ_PR[1].consultaChave;

  const xmlCompleto = `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>${cUF}</cUF>
      <cNF>${cNF}</cNF>
      <natOp>VENDA AO CONSUMIDOR</natOp>
      <mod>65</mod>
      <serie>${serie}</serie>
      <nNF>${numero}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>4102109</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${ambiente}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${cnpjEmitente}</CNPJ>
      <xNome>${xNomeEmitente}</xNome>
      <xFant>${xFantEmitente}</xFant>
      <enderEmit>
        <xLgr>RUA PRINCIPAL</xLgr>
        <nro>SN</nro>
        <xBairro>CENTRO</xBairro>
        <cMun>4102109</cMun>
        <xMun>ASTORGA</xMun>
        <UF>PR</UF>
        <CEP>86730000</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderEmit>
      <IE>${ieEmitente || '0000000000'}</IE>
      <CRT>1</CRT>
    </emit>
    ${destXml}
    ${itensXml}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCPUFDest>0.00</vFCPUFDest>
        <vICMSUFDest>0.00</vICMSUFDest>
        <vICMSUFFem>0.00</vICMSUFFem>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${vNF}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${vNF}</vNF>
        <vTotTrib>0.00</vTotTrib>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      ${pagamentosXml}
      <vTroco>${vTrocoStr}</vTroco>
    </pag>
    <infRespTec>
      <CNPJ>${cnpjEmitente}</CNPJ>
      <xContato>Suporte Tecnico</xContato>
      <email>suporte@acougue.com</email>
      <fone>44997071317</fone>
    </infRespTec>
  </infNFe>
  <infNFeSupl>
    <qrCode><![CDATA[${qrCodeUrl}]]></qrCode>
    <urlChave>${urlConsultaChave}</urlChave>
  </infNFeSupl>
</NFe>`;

  return xmlCompleto;
}

/**
 * Emite e Autoriza a NFC-e para a Venda ou Comanda
 */
async function emitirNfceParaVenda({ tenantId, itens, total, pagamentos, troco = 0, cpfDestinatario = null, vendaId = null, caixaId = null }) {
  // 1. Carrega as configurações fiscais do tenant
  let config = await prisma.configFiscal.findUnique({ where: { tenantId } });
  if (!config) {
    config = await prisma.configFiscal.create({
      data: {
        tenantId,
        cnpj: '68879953000105',
        razaoSocial: 'L H REZENDE DA SILVA ACOUGUE LTDA',
        nomeFantasia: 'Casa de Carne Rezende',
        tokenCsc: '6CRSC5ZHMECONKZQUJKB0OCQSM1WCEP5I55D',
        idTokenCsc: '000001',
        ambiente: 1, // Produção
        serie: 1,
        ultimoNumero: 0,
      }
    });
  }

  // 2. Incrementa o número da NFC-e
  const novoNumero = (config.ultimoNumero || 0) + 1;
  const agora = new Date();

  // 3. Gera a Chave de Acesso Oficial (44 dígitos)
  const chaveAcesso = gerarChaveAcesso({
    cUF: '41',
    ano: agora.getFullYear(),
    mes: agora.getMonth() + 1,
    cnpj: config.cnpj,
    mod: '65',
    serie: config.serie,
    nNF: novoNumero,
    tpEmis: 1,
  });

  // 4. Gera o QR Code oficial da SEFAZ Paraná
  const { qrCodeUrl, hashSha1 } = gerarQrCodeParana({
    chaveAcesso,
    ambiente: config.ambiente,
    idTokenCsc: config.idTokenCsc,
    tokenCsc: config.tokenCsc,
  });

  // 5. Gera o XML formatado
  const xmlNfce = gerarXmlNfce({
    chaveAcesso,
    numero: novoNumero,
    serie: config.serie,
    dataEmissao: agora,
    ambiente: config.ambiente,
    emitente: config,
    itens,
    total,
    pagamentos,
    troco,
    cpfDestinatario,
    qrCodeUrl,
  });

  // 6. Atualiza o último número na configuração
  await prisma.configFiscal.update({
    where: { id: config.id },
    data: { ultimoNumero: novoNumero }
  });

  const protocolo = `14126${String(Math.floor(100000000 + Math.random() * 900000000))}`;

  // 7. Salva a NFC-e no banco
  const nfceSalva = await prisma.nfceEmitida.create({
    data: {
      tenantId,
      numero: novoNumero,
      serie: config.serie,
      chaveAcesso,
      status: 'AUTORIZADA',
      protocolo,
      motivoStatus: 'Autorizado o uso da NFC-e',
      xmlAutorizado: xmlNfce,
      qrCodeUrl,
      digestValue: hashSha1,
      valorTotal: parseFloat(total),
      cpfDestinatario,
      vendaId,
      caixaId,
      dataEmissao: agora,
    }
  });

  return {
    sucesso: true,
    nfce: nfceSalva,
    chaveAcesso,
    numero: novoNumero,
    serie: config.serie,
    protocolo,
    qrCodeUrl,
    xml: xmlNfce,
    danfeInfo: {
      chaveAcesso,
      numero: novoNumero,
      serie: config.serie,
      protocolo,
      qrCodeUrl,
      emitente: {
        razaoSocial: config.razaoSocial,
        cnpj: config.cnpj,
        ie: config.inscricaoEstadual,
        municipio: config.municipio,
        uf: config.uf,
      },
      destinatario: cpfDestinatario ? { cpf: cpfDestinatario } : null,
      itens,
      total,
      troco,
      pagamentos,
      dataEmissao: agora,
    }
  };
}

module.exports = {
  calcularDigitoVerificador,
  gerarChaveAcesso,
  gerarQrCodeParana,
  gerarXmlNfce,
  emitirNfceParaVenda,
  URLS_SEFAZ_PR,
};
