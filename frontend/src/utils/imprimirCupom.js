import QRCode from 'qrcode';

const FORMA_LABEL = {
  DINHEIRO: 'Dinheiro',
  PIX:      'PIX',
  DEBITO:   'Cartao Debito',
  CREDITO:  'Cartao Credito',
  VOUCHER:  'Voucher Alimentacao',
};

export async function imprimirCupom(itensCarrinho, total, nomeAcougue, formaPagamento = 'DINHEIRO', valorPago = 0, troco = 0, pagamentos = null, nfce = null) {
  const agora = new Date();
  const data  = agora.toLocaleDateString('pt-BR');
  const hora  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nome  = (nomeAcougue || 'ACOUGUE SAAS').toUpperCase();

  let qrCodeDataUrl = '';
  if (nfce && nfce.qrCodeUrl) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(nfce.qrCodeUrl, { width: 160, margin: 1 });
    } catch (e) {
      console.error('[imprimirCupom] Erro ao gerar QR Code:', e);
    }
  }

  const isNfce = !!(nfce && nfce.chaveAcesso);

  const linhas = itensCarrinho.map((item, idx) => {
    const isUN = item.unidade === 'UN';
    const qtdStr = isUN ? `${parseFloat(item.peso || item.quantidade || 1)} un` : `${parseFloat(item.peso).toFixed(3)} kg`;
    const precoStr = isUN ? `@ R$ ${item.precoKg.toFixed(2)}/un` : `@ R$ ${item.precoKg.toFixed(2)}/kg`;
    return `
    <tr>
      <td class="nome">${idx + 1}. ${item.nome}</td>
      <td class="qtd">${qtdStr}</td>
      <td class="preco">R$ ${item.total.toFixed(2)}</td>
    </tr>
    <tr><td class="sub" colspan="3">${precoStr}</td></tr>
  `;
  }).join('');

  let pagamentoHtml = '';
  if (Array.isArray(pagamentos) && pagamentos.length > 1) {
    pagamentoHtml = `
      <div class="pagamento">
        <div class="row" style="font-weight:bold;margin-bottom:3px;border-bottom:1px dashed #bbb;padding-bottom:2px;">
          <span>Divisao de Pagamento (${pagamentos.length} pessoas)</span>
        </div>
        ${pagamentos.map(p => `
          <div class="row">
            <span>${p.nome || p.pessoa || 'Pessoa'}: ${FORMA_LABEL[p.forma] || p.forma}</span>
            <span style="font-weight:bold;">R$ ${parseFloat(p.valor).toFixed(2)}</span>
          </div>
        `).join('')}
        ${troco > 0 ? `
        <div class="row troco"><span>Troco</span><span>R$ ${parseFloat(troco).toFixed(2)}</span></div>
        ` : ''}
      </div>
    `;
  } else {
    pagamentoHtml = `
      <div class="pagamento">
        <div class="row"><span>Forma de Pagamento</span><span>${FORMA_LABEL[formaPagamento] || formaPagamento}</span></div>
        ${formaPagamento === 'DINHEIRO' && valorPago > 0 ? `
        <div class="row"><span>Valor Recebido</span><span>R$ ${parseFloat(valorPago).toFixed(2)}</span></div>
        <div class="row troco"><span>Troco</span><span>R$ ${parseFloat(troco).toFixed(2)}</span></div>
        ` : ''}
      </div>
    `;
  }

  let fiscalHtml = '';
  if (isNfce) {
    const chaveFormatada = (nfce.chaveAcesso || '').replace(/(\d{4})/g, '$1 ').trim();
    const cpfFormatado = nfce.destinatario?.cpf || nfce.cpfDestinatario
      ? (nfce.destinatario?.cpf || nfce.cpfDestinatario).replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      : null;
    const emitente = nfce.danfeInfo?.emitente || nfce.emitente || {};
    const razaoSocial = emitente.razaoSocial || 'L H REZENDE DA SILVA ACOUGUE LTDA';
    const cnpj = emitente.cnpj || '68.879.953/0001-05';
    const municipio = emitente.municipio ? `${emitente.municipio} - ${emitente.uf || 'PR'}` : 'Astorga - PR';

    fiscalHtml = `
      <div class="fiscal-box">
        <div class="fiscal-title">EMISSÃO NORMAL</div>
        <div class="fiscal-line">NFC-e nº ${String(nfce.numero || 1).padStart(9, '0')} - Série ${nfce.serie || 1}</div>
        <div class="fiscal-line">Data de Emissão: ${data} ${hora}</div>
        <div class="fiscal-line">Protocolo: ${nfce.protocolo || '141260000000000'}</div>
        <div class="fiscal-line" style="margin-top:4px;font-weight:bold;">CHAVE DE ACESSO:</div>
        <div class="chave-acesso">${chaveFormatada}</div>
        
        <div class="consumidor-box">
          ${cpfFormatado ? `<b>CONSUMIDOR CPF:</b> ${cpfFormatado}` : '<b>CONSUMIDOR:</b> NÃO IDENTIFICADO'}
        </div>

        ${qrCodeDataUrl ? `
          <div class="qrcode-wrapper">
            <img src="${qrCodeDataUrl}" alt="QR Code NFC-e SEFAZ" class="qrcode-img" />
            <p class="qrcode-legend">Consulta via leitor de QR Code</p>
            <p class="qrcode-site">www.fazenda.pr.gov.br/nfce/consulta</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>${isNfce ? 'DANFE NFC-e' : 'Cupom'}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Courier New',monospace;font-size:11px;color:#000;background:#fff;width:80mm;padding:4mm;}
    .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;}
    .header h1{font-size:13px;font-weight:bold;letter-spacing:0.5px;}
    .header p{font-size:10px;margin-top:1px;}
    .danfe-badge{font-size:9px;font-weight:bold;text-transform:uppercase;margin-top:4px;border:1px solid #000;padding:2px 4px;display:inline-block;}
    .danfe-desc{font-size:8px;margin-top:2px;}
    .info{font-size:10px;margin-bottom:6px;border-bottom:1px dashed #000;padding-bottom:6px;}
    table{width:100%;border-collapse:collapse;}
    td{padding:2px 0;vertical-align:top;}
    td.nome{width:50%;font-weight:bold;}
    td.qtd{width:28%;text-align:center;}
    td.preco{width:22%;text-align:right;font-weight:bold;}
    td.sub{font-size:9px;color:#444;padding-bottom:4px;border-bottom:1px dotted #ccc;}
    .col-header td{font-weight:bold;font-size:9px;text-transform:uppercase;border-bottom:1px solid #000;padding-bottom:3px;}
    .total-box{border-top:1px dashed #000;margin-top:6px;padding-top:6px;display:flex;justify-content:space-between;align-items:center;}
    .total-label{font-size:13px;font-weight:bold;}
    .total-valor{font-size:18px;font-weight:bold;}
    .pagamento{border-top:1px dashed #000;margin-top:6px;padding-top:6px;font-size:10px;}
    .pagamento .row{display:flex;justify-content:space-between;padding:1px 0;}
    .pagamento .troco{font-weight:bold;font-size:12px;margin-top:2px;}
    .fiscal-box{border-top:1px dashed #000;margin-top:8px;padding-top:6px;text-align:center;}
    .fiscal-title{font-weight:bold;font-size:11px;margin-bottom:3px;}
    .fiscal-line{font-size:9px;line-height:1.3;}
    .chave-acesso{font-size:8.5px;font-weight:bold;letter-spacing:0.5px;margin:3px 0 6px;word-break:break-all;}
    .consumidor-box{font-size:9.5px;border:1px dotted #666;padding:4px;margin:6px 0;text-align:center;}
    .qrcode-wrapper{text-align:center;margin:6px auto;}
    .qrcode-img{width:130px;height:130px;margin:2px auto;display:block;}
    .qrcode-legend{font-size:8.5px;font-weight:bold;margin-top:2px;}
    .qrcode-site{font-size:7.5px;color:#333;}
    .footer{text-align:center;margin-top:10px;font-size:9px;border-top:1px dashed #000;padding-top:6px;}
    @media print{body{width:80mm;}@page{margin:0;size:80mm auto;}}
  </style></head><body>
  <div class="header">
    <h1>${isNfce ? (nfce.danfeInfo?.emitente?.razaoSocial || 'L H REZENDE DA SILVA ACOUGUE LTDA') : nome}</h1>
    ${isNfce ? `
      <p>CNPJ: 68.879.953/0001-05</p>
      <p>Astorga - PR</p>
      <div class="danfe-badge">DANFE NFC-e</div>
      <p class="danfe-desc">Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica</p>
      <p class="danfe-desc">Não permite aproveitamento de crédito de ICMS</p>
    ` : `<p>Sistema de Gestao de Acougue</p>`}
  </div>

  <div class="info">
    <div>Data: ${data}  Hora: ${hora}</div>
    <div>Operacao: ${isNfce ? 'VENDA A CONSUMIDOR' : 'VENDA'}</div>
  </div>

  <table>
    <tr class="col-header"><td>ITEM / DESC</td><td style="text-align:center">QTD</td><td style="text-align:right">TOTAL</td></tr>
    ${linhas}
  </table>

  <div class="total-box">
    <span class="total-label">VALOR TOTAL</span>
    <span class="total-valor">R$ ${total.toFixed(2)}</span>
  </div>

  ${pagamentoHtml}
  ${fiscalHtml}

  <div class="footer">
    <p>*** OBRIGADO PELA PREFERENCIA ***</p>
    <p>Volte sempre!</p>
    <p style="margin-top:4px;font-size:8px;">Casa de Carne Rezende</p>
  </div>
  </body></html>`;

  const janela = window.open('', '_blank', 'width=400,height=700,toolbar=0,menubar=0,scrollbars=0');
  if (!janela) { alert('Permita popups para imprimir o cupom.'); return; }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => { janela.print(); janela.close(); }, 350);
}

export function imprimirFechamentoCaixa(resumo, nomeAcougue) {
  const agora = new Date();
  const data  = agora.toLocaleDateString('pt-BR');
  const hora  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nome  = (nomeAcougue || 'ACOUGUE SAAS').toUpperCase();

  const corStatus = resumo.status === 'CONFERIDO' ? '#000' : resumo.status === 'SOBRA' ? '#000' : '#000';

  const formaHtml = Object.entries(resumo.porForma || {})
    .filter(([, v]) => v > 0)
    .map(([forma, val]) => `
      <div class="row"><span>${forma}</span><span>R$ ${val.toFixed(2)}</span></div>
    `).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Fechamento</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Courier New',monospace;font-size:11px;color:#000;background:#fff;width:80mm;padding:4mm;}
    .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;}
    .header h1{font-size:14px;font-weight:bold;}
    .header h2{font-size:12px;margin-top:2px;}
    .section{margin-top:8px;border-top:1px dashed #000;padding-top:6px;}
    .section-title{font-weight:bold;text-transform:uppercase;font-size:10px;margin-bottom:4px;}
    .row{display:flex;justify-content:space-between;padding:2px 0;font-size:11px;}
    .row.bold{font-weight:bold;font-size:13px;border-top:1px solid #000;margin-top:4px;padding-top:4px;}
    .status{text-align:center;font-size:14px;font-weight:bold;margin-top:8px;border:2px solid #000;padding:6px;letter-spacing:2px;}
    .footer{text-align:center;margin-top:10px;font-size:9px;border-top:1px dashed #000;padding-top:6px;}
    @media print{body{width:80mm;}@page{margin:0;size:80mm auto;}}
  </style></head><body>
  <div class="header">
    <h1>${nome}</h1>
    <h2>FECHAMENTO DE CAIXA</h2>
    <p>${data} — ${hora}</p>
  </div>

  <div class="section">
    <div class="section-title">Movimentos</div>
    <div class="row"><span>Abertura</span><span>R$ ${(resumo.abertura||0).toFixed(2)}</span></div>
    <div class="row"><span>Suprimentos</span><span>R$ ${(resumo.suprimentos||0).toFixed(2)}</span></div>
    <div class="row"><span>Sangrias</span><span>- R$ ${(resumo.sangrias||0).toFixed(2)}</span></div>
  </div>

  <div class="section">
    <div class="section-title">Vendas (${resumo.qtdVendas || 0} transacoes)</div>
    <div class="row"><span>Total Geral</span><span>R$ ${(resumo.totalVendas||0).toFixed(2)}</span></div>
    ${formaHtml}
  </div>

  <div class="section">
    <div class="row bold"><span>Saldo Esperado</span><span>R$ ${(resumo.saldoEsperado||0).toFixed(2)}</span></div>
    <div class="row bold"><span>Valor Contado</span><span>R$ ${(resumo.valorInformado||0).toFixed(2)}</span></div>
    <div class="row bold"><span>Diferenca</span><span>${resumo.diferenca >= 0 ? '+' : ''}R$ ${(resumo.diferenca||0).toFixed(2)}</span></div>
  </div>

  <div class="status">${resumo.status === 'CONFERIDO' ? '✓ CAIXA CONFERIDO' : resumo.status === 'SOBRA' ? '↑ SOBRA NO CAIXA' : '↓ FALTA NO CAIXA'}</div>

  <div class="footer">
    <p>Assinatura: _________________________</p>
    <p style="margin-top:6px;">Powered by Acougue SaaS</p>
  </div>
  </body></html>`;

  const janela = window.open('', '_blank', 'width=400,height=700,toolbar=0,menubar=0,scrollbars=0');
  if (!janela) { alert('Permita popups para imprimir.'); return; }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => { janela.print(); janela.close(); }, 300);
}
