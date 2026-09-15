import QRCode from 'qrcode';

// Função para formatar campos no padrão EMVCo (ID + Tamanho 2 dígitos + Valor)
function formatarCampoEmv(id, valor) {
  const v = String(valor || '');
  const len = String(v.length).padStart(2, '0');
  return `${id}${len}${v}`;
}

// Remove acentos e caracteres especiais para compatibilidade com o padrão bancário
function normalizarTexto(str, maxLen = 25) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

// Cálculo oficial do CRC16-CCITT (polinômio 0x1021, init 0xFFFF)
function calcularCRC16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Gera a string do BR Code (Pix Copia e Cola) oficial do Banco Central
 */
export function gerarPayloadPix({ chave, nome = 'AÇOUGUE', cidade = 'SAO PAULO', valor = 0, txId = '' }) {
  if (!chave) return null;

  const chaveLimpa = chave.trim();
  const nomeNorm = normalizarTexto(nome, 25) || 'ACOUQUE';
  const cidadeNorm = normalizarTexto(cidade, 15) || 'SAO PAULO';
  const valorFormatado = Number(valor).toFixed(2);
  const txIdNorm = normalizarTexto(txId || 'PDV' + Date.now().toString().slice(-6), 25);

  // Subcampos do Merchant Account Information (ID 26)
  const gui = formatarCampoEmv('00', 'br.gov.bcb.pix');
  const key = formatarCampoEmv('01', chaveLimpa);
  const merchantAccount = formatarCampoEmv('26', `${gui}${key}`);

  // Campos principais
  const payloadFormat = formatarCampoEmv('00', '01');
  const pointOfInitiation = formatarCampoEmv('01', '12'); // 12 = QR dinâmico / valor pré-definido
  const mcc = formatarCampoEmv('52', '0000');
  const currency = formatarCampoEmv('53', '986'); // BRL
  const amount = formatarCampoEmv('54', valorFormatado);
  const country = formatarCampoEmv('58', 'BR');
  const merchantName = formatarCampoEmv('59', nomeNorm);
  const merchantCity = formatarCampoEmv('60', cidadeNorm);

  // Additional Data (ID 62)
  const refLabel = formatarCampoEmv('05', txIdNorm);
  const additionalData = formatarCampoEmv('62', refLabel);

  // Monta payload preliminar com indicador CRC (ID 63, tamanho 04)
  const payloadSemCRC = `${payloadFormat}${pointOfInitiation}${merchantAccount}${mcc}${currency}${amount}${country}${merchantName}${merchantCity}${additionalData}6304`;
  const crc = calcularCRC16(payloadSemCRC);

  return `${payloadSemCRC}${crc}`;
}

/**
 * Gera DataURL (imagem base64) do QR Code a partir da string Pix
 */
export async function gerarQrCodePixDataUrl(payloadPix) {
  if (!payloadPix) return '';
  return await QRCode.toDataURL(payloadPix, {
    width: 256,
    margin: 1,
    color: {
      dark: '#1C1917',
      light: '#FFFFFF'
    }
  });
}
