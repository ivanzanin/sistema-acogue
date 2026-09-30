import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { imprimirCupom } from '../utils/imprimirCupom';
import { gerarPayloadPix, gerarQrCodePixDataUrl } from '../utils/pix';

// Formas de pagamento idênticas às da Frente de Caixa
const FORMAS = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', cor: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' },
  { id: 'PIX',      label: 'PIX',      icon: '📱', cor: 'border-blue-500 bg-blue-500/10 text-blue-700' },
  { id: 'DEBITO',   label: 'Débito',   icon: '💳', cor: 'border-purple-500 bg-purple-500/10 text-purple-700' },
  { id: 'CREDITO',  label: 'Crédito',  icon: '💳', cor: 'border-orange-500 bg-orange-500/10 text-orange-700' },
  { id: 'VOUCHER',  label: 'Voucher Alim.', icon: '🎫', cor: 'border-teal-500 bg-teal-500/10 text-teal-700' },
];

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatarData = (isoStr) => {
  if (!isoStr) return '--/--/----';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('pt-BR');
};

const formatarDataHora = (isoStr) => {
  if (!isoStr) return '--/-- às --:--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--/-- às --:--';
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
};

// ─── MODAL NOVA COMANDA ───────────────────────────────────────────────────────
function ModalNovaComanda({ onCriar, onFechar }) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState(null);
  const [busy, setBusy] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) return setErro('Preencha o nome do cliente.');
    setBusy(true); setErro(null);
    try {
      const { data } = await api.post('/comandas', { nomeCliente: nome.trim(), numeroMesa: 0 });
      onCriar(data);
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao criar comanda.'); }
    finally { setBusy(false); }
  };

  const inp = 'w-full bg-stone-100 border-2 border-stone-300 rounded-2xl px-5 py-4 text-stone-900 text-base focus:outline-none focus:border-brand-500 font-sans transition-colors';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-stone-200 rounded-3xl p-8 w-full max-w-md shadow-modal">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📋</span>
          <div>
            <p className="text-xl text-stone-900 font-black">Nova Comanda</p>
            <p className="text-xs text-stone-500 font-medium">Informe o nome do cliente para abrir</p>
          </div>
        </div>
        <div className="space-y-4 my-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Nome do Cliente</label>
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus className={inp} placeholder="Ex: João da Silva" onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>
          {erro && <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-xl px-4 py-3">{erro}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={salvar} disabled={busy} className="flex-1 py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-md">
            {busy ? 'Criando...' : '+ Abrir Comanda'}
          </button>
          <button onClick={onFechar} className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-bold rounded-2xl transition-all">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL PESO MANUAL (PRODUTOS KG) ──────────────────────────────────────────
function ModalPesoKG({ produto, pesoInicial, onConfirmar, onCancelar }) {
  const [peso, setPeso] = useState(pesoInicial ? String(pesoInicial) : '');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const confirmar = () => {
    const p = parseFloat(String(peso).replace(',', '.'));
    if (!p || p <= 0) return;
    onConfirmar(p);
  };

  const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
  const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
  const pesoNum = parseFloat(String(peso).replace(',', '.')) || 0;
  const totalItem = +(pesoNum * precoAtivo).toFixed(2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-stone-200 rounded-3xl p-7 w-full max-w-md shadow-modal">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚖️</span>
          <p className="text-xs font-black uppercase tracking-wider text-stone-500">Produto por Quilo (KG)</p>
        </div>
        <p className="text-2xl font-black text-stone-900 mb-1.5 leading-snug">{produto.nome}</p>
        {temPromo ? (
          <div className="flex items-center gap-2 mb-5">
            <span className="text-xs bg-amber-500/15 text-amber-800 font-black px-2 py-0.5 rounded-md border border-amber-500/30">🔥 Promo</span>
            <span className="text-lg font-black text-amber-700 font-mono">{fmt(produto.precoPromocao)}/kg</span>
            <span className="text-xs text-stone-400 line-through font-mono">{fmt(produto.precoVenda)}/kg</span>
          </div>
        ) : (
          <p className="text-base font-bold text-emerald-700 font-mono mb-5">{fmt(produto.precoVenda)}/kg</p>
        )}

        <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">Digite o Peso (kg)</label>
        <input
          ref={inputRef}
          type="number" step="0.001" value={peso}
          onChange={e => setPeso(e.target.value)}
          placeholder="0.000"
          className="w-full bg-stone-100 border-2 border-stone-300 focus:border-brand-500 rounded-2xl px-5 py-4 text-stone-900 text-3xl font-black font-mono focus:outline-none text-right mb-3 transition-colors"
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
        />
        {pesoNum > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex justify-between items-center mb-5">
            <span className="text-xs font-bold text-emerald-800">Total calculado:</span>
            <span className="text-2xl font-black text-emerald-800 font-mono">{fmt(totalItem)}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={confirmar} disabled={!peso || parseFloat(String(peso).replace(',','.')) <= 0}
            className="flex-1 py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-md">
            Adicionar à Comanda (Enter)
          </button>
          <button onClick={onCancelar}
            className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-all">
            Cancelar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL ITEM DIVERSOS (999) ────────────────────────────────────────────────
function ModalItemDiversos({ onConfirmar, onCancelar }) {
  const [descricao, setDescricao] = useState('Diversos');
  const [valor, setValor]         = useState('');
  const [qtd, setQtd]             = useState(1);
  const valorInputRef             = useRef(null);

  useEffect(() => {
    setTimeout(() => valorInputRef.current?.focus(), 100);
  }, []);

  const confirmar = () => {
    const v = parseFloat(valor.replace(',', '.'));
    if (!v || v <= 0) return;
    const q = Math.max(1, parseInt(qtd) || 1);
    onConfirmar({
      descricao: descricao.trim() || 'Diversos',
      valor: v,
      qtd: q,
    });
  };

  const vNum = parseFloat(valor.replace(',', '.')) || 0;
  const totalItem = vNum * (parseInt(qtd) || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-stone-200 rounded-3xl p-7 w-full max-w-md shadow-modal">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏷️</span>
          <div>
            <p className="text-lg font-black text-stone-900">Item Avulso / Diversos (999)</p>
            <p className="text-xs text-stone-500 font-medium">Adicionar produto com valor livre na comanda</p>
          </div>
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Descrição do Item</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Diversos, Tempero especial, Gelo..."
              className="w-full bg-stone-100 hover:bg-white focus:bg-white border-2 border-stone-200 focus:border-brand-500 rounded-xl px-4 py-3 text-stone-900 text-sm font-bold focus:outline-none transition-colors"
              onKeyDown={e => { if (e.key === 'Enter') valorInputRef.current?.focus(); if (e.key === 'Escape') onCancelar(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Valor Unitário (R$) *</label>
            <input
              ref={valorInputRef}
              type="number"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full bg-stone-100 border-2 border-stone-300 focus:border-brand-500 rounded-2xl px-5 py-3.5 text-stone-900 text-3xl font-black font-mono focus:outline-none text-right transition-colors"
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Quantidade</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQtd(q => Math.max(1, (parseInt(q) || 1) - 1))}
                className="w-11 h-11 rounded-xl border-2 border-stone-300 bg-stone-100 hover:bg-stone-200 font-black text-xl flex items-center justify-center transition-colors">
                −
              </button>
              <input
                type="number"
                min="1"
                value={qtd}
                onChange={e => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center py-2.5 border-2 border-stone-300 rounded-xl font-black text-lg bg-white"
                onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
              />
              <button
                type="button"
                onClick={() => setQtd(q => (parseInt(q) || 1) + 1)}
                className="w-11 h-11 rounded-xl border-2 border-stone-300 bg-stone-100 hover:bg-stone-200 font-black text-xl flex items-center justify-center transition-colors">
                +
              </button>
            </div>
          </div>

          {vNum > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center text-xs">
              <span className="text-amber-800 font-bold">Total do item:</span>
              <span className="font-black text-amber-900 text-lg font-mono">{fmt(totalItem)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={confirmar}
            disabled={!vNum || vNum <= 0}
            className="flex-1 py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-md">
            Adicionar (Enter)
          </button>
          <button
            onClick={onCancelar}
            className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-2xl transition-all">
            Cancelar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEÇÃO PIX DINÂMICO ───────────────────────────────────────────────────────
function SecaoPixPdv({ total, cliente }) {
  const [copiado, setCopiado]       = useState(false);
  const [qrCodeUrl, setQrCodeUrl]   = useState('');
  const [payloadPix, setPayloadPix] = useState('');

  const chavePix  = localStorage.getItem('pix_chave') || cliente?.cnpj || '';
  const nomePix   = localStorage.getItem('pix_nome')  || cliente?.nomeAcougue || 'ACOUQUE';
  const cidadePix = localStorage.getItem('pix_cidade') || 'SAO PAULO';

  useEffect(() => {
    if (!chavePix) return;
    const payload = gerarPayloadPix({
      chave: chavePix,
      nome: nomePix,
      cidade: cidadePix,
      valor: total,
      txId: 'COM' + Date.now().toString().slice(-6),
    });
    setPayloadPix(payload);
    gerarQrCodePixDataUrl(payload).then(url => setQrCodeUrl(url)).catch(() => {});
  }, [chavePix, nomePix, cidadePix, total]);

  const copiarPix = () => {
    if (!payloadPix) return;
    navigator.clipboard.writeText(payloadPix);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  if (!chavePix) {
    return (
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
        <p className="text-amber-800 font-bold text-xs mb-1">⚠️ Chave PIX não cadastrada</p>
        <p className="text-amber-700 text-[11px] mb-2">
          Cadastre sua chave PIX na tela de Configurações para gerar o QR Code automático.
        </p>
        <button
          type="button"
          onClick={() => window.open('/configuracoes', '_blank')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold">
          ⚙️ Cadastrar Chave PIX
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-stone-50 border border-stone-200 rounded-2xl p-4 flex flex-col items-center">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📱</span>
        <span className="text-xs font-bold text-stone-800">QR Code PIX — Valor Exato</span>
      </div>

      {qrCodeUrl ? (
        <div className="bg-white p-2 rounded-xl border border-stone-200 shadow-sm mb-2">
          <img src={qrCodeUrl} alt="QR Code Pix" className="w-40 h-40 mx-auto block" />
        </div>
      ) : (
        <div className="w-40 h-40 flex items-center justify-center text-xs text-stone-400 bg-white border border-stone-200 rounded-xl mb-2">
          Gerando QR Code...
        </div>
      )}

      <div className="w-full flex items-center justify-between text-xs px-1 mb-2">
        <span className="text-stone-500 truncate max-w-[170px]">Titular: <strong className="text-stone-800">{nomePix}</strong></span>
        <span className="text-emerald-700 font-bold font-mono text-sm">{fmt(total)}</span>
      </div>

      <button
        type="button"
        onClick={copiarPix}
        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all border ${copiado ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'}`}>
        {copiado ? '✓ Código Copiado para Transferência!' : '📋 Copiar Código PIX (Copia e Cola)'}
      </button>
    </div>
  );
}

// ─── MODAL CÓDIGO NÃO ENCONTRADO ──────────────────────────────────────────────
function ModalCodigoNaoEncontrado({ codigo, balanca, codigoProduto, valorTotal, produtos, onVincular, onCadastrar, onFechar }) {
  const [busca, setBusca] = useState('');
  const filtrados = busca.trim()
    ? produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.categoria?.toLowerCase().includes(busca.toLowerCase()))
    : produtos;
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-stone-200 rounded-3xl w-full max-w-lg shadow-modal overflow-hidden flex flex-col" style={{maxHeight:'85vh'}}>
        <div className="p-6 border-b border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚠️</span>
            <p className="font-black text-stone-900 text-lg">Código não cadastrado</p>
          </div>
          <p className="text-sm font-medium text-stone-600">
            O código <span className="font-mono font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">{codigo}</span> não está vinculado a nenhum produto.
          </p>
          {balanca && (
            <div className="mt-3.5 bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-black uppercase tracking-wider text-blue-800 mb-1">🏷️ Etiqueta com Peso/Preço Detectada</p>
              <p className="text-sm text-blue-900">Código do produto: <span className="font-mono font-black">{codigoProduto}</span></p>
              <p className="text-sm text-blue-900">Valor calculado: <span className="font-mono font-black">{fmt(valorTotal)}</span></p>
            </div>
          )}
        </div>

        <div className="p-6 border-b border-stone-200 bg-stone-50/50">
          <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Opção 1 — Cadastrar Novo</p>
          <button onClick={onCadastrar}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95 shadow-md bg-amber-600 hover:bg-amber-700">
            + Cadastrar Novo Produto
          </button>
        </div>

        <div className="px-6 pt-5 pb-3 flex-shrink-0">
          <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Opção 2 — Vincular a Produto Existente</p>
          <div className="relative mb-3">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-base">🔍</span>
            <input ref={inputRef} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto cadastrado..."
              className="w-full bg-stone-100 hover:bg-white focus:bg-white border-2 border-stone-200 focus:border-brand-500 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-stone-900 focus:outline-none transition-colors" />
          </div>
        </div>
        <div className="px-6 pb-4 flex-1 overflow-y-auto space-y-2" style={{maxHeight:'220px'}}>
          {filtrados.length === 0 ? (
            <p className="text-center text-stone-400 text-xs py-4 font-medium">Nenhum produto encontrado</p>
          ) : (
            filtrados.map(p => (
              <button key={p.id} onClick={() => onVincular(p.id)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border-2 border-stone-200 hover:border-amber-500 hover:bg-amber-50/30 bg-white transition-all text-left">
                <div className="flex-1 min-w-0 pr-3">
                  <p className="font-black text-sm text-stone-900 truncate">{p.nome}</p>
                  <p className="text-xs font-medium text-stone-500">{p.categoria} · {p.unidade}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-sm text-emerald-700 font-mono">{fmt(p.precoVenda)}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="p-4 border-t border-stone-200 flex justify-end">
          <button onClick={onFechar} className="px-5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL FINALIZAR COMANDA (MÉTODOS FRENTE DE CAIXA + DIVIDIR CONTA) ────────
function ModalFinalizarComanda({ comanda, produtos = [], cliente, onFechada, onCancelar }) {
  const [formaPagamento, setFormaPagamento] = useState('DINHEIRO');
  const [valorPago, setValorPago]           = useState('');
  const [salvando, setSalvando]             = useState(false);
  const [erroVenda, setErroVenda]           = useState(null);

  // Estados de Divisão de Conta
  const [modoDividido, setModoDividido]     = useState(false);
  const [numPessoas, setNumPessoas]         = useState(2);
  const [divisoes, setDivisoes]             = useState([]);
  const [pixModalInfo, setPixModalInfo]     = useState(null);

  // Regra de Voucher: se pagar com Voucher (único ou em divisão), a promoção sai
  const isVoucherAtivo = (!modoDividido && formaPagamento === 'VOUCHER') ||
    (modoDividido && divisoes.some(d => d.forma === 'VOUCHER'));

  const itensCalculados = (comanda.itens || []).map(item => {
    const prod = item.produto || produtos.find(p => p.id === item.produtoId);
    const isDiversos = prod?.codigoBarras === '999' || prod?.nome === 'Diversos' || item.nome?.toLowerCase().includes('diversos');
    const precoNormal = prod?.precoVenda || item.precoKg;
    const temPromo = prod && prod.precoPromocao && prod.precoPromocao > 0 && item.precoKg < prod.precoVenda;

    if (isVoucherAtivo && temPromo && !isDiversos && precoNormal > 0) {
      const totalNormal = +(parseFloat(item.pesoKg) * precoNormal).toFixed(2);
      return {
        ...item,
        precoKgCobrado: precoNormal,
        totalCobrado: totalNormal,
        promocaoRemovidaPorVoucher: true,
      };
    }
    return {
      ...item,
      precoKgCobrado: item.precoKg,
      totalCobrado: item.total,
      promocaoRemovidaPorVoucher: false,
    };
  });

  const totalGeral = itensCalculados.reduce((s, i) => s + i.totalCobrado, 0);
  const temItensComPromocao = (comanda.itens || []).some(item => {
    const prod = item.produto || produtos.find(p => p.id === item.produtoId);
    return prod && prod.precoPromocao && prod.precoPromocao > 0 && item.precoKg < prod.precoVenda;
  });

  const troco = formaPagamento === 'DINHEIRO' && parseFloat(valorPago) > totalGeral
    ? parseFloat(valorPago) - totalGeral : 0;

  // Gerador de divisões de conta
  const gerarDivisoes = (qtd, totalAtual, existentes = []) => {
    const qtdNum = Math.max(2, Math.min(30, parseInt(qtd) || 2));
    const valorBase = Math.floor((totalAtual / qtdNum) * 100) / 100;
    const diferencaCentavos = Math.round((totalAtual - valorBase * qtdNum) * 100);

    const lista = [];
    for (let i = 0; i < qtdNum; i++) {
      const ext = existentes[i];
      const valorItem = i < diferencaCentavos ? +(valorBase + 0.01).toFixed(2) : valorBase;
      lista.push({
        id: ext ? ext.id : i + 1,
        nome: ext?.nome || `Pessoa ${i + 1}`,
        forma: ext?.forma || formaPagamento || 'DINHEIRO',
        valor: ext && ext.valor !== undefined ? ext.valor : valorItem,
        valorPago: ext?.valorPago || '',
      });
    }
    return lista;
  };

  const ativarDivisao = () => {
    setDivisoes(gerarDivisoes(numPessoas, totalGeral, []));
    setModoDividido(true);
  };

  const mudarNumPessoas = (novaQtd) => {
    const val = Math.max(2, Math.min(30, parseInt(novaQtd) || 2));
    setNumPessoas(val);
    setDivisoes(prev => gerarDivisoes(val, totalGeral, prev));
  };

  const redistribuirIgualmente = () => {
    setDivisoes(gerarDivisoes(numPessoas, totalGeral, []));
  };

  const atualizarDivisao = (id, campo, valor) => {
    setDivisoes(prev => prev.map(d => d.id === id ? { ...d, [campo]: valor } : d));
  };

  const aplicarFormaATodos = (fId) => {
    setDivisoes(prev => prev.map(d => ({ ...d, forma: fId })));
  };

  const somaDivisoes = divisoes.reduce((acc, d) => acc + (parseFloat(d.valor) || 0), 0);
  const diferencaDivisao = +(totalGeral - somaDivisoes).toFixed(2);

  const resumoFormasDivisao = divisoes.reduce((acc, d) => {
    const f = d.forma || 'DINHEIRO';
    if (!acc[f]) acc[f] = { qtd: 0, total: 0 };
    acc[f].qtd += 1;
    acc[f].total += (parseFloat(d.valor) || 0);
    return acc;
  }, {});

  const finalizarFechamento = async () => {
    if (!comanda.itens?.length || salvando) return;

    let payloadFechamento = {};
    let pagamentosParaCupom = null;

    if (modoDividido) {
      if (Math.abs(diferencaDivisao) > 0.05) {
        return setErroVenda(`A soma das pessoas (${fmt(somaDivisoes)}) não bate com o total (${fmt(totalGeral)}). Ajuste os valores.`);
      }

      for (const d of divisoes) {
        if (d.forma === 'DINHEIRO' && d.valorPago && parseFloat(d.valorPago) < parseFloat(d.valor)) {
          return setErroVenda(`${d.nome}: valor entregue em dinheiro é menor que a cota.`);
        }
      }

      const pags = divisoes.map(d => ({
        forma: d.forma,
        valor: parseFloat(d.valor) || 0,
        nome: d.nome,
        valorPago: d.forma === 'DINHEIRO' && d.valorPago ? parseFloat(d.valorPago) : undefined,
      }));

      payloadFechamento.pagamentos = pags;
      pagamentosParaCupom = pags;
    } else {
      if (formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== '') {
        return setErroVenda('Valor pago insuficiente.');
      }
      payloadFechamento.formaPagamento = formaPagamento;
      payloadFechamento.valorPago = parseFloat(valorPago) || totalGeral;
    }

    setSalvando(true);
    setErroVenda(null);
    try {
      const { data } = await api.post(`/comandas/${comanda.id}/fechar`, payloadFechamento);

      // Imprime cupom fiscal/não-fiscal
      imprimirCupom(
        itensCalculados.map(i => ({
          nome: i.nome,
          unidade: i.produto?.unidade || 'KG',
          peso: String(i.pesoKg),
          quantidade: i.pesoKg,
          precoKg: i.precoKgCobrado,
          total: i.totalCobrado,
        })),
        totalGeral,
        cliente?.nomeAcougue,
        modoDividido ? 'MULTIPLO' : formaPagamento,
        modoDividido ? totalGeral : (parseFloat(valorPago) || totalGeral),
        data.troco || 0,
        pagamentosParaCupom
      );

      onFechada();
    } catch (e) {
      setErroVenda(e.response?.data?.erro || 'Erro ao fechar comanda.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
      <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-modal max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4 flex-shrink-0">
          <div>
            <p className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">Fechar Comanda</p>
            <p className="text-xs sm:text-sm text-stone-500 font-medium">{comanda.nomeCliente} — Aberta em {formatarData(comanda.criadaEm)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-black uppercase tracking-wider text-stone-400 block mb-0.5">Total Geral</span>
            <span className="text-3xl sm:text-4xl font-black text-stone-900 font-mono tracking-tight">{fmt(totalGeral)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          {isVoucherAtivo && temItensComPromocao && (
            <div className="mb-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-start gap-3">
              <span className="text-2xl leading-none">🎫</span>
              <div>
                <p className="text-sm font-black text-amber-900">
                  Voucher Selecionado (Preço Normal Aplicado)
                </p>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Os itens com desconto promocional foram recalculados automaticamente pelo <strong>preço normal</strong> de cadastro. A promoção é válida para pagamentos em Dinheiro, PIX e Cartões.
                </p>
              </div>
            </div>
          )}

          {!modoDividido ? (
            <>
              {/* Seletor de Forma de Pagamento Única */}
              <div className="grid grid-cols-5 gap-2.5 mb-4">
                {FORMAS.map(f => (
                  <button key={f.id} onClick={() => { setFormaPagamento(f.id); if (f.id !== 'DINHEIRO') setValorPago(''); }}
                    className={`flex flex-col items-center py-3.5 sm:py-4 rounded-2xl border-2 text-xs sm:text-sm font-black uppercase tracking-wide transition-all ${formaPagamento === f.id ? f.cor : 'border-stone-200 bg-stone-50/50 text-stone-600 hover:border-stone-400'}`}>
                    <span className="text-2xl sm:text-3xl mb-1.5">{f.icon}</span>{f.label}
                  </button>
                ))}
              </div>

              {/* Card para Ativar Divisão da Conta */}
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-black text-emerald-900 flex items-center gap-2">
                    <span className="text-lg">🍽️</span> Dividir conta entre várias pessoas?
                  </span>
                  <p className="text-xs text-emerald-700 mt-1 font-medium">
                    Receba de cada pessoa com um método diferente (ex: 2 no PIX, 3 no cartão).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={ativarDivisao}
                  className="text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5 flex-shrink-0"
                >
                  <span>Dividir</span>
                  <span>→</span>
                </button>
              </div>

              {/* Seção PIX Dinâmico */}
              {formaPagamento === 'PIX' && (
                <SecaoPixPdv total={totalGeral} cliente={cliente} />
              )}

              {/* Seção Dinheiro */}
              {formaPagamento === 'DINHEIRO' && (
                <div className="mb-4">
                  <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Valor Recebido do Cliente (R$)</label>
                  <input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)}
                    placeholder={totalGeral.toFixed(2)} autoFocus
                    className="w-full bg-stone-100 border-2 border-stone-300 focus:border-brand-500 rounded-2xl px-5 py-3.5 text-stone-900 text-3xl font-black focus:outline-none font-mono text-right transition-colors"
                    onKeyDown={e => e.key === 'Enter' && finalizarFechamento()} />
                  {troco > 0 && (
                    <div className="mt-3 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl px-5 py-3.5 flex justify-between items-center">
                      <span className="text-emerald-800 text-sm font-black uppercase tracking-wider">Troco a Devolver</span>
                      <span className="text-emerald-800 text-3xl font-black font-mono">{fmt(troco)}</span>
                    </div>
                  )}
                  {parseFloat(valorPago) > 0 && parseFloat(valorPago) < totalGeral && (
                    <div className="mt-3 bg-red-500/10 border-2 border-red-500/30 rounded-2xl px-4 py-2.5 text-center">
                      <p className="text-red-700 text-sm font-bold">Falta {fmt(totalGeral - parseFloat(valorPago))}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Banner Modo Dividido */}
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">🍽️</span>
                  <div>
                    <p className="text-sm font-black text-emerald-900">Divisão de Conta Ativada</p>
                    <p className="text-xs text-emerald-700 font-medium">Selecione o método de pagamento individual de cada pessoa</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModoDividido(false)}
                  className="text-xs font-bold text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-3 py-1.5 rounded-lg transition-colors"
                  title="Voltar ao pagamento único da conta toda"
                >
                  ✕ Cancelar divisão
                </button>
              </div>

              {/* Controle de Pessoas e Reset */}
              <div className="flex items-center justify-between gap-3 mb-3 bg-stone-50 p-3 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-stone-700">
                  <span className="font-bold">Dividir em:</span>
                  <button
                    type="button"
                    onClick={() => mudarNumPessoas(Math.max(2, numPessoas - 1))}
                    className="w-7 h-7 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 font-black text-base flex items-center justify-center transition-colors"
                  >−</button>
                  <input
                    type="number"
                    min="2"
                    max="30"
                    value={numPessoas}
                    onChange={e => mudarNumPessoas(Math.max(2, Math.min(30, parseInt(e.target.value) || 2)))}
                    className="w-12 text-center py-1 border border-stone-300 rounded-lg font-black text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => mudarNumPessoas(Math.min(30, numPessoas + 1))}
                    className="w-7 h-7 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 font-black text-base flex items-center justify-center transition-colors"
                  >+</button>
                  <span className="font-semibold">pessoas</span>
                </div>
                <button
                  type="button"
                  onClick={redistribuirIgualmente}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                  title="Divide o valor igualmente entre todas as pessoas"
                >
                  {fmt(totalGeral / numPessoas)} cada (Resetar)
                </button>
              </div>

              {/* Atalho para definir forma de todos */}
              <div className="flex items-center gap-2 mb-3 text-xs text-stone-500 overflow-x-auto pb-1">
                <span className="flex-shrink-0 font-bold">Mudar todos:</span>
                {FORMAS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => aplicarFormaATodos(f.id)}
                    className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold border border-stone-200 flex items-center gap-1.5 transition-colors flex-shrink-0"
                  >
                    <span>{f.icon}</span>
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>

              {/* Lista de Pessoas / Divisões */}
              <div className="space-y-2.5 mb-3 max-h-56 overflow-y-auto pr-1">
                {divisoes.map((p, idx) => (
                  <div key={p.id} className="p-3 rounded-2xl border border-stone-200 bg-stone-50/70 hover:bg-stone-50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-stone-200 text-xs font-black text-stone-700 flex items-center justify-center">{idx + 1}</span>
                        <input
                          value={p.nome}
                          onChange={e => atualizarDivisao(p.id, 'nome', e.target.value)}
                          className="text-xs font-bold text-stone-800 bg-transparent hover:bg-white focus:bg-white border border-transparent focus:border-stone-300 rounded px-2 py-0.5 w-32"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-stone-500">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={p.valor}
                          onChange={e => atualizarDivisao(p.id, 'valor', parseFloat(e.target.value) || 0)}
                          className="w-24 text-right px-2 py-1 border border-stone-300 rounded-lg font-black text-sm bg-white text-stone-900 font-mono"
                        />
                      </div>
                    </div>

                    {/* 5 Métodos de Pagamento */}
                    <div className="grid grid-cols-5 gap-1.5">
                      {FORMAS.map(f => {
                        const ativo = p.forma === f.id;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => atualizarDivisao(p.id, 'forma', f.id)}
                            className={`py-1.5 px-1 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 border transition-all ${
                              ativo ? f.cor : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                            }`}
                          >
                            <span>{f.icon}</span>
                            <span className="truncate">{f.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Botão Ver QR Code PIX */}
                    {p.forma === 'PIX' && (
                      <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between">
                        <span className="text-xs text-blue-700 font-semibold">PIX: <strong>{fmt(p.valor || 0)}</strong></span>
                        <button
                          type="button"
                          onClick={() => setPixModalInfo({ nome: p.nome, valor: p.valor })}
                          className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg flex items-center gap-1 shadow-sm transition-colors"
                        >
                          <span>📱</span>
                          <span>Ver QR Code</span>
                        </button>
                      </div>
                    )}

                    {/* Campo Dinheiro recebido e troco */}
                    {p.forma === 'DINHEIRO' && (
                      <div className="mt-2 pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                        <span className="text-stone-600 font-bold">Dinheiro entregue:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder={Number(p.valor).toFixed(2)}
                            value={p.valorPago}
                            onChange={e => atualizarDivisao(p.id, 'valorPago', e.target.value)}
                            className="w-24 text-right px-2 py-1 border border-stone-300 rounded-lg font-mono font-bold text-sm bg-white"
                          />
                          {parseFloat(p.valorPago) > parseFloat(p.valor) && (
                            <span className="text-xs font-black text-emerald-800 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 font-mono">
                              Troco {fmt(parseFloat(p.valorPago) - parseFloat(p.valor))}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Resumo e Totalizador da Divisão */}
              <div className="mb-3 p-3 rounded-2xl border text-xs flex flex-col gap-1.5 bg-stone-50 border-stone-200">
                <div className="flex justify-between items-center text-sm font-bold">
                  <span className="text-stone-600">Total Distribuído:</span>
                  <span className={`font-black font-mono ${Math.abs(diferencaDivisao) <= 0.01 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {fmt(somaDivisoes)} / {fmt(totalGeral)}
                  </span>
                </div>

                <div className="pt-1.5 border-t border-stone-200 flex flex-wrap gap-1.5">
                  {Object.entries(resumoFormasDivisao).map(([forma, item]) => item.total > 0 && (
                    <span key={forma} className="bg-white border border-stone-200 text-stone-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <span>{FORMAS.find(f => f.id === forma)?.icon}</span>
                      <span>{item.qtd}x {forma}:</span>
                      <strong className="font-mono">{fmt(item.total)}</strong>
                    </span>
                  ))}
                </div>

                {Math.abs(diferencaDivisao) > 0.01 && (
                  <div className="mt-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                    {diferencaDivisao > 0
                      ? `⚠️ Falta distribuir ${fmt(diferencaDivisao)}`
                      : `⚠️ Total excede o valor da comanda em ${fmt(Math.abs(diferencaDivisao))}`}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {erroVenda && <p className="mb-3 text-red-700 text-sm font-medium bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex-shrink-0">{erroVenda}</p>}

        <div className="flex gap-3 pt-3 border-t border-stone-200 flex-shrink-0">
          <button
            onClick={finalizarFechamento}
            disabled={
              salvando ||
              (!modoDividido && formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== '') ||
              (modoDividido && Math.abs(diferencaDivisao) > 0.05)
            }
            className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-base uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-98"
          >
            {salvando ? 'Processando...' : 'Confirmar Fechamento (F10)'}
          </button>
          <button
            onClick={onCancelar}
            className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-base rounded-2xl transition-all"
          >
            Voltar (Esc)
          </button>
        </div>
      </div>

      {/* Modal QR Code Pix Individual para divisão */}
      {pixModalInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-base font-black text-stone-900">QR Code PIX - {pixModalInfo.nome}</p>
                <p className="text-xs text-stone-500 font-medium">Valor individual: <strong className="text-blue-700 font-mono text-sm">{fmt(pixModalInfo.valor || 0)}</strong></p>
              </div>
              <button
                type="button"
                onClick={() => setPixModalInfo(null)}
                className="text-stone-400 hover:text-stone-700 text-xl font-bold w-8 h-8 rounded-full flex items-center justify-center hover:bg-stone-100"
              >✕</button>
            </div>
            <SecaoPixPdv total={parseFloat(pixModalInfo.valor || 0)} cliente={cliente} />
            <button
              type="button"
              onClick={() => setPixModalInfo(null)}
              className="w-full mt-2 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xs uppercase tracking-wider rounded-xl transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VISÃO DA COMANDA COM FORMATO FRENTE DE CAIXA (PDV) ───────────────────────
function VisaoMesaComanda({ comanda: inicial, produtos, vendidosCount, cliente, onVoltar, onFechada }) {
  const [comanda, setComanda]                 = useState(inicial);
  const [adicionando, setAdicionando]         = useState(null);
  const [removendo, setRemovendo]             = useState(null);
  const [modalFechar, setModalFechar]         = useState(false);
  const [itemDiversosAberto, setItemDiversosAberto] = useState(false);
  const [produtoKGPendente, setProdutoKGPendente] = useState(null);
  const [codigoNaoEncontrado, setCodigoNaoEncontrado] = useState(null);
  const [busca, setBusca]                     = useState('');
  const [qtds, setQtds]                       = useState({});
  const [flashCodigo, setFlashCodigo]         = useState(null);
  const [erro, setErro]                       = useState(null);
  const [ultimoItemAdicionado, setUltimoItemAdicionado] = useState(null);

  // Modo de layout salvo no localStorage (Clássico ou Limpo)
  const [modoLayout, setModoLayout] = useState(() => localStorage.getItem('comanda_pdv_layout') || 'classico');

  // Campo de busca inferior (Modo Limpo)
  const [buscaBaixo, setBuscaBaixo]           = useState('');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceSugerido, setIndiceSugerido]   = useState(0);

  const buscaRef       = useRef(null);
  const inputBaixoRef  = useRef(null);
  const sugestoesRef   = useRef(null);
  const barcodeBuffer  = useRef('');
  const barcodeTimer   = useRef(null);

  useEffect(() => {
    if (modoLayout === 'classico') {
      buscaRef.current?.focus();
    } else {
      inputBaixoRef.current?.focus();
    }
  }, [modoLayout]);

  const alternarModoLayout = (modo) => {
    setModoLayout(modo);
    localStorage.setItem('comanda_pdv_layout', modo);
    setTimeout(() => {
      if (modo === 'classico') buscaRef.current?.focus();
      else inputBaixoRef.current?.focus();
    }, 100);
  };

  const recarregar = async () => {
    try {
      const { data } = await api.get(`/comandas/${comanda.id}`);
      setComanda(data);
    } catch {}
  };

  // Filtra produtos pela busca do modo clássico
  const produtosFiltrados = busca.trim()
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        (p.categoria && p.categoria.toLowerCase().includes(busca.toLowerCase())) ||
        (p.codigoBarras && p.codigoBarras.includes(busca))
      )
    : produtos;

  // Ordena por mais vendidos depois agrupa por categoria
  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => (vendidosCount[b.id] || 0) - (vendidosCount[a.id] || 0));
  const porCategoria = {};
  for (const p of produtosOrdenados) {
    const cat = p.categoria || 'Geral';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(p);
  }

  // Sugestões do modo limpo
  const produtosSugeridos = buscaBaixo.trim().length > 0
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(buscaBaixo.toLowerCase()) ||
        (p.codigoBarras && p.codigoBarras.includes(buscaBaixo.trim())) ||
        (p.categoria && p.categoria.toLowerCase().includes(buscaBaixo.toLowerCase()))
      ).slice(0, 8)
    : [];

  const adicionarItem = async (produto, quantidade) => {
    setAdicionando(produto.id);
    setErro(null);
    try {
      const { data } = await api.post(`/comandas/${comanda.id}/itens`, {
        produtoId: produto.id,
        pesoKg: quantidade
      });
      setComanda(data);
      setUltimoItemAdicionado({
        nome: produto.nome,
        unidade: produto.unidade || 'KG',
        peso: String(quantidade),
        precoKg: (produto.precoPromocao && produto.precoPromocao > 0) ? produto.precoPromocao : produto.precoVenda,
        total: +(((produto.precoPromocao && produto.precoPromocao > 0) ? produto.precoPromocao : produto.precoVenda) * quantidade).toFixed(2),
        emPromocao: !!(produto.precoPromocao && produto.precoPromocao > 0),
      });
      setQtds(q => ({ ...q, [produto.id]: 1 }));
      setBuscaBaixo('');
      setSugestoesAbertas(false);
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao adicionar item.');
    } finally {
      setAdicionando(null);
    }
  };

  const adicionarDiversos = async ({ descricao, valor, qtd }) => {
    setErro(null);
    try {
      const { data } = await api.post(`/comandas/${comanda.id}/itens`, {
        isDiversos: true,
        produtoId: 999,
        nome: descricao,
        precoUnitario: valor,
        pesoKg: qtd,
      });
      setComanda(data);
      setItemDiversosAberto(false);
      setUltimoItemAdicionado({
        nome: descricao,
        unidade: 'UN',
        peso: String(qtd),
        precoKg: valor,
        total: +(valor * qtd).toFixed(2),
        emPromocao: false,
      });
      setBuscaBaixo('');
      setSugestoesAbertas(false);
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao adicionar item avulso.');
    }
  };

  const removerItem = async (itemId) => {
    setRemovendo(itemId);
    try {
      await api.delete(`/comandas/${comanda.id}/itens/${itemId}`);
      await recarregar();
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao remover item.');
    } finally {
      setRemovendo(null);
    }
  };

  // ── Scanner de Código de Barras e Balança ──────────────────────────────
  const processarCodigo = useCallback(async (codigo, multiplicador = 1) => {
    if (!codigo || codigo.length < 3) return;
    if (codigo.trim() === '999') {
      setItemDiversosAberto(true);
      return;
    }

    setFlashCodigo(codigo);
    setTimeout(() => setFlashCodigo(null), 1500);

    try {
      const { data: produto } = await api.get(`/produtos/barcode/${codigo}`);

      // Caso 1: código de balança KG — já vem com peso e valor calculados
      if (produto.balancaInfo && produto.unidade === 'KG' && produto.balancaInfo.pesoCalculado) {
        const peso = +(produto.balancaInfo.pesoCalculado * multiplicador).toFixed(3);
        await adicionarItem(produto, peso);
        return;
      }

      // Caso 2: produto KG sem código de balança — pede peso manual
      if (produto.unidade === 'KG') {
        setProdutoKGPendente(produto);
        return;
      }

      // Caso 3: produto UN — adiciona quantidade
      await adicionarItem(produto, Math.max(1, multiplicador));
    } catch (e) {
      if (e.response?.status === 404) {
        const balanca = e.response?.data?.codigoBalanca;
        const codProd = e.response?.data?.codigoProduto;
        const valor   = e.response?.data?.valorTotal;
        setCodigoNaoEncontrado({
          codigo,
          balanca,
          codigoProduto: codProd,
          valorTotal: valor,
        });
      } else {
        setErro('Erro ao buscar produto.');
      }
    }
  }, [comanda.id]);

  // Teclado global (Scanner HID, F9, F10)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setItemDiversosAberto(true);
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        if ((comanda.itens?.length || 0) > 0) {
          setModalFechar(true);
        }
        return;
      }

      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const codigo = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        clearTimeout(barcodeTimer.current);
        if (codigo.length >= 3) processarCodigo(codigo);
        return;
      }

      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 80);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(barcodeTimer.current);
    };
  }, [processarCodigo, comanda.itens]);

  // Handlers para o input inferior do Modo Limpo
  const handleBuscaBaixoChange = (e) => {
    const val = e.target.value;
    setBuscaBaixo(val);
    setSugestoesAbertas(val.trim().length > 0);
    setIndiceSugerido(0);
  };

  const selecionarSugestao = (prod, multiplicador = 1) => {
    if (prod.unidade === 'KG') {
      setProdutoKGPendente(prod);
    } else {
      adicionarItem(prod, multiplicador);
    }
    setBuscaBaixo('');
    setSugestoesAbertas(false);
  };

  const handleBuscaBaixoKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (produtosSugeridos.length > 0) {
        setIndiceSugerido(prev => (prev + 1) % produtosSugeridos.length);
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (produtosSugeridos.length > 0) {
        setIndiceSugerido(prev => (prev - 1 + produtosSugeridos.length) % produtosSugeridos.length);
      }
      return;
    }
    if (e.key === 'Escape') {
      setSugestoesAbertas(false);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = buscaBaixo.trim();
      if (!val) return;

      if (val === '999') {
        setItemDiversosAberto(true);
        setBuscaBaixo('');
        setSugestoesAbertas(false);
        return;
      }

      let multiplicador = 1;
      let termoBusca = val;
      if (val.includes('*')) {
        const partes = val.split('*');
        const possivelMult = parseFloat(partes[0].replace(',', '.'));
        if (!isNaN(possivelMult) && possivelMult > 0 && partes[1]?.trim()) {
          multiplicador = possivelMult;
          termoBusca = partes[1].trim();
        }
      }

      if (sugestoesAbertas && produtosSugeridos.length > 0 && indiceSugerido < produtosSugeridos.length) {
        selecionarSugestao(produtosSugeridos[indiceSugerido], multiplicador);
        return;
      }

      processarCodigo(termoBusca, multiplicador);
      setBuscaBaixo('');
      setSugestoesAbertas(false);
    }
  };

  // Totais e estatísticas da comanda
  const pesoTotalKg = (comanda.itens || [])
    .filter(i => (i.produto?.unidade || 'KG') === 'KG')
    .reduce((sum, i) => sum + (parseFloat(i.pesoKg) || 0), 0);

  const totalUnidades = (comanda.itens || [])
    .filter(i => (i.produto?.unidade || 'KG') === 'UN')
    .reduce((sum, i) => sum + (parseInt(i.pesoKg) || 1), 0);

  const itemExibicao = (comanda.itens?.length || 0) === 0
    ? null
    : (ultimoItemAdicionado || comanda.itens[comanda.itens.length - 1]);

  return (
    <div className="flex flex-col h-screen bg-page font-sans overflow-hidden select-none">
      {/* Modal Fechar Comanda */}
      {modalFechar && (
        <ModalFinalizarComanda
          comanda={comanda}
          produtos={produtos}
          cliente={cliente}
          onFechada={() => {
            setModalFechar(false);
            onFechada();
          }}
          onCancelar={() => setModalFechar(false)}
        />
      )}

      {/* Modal Item Diversos (999) */}
      {itemDiversosAberto && (
        <ModalItemDiversos
          onConfirmar={adicionarDiversos}
          onCancelar={() => setItemDiversosAberto(false)}
        />
      )}

      {/* Modal Peso KG */}
      {produtoKGPendente && (
        <ModalPesoKG
          produto={produtoKGPendente}
          onConfirmar={async (peso) => {
            await adicionarItem(produtoKGPendente, peso);
            setProdutoKGPendente(null);
          }}
          onCancelar={() => setProdutoKGPendente(null)}
        />
      )}

      {/* Modal Código Não Encontrado */}
      {codigoNaoEncontrado && (
        <ModalCodigoNaoEncontrado
          codigo={codigoNaoEncontrado.codigo}
          balanca={codigoNaoEncontrado.balanca}
          codigoProduto={codigoNaoEncontrado.codigoProduto}
          valorTotal={codigoNaoEncontrado.valorTotal}
          produtos={produtos}
          onVincular={async (produtoId) => {
            try {
              await api.put(`/produtos/${produtoId}`, { codigoBarras: codigoNaoEncontrado.codigo });
              setCodigoNaoEncontrado(null);
              const p = produtos.find(item => item.id === produtoId);
              if (p?.unidade === 'KG') setProdutoKGPendente(p);
              else if (p) adicionarItem(p, 1);
            } catch {
              alert('Erro ao vincular código ao produto.');
            }
          }}
          onCadastrar={() => window.open(`/produtos?novoCodigo=${codigoNaoEncontrado.codigo}`, '_blank')}
          onFechar={() => setCodigoNaoEncontrado(null)}
        />
      )}

      {/* CABEÇALHO — TOPO COM STATUS SCANNER + INFOS DA COMANDA + ALTERNADOR DE MODO */}
      <header className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onVoltar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition-colors"
            title="Voltar para a grade de comandas"
          >
            <span className="text-base font-bold leading-none">←</span>
            <span>Voltar para Mesas</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-stone-900 tracking-tight">
                📋 Comanda: <span className="text-amber-800">{comanda.nomeCliente}</span>
              </h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black tracking-wide ${modoLayout === 'limpo' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                {modoLayout === 'limpo' ? '⚡ Modo Limpo' : '📑 Modo Clássico'}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">
              Aberta em {formatarDataHora(comanda.criadaEm)}
            </p>
          </div>
        </div>

        {/* Flash feedback do scan */}
        {flashCodigo && (
          <div className="flex items-center gap-2 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-xl px-5 py-2 animate-pulse">
            <span className="text-emerald-700 text-lg font-black">✓</span>
            <span className="text-emerald-800 text-sm font-black font-mono">{flashCodigo}</span>
          </div>
        )}

        {/* Seletor de Modo (Limpo / Clássico) + Tela Cheia + Total Geral */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-stone-100 p-1.5 rounded-2xl border border-stone-200 shadow-inner">
            <button
              type="button"
              onClick={() => alternarModoLayout('limpo')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                modoLayout === 'limpo'
                  ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Modo Limpo: Tela ampla sem catálogo estático, com barra de busca e leitor na parte de baixo"
            >
              <span>⚡</span>
              <span>Modo Limpo</span>
            </button>
            <button
              type="button"
              onClick={() => alternarModoLayout('classico')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                modoLayout === 'classico'
                  ? 'bg-white text-stone-900 shadow-sm border border-stone-200/80'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
              title="Modo Clássico: Tela com catálogo completo de produtos na coluna esquerda"
            >
              <span>📑</span>
              <span>Modo Clássico</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition-colors"
            title="Alternar Tela Cheia"
          >
            <span>⛶</span>
            <span>Tela Cheia</span>
          </button>

          <div className="text-right min-w-28 pl-4 border-l border-stone-200">
            <p className="text-xs text-stone-500 font-bold">{comanda.itens?.length || 0} item(ns)</p>
            <p className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight leading-none mt-0.5">{fmt(comanda.total)}</p>
          </div>
        </div>
      </header>

      {modoLayout === 'classico' ? (
        /* CORPO — MODO CLÁSSICO */
        <div className="flex flex-1 overflow-hidden">
          {/* LISTA MANUAL DE PRODUTOS / CATÁLOGO */}
          <section className="w-2/5 flex flex-col border-r border-stone-200" style={{minWidth:0}}>
            <div className="px-5 py-3 border-b border-stone-200 flex-shrink-0 bg-stone-50/80 flex items-center justify-between">
              <p className="text-xs sm:text-sm text-stone-600 font-bold uppercase tracking-wider">Catálogo de Produtos</p>
              <button
                onClick={() => setItemDiversosAberto(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-xs px-3.5 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                title="Adicionar item avulso com valor em aberto (Atalho: F9 ou digite 999)">
                <span>🏷️</span>
                <span>+ Diversos (999) [F9]</span>
              </button>
            </div>

            <div className="px-5 py-3.5 border-b border-stone-200 flex-shrink-0 bg-white">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-base">🔍</span>
                <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && busca.trim() === '999') {
                      setBusca('');
                      setItemDiversosAberto(true);
                    }
                  }}
                  placeholder="Buscar produto por nome ou código..."
                  className="w-full bg-stone-100 hover:bg-white focus:bg-white border-2 border-stone-200 focus:border-brand-500 rounded-xl pl-10 pr-9 py-3 text-stone-900 text-sm sm:text-base font-bold focus:outline-none transition-colors"
                />
                {busca && <button onClick={() => setBusca('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xl font-bold">×</button>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {produtosFiltrados.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-2 p-8">
                  <span className="text-5xl">🔍</span>
                  <p className="text-sm font-bold text-stone-500">Nenhum produto encontrado</p>
                </div>
              ) : Object.entries(porCategoria).map(([cat, prods]) => (
                <div key={cat}>
                  <div className="px-5 py-2.5 bg-stone-100/90 border-y border-stone-200 sticky top-0 z-10">
                    <p className="text-xs font-black uppercase tracking-wider text-stone-600">{cat}</p>
                  </div>
                  {prods.map(p => {
                    const isUN = p.unidade === 'UN';
                    const qtd = qtds[p.id] || 1;
                    const ocupado = adicionando === p.id;
                    const temPromo = p.precoPromocao && p.precoPromocao > 0;
                    const precoAtivo = temPromo ? p.precoPromocao : p.precoVenda;
                    return (
                      <div key={p.id} className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 hover:bg-stone-50 transition-colors">
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-black text-stone-900 truncate">{p.nome}</p>
                            {p.codigoBarras && <span className="text-xs text-stone-500 font-mono font-bold flex-shrink-0 bg-stone-100 px-1.5 py-0.5 rounded">{p.codigoBarras}</span>}
                            {temPromo && (
                              <span className="text-xs bg-amber-500/15 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">🔥 Promo</span>
                            )}
                          </div>
                          {temPromo ? (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-sm text-amber-700 font-black font-mono">
                                {fmt(p.precoPromocao)}/{isUN ? 'un' : 'kg'}
                              </p>
                              <p className="text-xs text-stone-400 line-through font-mono">
                                {fmt(p.precoVenda)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-emerald-700 font-bold font-mono mt-1">{fmt(p.precoVenda)}/{isUN ? 'un' : 'kg'}</p>
                          )}
                        </div>
                        {isUN ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center bg-stone-100 border-2 border-stone-200 rounded-xl overflow-hidden">
                              <button onClick={() => setQtds(q => ({ ...q, [p.id]: Math.max(1, (q[p.id]||1) - 1) }))} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors font-black text-base">−</button>
                              <span className="px-2 text-stone-900 font-black font-mono text-sm sm:text-base min-w-[1.75rem] text-center">{qtd}</span>
                              <button onClick={() => setQtds(q => ({ ...q, [p.id]: (q[p.id]||1) + 1 }))} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors font-black text-base">+</button>
                            </div>
                            <button onClick={() => adicionarItem(p, qtd)} disabled={ocupado} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm">
                              {ocupado ? '...' : `+ ${fmt(precoAtivo * qtd)}`}
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setProdutoKGPendente(p)} className="flex-shrink-0 bg-stone-100 hover:bg-stone-200 border-2 border-stone-300 text-stone-800 font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95">
                            ⚖️ Digitar Peso
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>

          {/* CUPOM DA COMANDA (MANTENDO AS DATAS DE CADA ITEM ADICIONADO) */}
          <section className="w-3/5 flex flex-col bg-white">
            <div className="px-6 py-4 border-b border-stone-200 flex-shrink-0 flex items-center justify-between bg-stone-50/50">
              <div>
                <p className="text-base text-stone-900 font-black flex items-center gap-2">
                  <span>🛒</span> Comanda — {comanda.nomeCliente}
                </p>
                <p className="text-stone-500 text-xs font-semibold mt-0.5">{comanda.itens?.length || 0} item(ns) adicionados</p>
              </div>
              <span className="text-3xl font-black text-stone-900 font-mono">{fmt(comanda.total)}</span>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {(!comanda.itens || comanda.itens.length === 0) && (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3 py-16">
                  <span className="text-6xl">📷</span>
                  <p className="text-sm font-bold text-center text-stone-500 leading-relaxed">Aponte o leitor de código de barras<br/>ou selecione ao lado para adicionar à comanda</p>
                </div>
              )}

              {comanda.itens?.map((item, idx) => {
                const prod = item.produto || produtos.find(p => p.id === item.produtoId);
                const isKG = (prod?.unidade || 'KG') === 'KG';
                const emPromo = prod && prod.precoPromocao && prod.precoPromocao > 0 && item.precoKg < prod.precoVenda;

                return (
                  <div key={item.id} className="bg-white border-2 border-stone-200 hover:border-brand-500 rounded-2xl p-4 flex items-center justify-between group transition-all shadow-2xs">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <span className="text-stone-400 text-sm font-black w-6 text-center flex-shrink-0">{idx+1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base sm:text-lg font-black text-stone-900 truncate leading-snug">{item.nome}</p>
                          {emPromo && (
                            <span className="text-xs bg-amber-500/15 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">🔥 Promo</span>
                          )}
                          {/* DESTAQUE DA DATA/HORA DE ADIÇÃO DO ITEM À COMANDA */}
                          <span
                            className="text-xs font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-lg flex items-center gap-1.5 shadow-2xs flex-shrink-0"
                            title={`Adicionado à comanda em ${formatarDataHora(item.criadoEm)}`}
                          >
                            <span>📅</span>
                            <span>{formatarDataHora(item.criadoEm)}</span>
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-stone-500 mt-1">
                          <span className="font-bold text-stone-700">{isKG ? `${parseFloat(item.pesoKg).toFixed(3)} kg` : `${parseFloat(item.pesoKg)} un`}</span>
                          <span className="mx-2 text-stone-300 font-normal">×</span>
                          <span className="font-mono">{fmt(item.precoKg)}/{isKG ? 'kg' : 'un'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      <span className="text-emerald-700 font-black text-xl font-mono">{fmt(item.total)}</span>
                      <button
                        onClick={() => removerItem(item.id)}
                        disabled={removendo === item.id}
                        className="text-stone-300 hover:text-red-600 transition-colors text-2xl leading-none opacity-40 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 font-bold"
                        title="Remover item da comanda"
                      >
                        {removendo === item.id ? '…' : '×'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {erro && (
              <div className="mx-6 mb-3 text-xs sm:text-sm font-bold rounded-xl px-4 py-3 border text-amber-800 bg-amber-50 border-amber-300">{erro}</div>
            )}

            <div className="border-t border-stone-200 p-6 space-y-4 flex-shrink-0 bg-stone-50/60">
              <div className="flex justify-between items-baseline">
                <span className="text-stone-500 uppercase text-xs sm:text-sm tracking-widest font-black">TOTAL A PAGAR</span>
                <span className="text-4xl sm:text-5xl font-black text-stone-900 font-mono tracking-tight">{fmt(comanda.total)}</span>
              </div>
              <button
                onClick={() => setModalFechar(true)}
                disabled={!comanda.itens?.length}
                className={`w-full py-5 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider transition-all duration-200 active:scale-98 shadow-md
                  ${!comanda.itens?.length
                    ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'}`}
              >
                💰 FECHAR E COBRAR (F10)
              </button>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    const msg = comanda.itens?.length
                      ? `Cancelar esta comanda de ${comanda.nomeCliente}?\n\n${comanda.itens.length} item(s) — ${fmt(comanda.total)}\n\nA comanda será cancelada sem cobrar.`
                      : `Cancelar esta comanda vazia de ${comanda.nomeCliente}?`;
                    if (!confirm(msg)) return;
                    try {
                      await api.post(`/comandas/${comanda.id}/cancelar`);
                      onFechada();
                    } catch (e) {
                      alert(e.response?.data?.erro || 'Erro ao cancelar comanda.');
                    }
                  }}
                  className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-black text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  × Cancelar Comanda
                </button>
                <button
                  onClick={recarregar}
                  className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-black text-stone-600 hover:text-stone-900 hover:bg-stone-200 bg-stone-100 transition-colors"
                >
                  ↻ Atualizar
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* CORPO — MODO LIMPO */
        <div className="flex flex-1 flex-col overflow-hidden bg-stone-100/60">
          <div className="flex flex-1 overflow-hidden">
            {/* PAINEL PRINCIPAL: ITENS DA COMANDA AMPLO (COM DATAS DE CADA ITEM) */}
            <section className="flex-1 flex flex-col bg-white border-r border-stone-200 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                {(!comanda.itens || comanda.itens.length === 0) ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
                    <div className="w-24 h-24 rounded-3xl bg-white border-2 border-stone-200 flex items-center justify-center mb-5 text-4xl shadow-md">
                      🛒
                    </div>
                    <h3 className="text-xl font-black text-stone-900 mb-1.5">Comanda Aberta · Pronto para Adicionar</h3>
                    <p className="text-sm text-stone-500 max-w-md mb-8 leading-relaxed font-medium">
                      Aponte o leitor de código de barras ou utilize a <strong>barra de busca na parte inferior</strong> da tela para registrar produtos rapidamente nesta comanda.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center max-w-lg">
                      <div className="px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-700 flex items-center gap-2 font-bold">
                        <span className="bg-stone-200 text-stone-900 px-2 py-0.5 rounded-md font-mono font-black text-xs">F9</span>
                        <span>Item Avulso (999)</span>
                      </div>
                      <div className="px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-700 flex items-center gap-2 font-bold">
                        <span className="bg-stone-200 text-stone-900 px-2 py-0.5 rounded-md font-mono font-black text-xs">F10</span>
                        <span>Fechar Comanda</span>
                      </div>
                      <div className="px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-700 flex items-center gap-2 font-bold">
                        <span className="bg-stone-200 text-stone-900 px-2 py-0.5 rounded-md font-mono font-black text-xs">Qtd*Produto</span>
                        <span>Ex: 2*coca</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 space-y-2.5">
                    {/* Cabeçalho da Tabela */}
                    <div className="grid grid-cols-12 text-sm sm:text-base font-black text-stone-600 uppercase tracking-wider pb-3.5 px-4 border-b-2 border-stone-200">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-5">Produto / Descrição / Data Adicionado</div>
                      <div className="col-span-2 text-right">Preço Unit.</div>
                      <div className="col-span-2 text-center">Qtd / Peso</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>

                    {/* Linhas dos Itens */}
                    {comanda.itens.map((item, idx) => {
                      const prod = item.produto || produtos.find(p => p.id === item.produtoId);
                      const isKG = (prod?.unidade || 'KG') === 'KG';
                      const emPromo = prod && prod.precoPromocao && prod.precoPromocao > 0 && item.precoKg < prod.precoVenda;

                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-12 items-center bg-white border-2 border-stone-200 hover:border-brand-500 rounded-2xl p-4 sm:p-4.5 shadow-2xs transition-all group"
                        >
                          <div className="col-span-1 text-center font-black text-base sm:text-lg text-stone-500 font-mono">
                            {idx + 1}
                          </div>

                          <div className="col-span-5 pr-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-stone-900 text-lg sm:text-xl truncate leading-snug">{item.nome}</p>
                              {emPromo && (
                                <span className="text-xs bg-amber-500/15 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">🔥 Promo</span>
                              )}
                              <span
                                className="text-xs font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shadow-2xs flex-shrink-0"
                                title={`Adicionado à comanda em ${formatarDataHora(item.criadoEm)}`}
                              >
                                <span>📅</span>
                                <span>{formatarDataHora(item.criadoEm)}</span>
                              </span>
                            </div>
                            <span className="text-sm text-stone-500 font-bold block mt-0.5">
                              {isKG ? 'Quilo (KG)' : 'Unidade'}
                            </span>
                          </div>

                          <div className="col-span-2 text-right text-base sm:text-lg font-black text-stone-800 font-mono">
                            {fmt(item.precoKg)}
                          </div>

                          <div className="col-span-2 flex items-center justify-center font-black text-base sm:text-lg font-mono text-stone-900">
                            {isKG ? `${parseFloat(item.pesoKg).toFixed(3)} kg` : `${parseFloat(item.pesoKg)} un`}
                          </div>

                          <div className="col-span-2 flex items-center justify-end gap-3">
                            <span className="font-black text-xl sm:text-2xl font-mono text-emerald-700">
                              {fmt(item.total)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removerItem(item.id)}
                              disabled={removendo === item.id}
                              className="w-9 h-9 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center text-xl font-black transition-all opacity-40 group-hover:opacity-100"
                              title="Remover item da comanda"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* PAINEL LATERAL DIREITO: DISPLAY CLIENTE E TOTAL */}
            <aside className="w-84 md:w-96 lg:w-[410px] flex flex-col bg-stone-100/90 text-stone-900 p-3.5 sm:p-4 flex-shrink-0 border-l-2 border-stone-200 justify-between overflow-y-auto gap-2.5 shadow-sm">
              <div className="space-y-2.5 flex-shrink-0">
                {/* BARRA DE STATUS DO CAIXA / COMANDA */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-stone-200 shadow-2xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-800">
                      Comanda em Aberto
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 uppercase shadow-2xs">
                    {comanda.nomeCliente}
                  </span>
                </div>

                {/* DISPLAY DO ÚLTIMO ITEM ADICIONADO */}
                {itemExibicao ? (
                  <div className="bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-emerald-500 shadow-sm relative overflow-hidden animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                        Item #{comanda.itens?.length || 1}
                      </span>
                      {itemExibicao.emPromocao && (
                        <span className="text-xs bg-amber-100 text-amber-900 font-black px-2.5 py-1 rounded-full border border-amber-300">
                          🔥 Promoção
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-tight my-1.5 truncate" title={itemExibicao.nome}>
                      {itemExibicao.nome}
                    </h3>

                    <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200 grid grid-cols-3 gap-1.5 text-center items-center">
                      <div className="text-left pl-1">
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-stone-500 block tracking-wider">
                          {(itemExibicao.unidade || 'UN') === 'UN' ? 'Qtd' : 'Peso'}
                        </span>
                        <span className="text-sm sm:text-base font-black font-mono text-stone-900 truncate block">
                          {itemExibicao.peso || itemExibicao.pesoKg} {(itemExibicao.unidade || 'UN').toLowerCase()}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-stone-500 block tracking-wider">
                          Unitário
                        </span>
                        <span className="text-xs sm:text-sm font-black font-mono text-stone-700 block truncate">
                          {fmt(itemExibicao.precoKg || 0)}
                        </span>
                      </div>

                      <div className="text-right pr-1">
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-emerald-700 block tracking-wider">
                          Subtotal
                        </span>
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-700 block truncate">
                          {fmt(itemExibicao.total || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-3 border-2 border-stone-200 shadow-2xs flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-xl flex-shrink-0">
                      🛒
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-stone-900 leading-tight">Pronto para Adicionar</h4>
                      <p className="text-xs text-stone-400 truncate">Aguardando código no leitor ou busca...</p>
                    </div>
                  </div>
                )}

                {/* VISOR DIGITAL: TOTAL A PAGAR */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-stone-300 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      TOTAL DA COMANDA
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-black text-stone-800 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
                      {comanda.itens?.length || 0} {(comanda.itens?.length || 0) === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  <div className="my-1 flex items-baseline justify-end gap-2 font-mono">
                    <span className="text-3xl sm:text-4xl text-stone-400 font-black select-none">R$</span>
                    <span className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-emerald-600 leading-none">
                      {Number(comanda.total || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs sm:text-sm font-bold text-stone-600">
                    <div>
                      {pesoTotalKg > 0 && (
                        <span>Peso: <strong className="font-mono text-stone-900 font-black">{pesoTotalKg.toFixed(3)} kg</strong></span>
                      )}
                      {pesoTotalKg > 0 && totalUnidades > 0 && <span className="mx-1.5">•</span>}
                      {totalUnidades > 0 && (
                        <span>Qtd: <strong className="font-mono text-stone-900 font-black">{totalUnidades} un</strong></span>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 font-mono">
                      Aberta em {formatarData(comanda.criadaEm)}
                    </span>
                  </div>
                </div>

                {erro && (
                  <div className="bg-red-50 border-2 border-red-300 text-red-700 text-sm font-bold rounded-xl p-3 shadow-2xs">
                    ⚠️ {erro}
                  </div>
                )}
              </div>

              {/* BOTÕES DO PAINEL LATERAL */}
              <div className="space-y-2.5 pt-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setModalFechar(true)}
                  disabled={!comanda.itens?.length}
                  className={`w-full py-4 px-5 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider transition-all duration-150 active:scale-98 flex items-center justify-between shadow-md ${
                    !comanda.itens?.length
                      ? 'bg-stone-200/90 text-stone-500 border-2 border-stone-300 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>💰</span>
                    <span>FECHAR E COBRAR</span>
                  </span>
                  <span className="text-xs font-mono bg-white/20 px-2 py-1 rounded-lg">F10</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setItemDiversosAberto(true)}
                    className="flex-1 py-3 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 font-extrabold text-xs border border-stone-200 shadow-2xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>🏷️</span>
                    <span>Diversos [F9]</span>
                  </button>
                  <button
                    type="button"
                    onClick={recarregar}
                    className="px-4 py-3 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-extrabold text-xs border border-stone-200 shadow-2xs transition-colors"
                    title="Recarregar itens da comanda"
                  >
                    ↻
                  </button>
                </div>
              </div>
            </aside>
          </div>

          {/* BARRA DE PESQUISA E SCANNER INFERIOR DO MODO LIMPO */}
          <div className="relative bg-white border-t border-stone-200 px-4 py-2.5 shadow-lg z-20 flex-shrink-0">
            {sugestoesAbertas && buscaBaixo.trim().length > 0 && (
              <div
                ref={sugestoesRef}
                className="absolute bottom-full left-4 right-4 mb-3 bg-white rounded-3xl border-2 border-stone-300 shadow-2xl overflow-hidden max-h-96 flex flex-col z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
              >
                <div className="bg-stone-100 px-5 py-3 border-b border-stone-200 flex items-center justify-between text-xs sm:text-sm font-black text-stone-700">
                  <span>Produtos Encontrados ({produtosSugeridos.length})</span>
                  <span className="text-xs font-semibold text-stone-400">Navegue com ↑ / ↓ e confirme com Enter</span>
                </div>

                <div className="overflow-y-auto flex-1 p-2">
                  {produtosSugeridos.length === 0 ? (
                    <div className="p-6 text-center text-stone-400 text-sm">
                      Nenhum produto cadastrado com esse nome ou código.
                      <p className="text-xs text-stone-400 mt-1">Pressione Enter para buscar pelo código de barras ou F9 para item diverso.</p>
                    </div>
                  ) : (
                    produtosSugeridos.map((prod, index) => {
                      const selecionado = index === indiceSugerido;
                      return (
                        <div
                          key={prod.id}
                          onClick={() => selecionarSugestao(prod)}
                          onMouseEnter={() => setIndiceSugerido(index)}
                          className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-colors ${
                            selecionado ? 'bg-amber-500/15 border-2 border-amber-500/50 text-stone-900' : 'hover:bg-stone-50 border-2 border-transparent'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <p className="text-base sm:text-lg font-black text-stone-900 truncate">{prod.nome}</p>
                            <p className="text-xs sm:text-sm text-stone-500 font-medium">
                              {prod.categoria || 'Geral'} {prod.codigoBarras ? `· Cód: ${prod.codigoBarras}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {prod.precoPromocao && prod.precoPromocao > 0 ? (
                              <div>
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-[10px] bg-amber-500/15 text-amber-800 font-black px-1.5 py-0.5 rounded border border-amber-500/30">🔥 Promo</span>
                                  <p className="text-base sm:text-lg font-black text-amber-700 font-mono">
                                    {fmt(prod.precoPromocao)}
                                  </p>
                                </div>
                                <span className="text-xs text-stone-400 line-through font-mono">
                                  {fmt(prod.precoVenda)}/{prod.unidade === 'UN' ? 'un' : 'kg'}
                                </span>
                              </div>
                            ) : (
                              <p className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                                {fmt(prod.precoVenda)}
                                <span className="text-xs text-stone-500 font-semibold font-sans">/{prod.unidade === 'UN' ? 'un' : 'kg'}</span>
                              </p>
                            )}
                            <span className="text-xs text-stone-400 font-medium font-sans block mt-0.5">
                              {prod.unidade === 'UN' ? 'Enter para adicionar' : 'Enter para digitar peso'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="bg-stone-50 px-5 py-2.5 border-t border-stone-200 text-xs text-stone-500 flex justify-between font-medium">
                  <span>Pressione <strong>ESC</strong> para fechar a busca</span>
                  <span><strong>999</strong> = Item avulso</span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-stone-400">
                  <span className="text-xl">📷</span>
                  <span className="text-xs sm:text-sm font-black uppercase tracking-wider bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">Scanner</span>
                </div>
                <input
                  ref={inputBaixoRef}
                  type="text"
                  value={buscaBaixo}
                  onChange={handleBuscaBaixoChange}
                  onKeyDown={handleBuscaBaixoKeyDown}
                  placeholder="Aponte o leitor de código de barras ou digite o nome do produto... (Pressione Enter)"
                  className="w-full bg-stone-50 hover:bg-white focus:bg-white border-2 border-stone-300 focus:border-brand-500 rounded-xl pl-32 pr-12 py-3 text-stone-900 text-base sm:text-lg font-bold focus:outline-none shadow-inner transition-all font-sans"
                />
                {buscaBaixo && (
                  <button
                    type="button"
                    onClick={() => { setBuscaBaixo(''); setSugestoesAbertas(false); }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-2xl w-7 h-7 flex items-center justify-center rounded-full hover:bg-stone-200 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2.5 bg-stone-100 rounded-xl border border-stone-200 text-xs sm:text-sm font-bold text-stone-700 flex-shrink-0 select-none">
                <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-mono font-black border border-amber-300">F9</span>
                <span>Diversos</span>
                <span className="text-stone-300 mx-0.5">•</span>
                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md font-mono font-black border border-emerald-300">F10</span>
                <span>Finalizar</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VISÃO PRINCIPAL — GRADE DE COMANDAS / MESAS ──────────────────────────────
export default function GestaoComandas() {
  const navigate = useNavigate();
  const [comandas, setComandas]   = useState([]);
  const [produtos, setProdutos]   = useState([]);
  const [vendidosCount, setVendidosCount] = useState({});
  const [loading, setLoading]     = useState(true);
  const [modalNova, setModalNova] = useState(false);
  const [mesaAberta, setMesaAberta] = useState(null);
  const [cancelandoId, setCancelandoId] = useState(null);
  const [ordemData, setOrdemData] = useState('asc');

  const cliente = (() => {
    try { return JSON.parse(localStorage.getItem('cliente')); }
    catch { return null; }
  })();

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resC, resP] = await Promise.all([api.get('/comandas'), api.get('/produtos')]);
      setComandas(resC.data);
      setProdutos(resP.data);

      const contagem = {};
      for (const c of resC.data) {
        for (const item of (c.itens || [])) {
          if (item.produtoId) contagem[item.produtoId] = (contagem[item.produtoId] || 0) + parseFloat(item.pesoKg);
        }
      }
      setVendidosCount(contagem);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (mesaAberta) return;
    const interval = setInterval(() => carregar(), 15000);
    return () => clearInterval(interval);
  }, [mesaAberta, carregar]);

  const abrirMesa = async (comanda) => {
    try {
      const { data } = await api.get(`/comandas/${comanda.id}`);
      setMesaAberta(data);
    } catch {}
  };

  const onCriarComanda = (nova) => {
    setModalNova(false);
    setMesaAberta(nova);
    carregar();
  };

  const cancelarComanda = async (comanda) => {
    const qntItens = comanda.itens?.length || 0;
    const msg = qntItens > 0
      ? `Cancelar a comanda de ${comanda.nomeCliente}?\n\n${qntItens} item(s) — ${fmt(comanda.total)}\n\nA comanda será cancelada sem cobrar.`
      : `Cancelar a comanda vazia de ${comanda.nomeCliente}?`;
    if (!confirm(msg)) return;
    setCancelandoId(comanda.id);
    try {
      await api.post(`/comandas/${comanda.id}/cancelar`);
      await carregar();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar comanda.');
    } finally {
      setCancelandoId(null);
    }
  };

  const comandasOrdenadas = [...comandas].sort((a, b) => {
    const ta = new Date(a.criadaEm).getTime();
    const tb = new Date(b.criadaEm).getTime();
    return ordemData === 'desc' ? tb - ta : ta - tb;
  });

  if (mesaAberta) {
    return (
      <VisaoMesaComanda
        comanda={mesaAberta}
        produtos={produtos}
        vendidosCount={vendidosCount}
        cliente={cliente}
        onVoltar={() => { setMesaAberta(null); carregar(); }}
        onFechada={() => { setMesaAberta(null); carregar(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-page text-stone-900 font-sans">
      {modalNova && <ModalNovaComanda onCriar={onCriarComanda} onFechar={() => setModalNova(false)} />}

      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-black text-stone-900 tracking-tight">Comandas</h1>
          <p className="text-xs text-stone-500 mt-0.5">{comandas.length} comanda(s) aberta(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOrdemData(prev => prev === 'asc' ? 'desc' : 'asc')}
            title="Alternar ordem de exibição por data"
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 hover:border-stone-400 px-3 py-2.5 rounded-xl transition-all bg-stone-50 hover:bg-stone-100"
          >
            <span>{ordemData === 'asc' ? '⏳ Mais antigas 1º' : '⚡ Mais recentes 1º'}</span>
          </button>
          <button onClick={carregar} className="text-xs text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 px-4 py-2.5 rounded-xl transition-all" title="Atualizar">↻</button>
          <button onClick={() => navigate('/assados')}
            className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-black text-xs px-5 py-2.5 rounded-xl transition-all shadow-sm">
            🔥 Assados
          </button>
          <button onClick={() => setModalNova(true)} className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-black text-xs px-6 py-2.5 rounded-xl transition-all shadow-md">
            + Nova Comanda
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-32 text-stone-600"><span className="animate-pulse text-sm font-bold">Carregando comandas...</span></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {comandasOrdenadas.map((c) => {
              const temItens = (c.itens?.length ?? 0) > 0;
              const ocupado = cancelandoId === c.id;
              return (
                <div key={c.id} className="relative group">
                  <button onClick={() => abrirMesa(c)}
                    className={`w-full aspect-square flex flex-col justify-between p-4 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-105 active:scale-95
                      ${temItens ? 'border-brand-600/50 bg-brand-600/5 hover:border-brand-500 hover:bg-brand-600/10 hover:shadow-[0_0_24px_rgba(245,158,11,0.2)]'
                                 : 'border-stone-300 bg-white hover:border-stone-400 hover:bg-stone-100'}`}>
                    <div className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${temItens ? 'bg-brand-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]' : 'bg-stone-300'}`} />
                    <div>
                      <p className="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Cliente</p>
                      <p className="text-sm font-black text-stone-900 leading-tight line-clamp-2 group-hover:text-amber-700 transition-colors">{c.nomeCliente}</p>
                    </div>
                    {temItens && (
                      <div className="text-center py-1">
                        <p className="text-lg font-black text-emerald-700 leading-none font-mono">{fmt(c.total)}</p>
                        <p className="text-xs text-stone-500 font-bold mt-1">{c.itens.length} item(s)</p>
                      </div>
                    )}
                    <div className="flex items-end justify-between pt-2 border-t border-stone-200/60">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-stone-400 font-black mb-0.5">Aberta em</p>
                        <p className="text-xs font-bold text-stone-800 leading-tight">
                          {formatarDataHora(c.criadaEm)}
                        </p>
                      </div>
                      <span className="text-stone-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all text-sm font-bold">→</span>
                    </div>
                  </button>

                  {/* Botão X de cancelar */}
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelarComanda(c); }}
                    disabled={ocupado}
                    title="Cancelar comanda"
                    className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white text-base font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 flex items-center justify-center z-10">
                    {ocupado ? '…' : '×'}
                  </button>
                </div>
              );
            })}
            <button onClick={() => setModalNova(true)}
              className="aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 hover:border-brand-600/50 hover:bg-brand-600/5 text-stone-600 hover:text-amber-600 transition-all duration-200 hover:scale-105 active:scale-95 gap-2">
              <span className="text-4xl font-thin">+</span>
              <span className="text-xs font-black">Nova Comanda</span>
            </button>
          </div>
        )}
        {!loading && comandas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-stone-500 gap-4 -mt-4">
            <span className="text-6xl">📋</span>
            <p className="text-base font-black text-stone-800">Nenhuma comanda aberta no momento</p>
            <button onClick={() => setModalNova(true)} className="mt-2 bg-brand-600 hover:bg-brand-700 text-white font-black text-xs px-6 py-3 rounded-xl transition-all active:scale-95 shadow-md">+ Abrir Primeira Comanda</button>
          </div>
        )}
      </div>
    </div>
  );
}
