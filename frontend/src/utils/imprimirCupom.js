const FORMA_LABEL = {
  DINHEIRO: 'Dinheiro',
  PIX:      'PIX',
  DEBITO:   'Cartao Debito',
  CREDITO:  'Cartao Credito',
  VOUCHER:  'Voucher Alimentacao',
};

export function imprimirCupom(itensCarrinho, total, nomeAcougue, formaPagamento = 'DINHEIRO', valorPago = 0, troco = 0, pagamentos = null) {
  const agora = new Date();
  const data  = agora.toLocaleDateString('pt-BR');
  const hora  = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nome  = (nomeAcougue || 'ACOUGUE SAAS').toUpperCase();

  const linhas = itensCarrinho.map(item => {
    const isUN = item.unidade === 'UN';
    const qtdStr = isUN ? `${parseFloat(item.peso || item.quantidade || 1)} un` : `${parseFloat(item.peso).toFixed(3)} kg`;
    const precoStr = isUN ? `@ R$ ${item.precoKg.toFixed(2)}/un` : `@ R$ ${item.precoKg.toFixed(2)}/kg`;
    return `
    <tr>
      <td class="nome">${item.nome}</td>
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

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Cupom</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Courier New',monospace;font-size:11px;color:#000;background:#fff;width:80mm;padding:4mm;}
    .header{text-align:center;border-bottom:1px dashed #000;padding-bottom:6px;margin-bottom:6px;}
    .header h1{font-size:14px;font-weight:bold;letter-spacing:1px;}
    .header p{font-size:10px;margin-top:2px;}
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
    .footer{text-align:center;margin-top:10px;font-size:9px;border-top:1px dashed #000;padding-top:6px;}
    @media print{body{width:80mm;}@page{margin:0;size:80mm auto;}}
  </style></head><body>
  <div class="header"><h1>${nome}</h1><p>Sistema de Gestao de Acougue</p></div>
  <div class="info"><div>Data: ${data}  Hora: ${hora}</div><div>Operacao: VENDA</div></div>
  <table>
    <tr class="col-header"><td>PRODUTO</td><td style="text-align:center">PESO</td><td style="text-align:right">VALOR</td></tr>
    ${linhas}
  </table>
  <div class="total-box">
    <span class="total-label">TOTAL</span>
    <span class="total-valor">R$ ${total.toFixed(2)}</span>
  </div>
  ${pagamentoHtml}
  <div class="footer">
    <p>*** OBRIGADO PELA PREFERENCIA ***</p>
    <p>Volte sempre!</p>
    <p style="margin-top:4px;font-size:8px;">Powered by Acougue SaaS</p>
  </div>
  </body></html>`;

  const janela = window.open('', '_blank', 'width=400,height=700,toolbar=0,menubar=0,scrollbars=0');
  if (!janela) { alert('Permita popups para imprimir o cupom.'); return; }
  janela.document.write(html);
  janela.document.close();
  janela.focus();
  setTimeout(() => { janela.print(); janela.close(); }, 300);
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
