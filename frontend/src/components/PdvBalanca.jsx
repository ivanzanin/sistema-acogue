import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { imprimirCupom } from '../utils/imprimirCupom';
import { gerarPayloadPix, gerarQrCodePixDataUrl } from '../utils/pix';

// Formas de pagamento suportadas no PDV
const FORMAS = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', cor: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' },
  { id: 'PIX',      label: 'PIX',      icon: '📱', cor: 'border-blue-500 bg-blue-500/10 text-blue-700' },
  { id: 'DEBITO',   label: 'Debito',   icon: '💳', cor: 'border-purple-500 bg-purple-500/10 text-purple-700' },
  { id: 'CREDITO',  label: 'Credito',  icon: '💳', cor: 'border-orange-500 bg-orange-500/10 text-orange-700' },
  { id: 'VOUCHER',  label: 'Voucher Alim.', icon: '🎫', cor: 'border-teal-500 bg-teal-500/10 text-teal-700' },
];

// Modal para peso manual (produtos KG)
function ModalPesoKG({ produto, onConfirmar, onCancelar }) {
  const [peso, setPeso] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  const confirmar = () => {
    const p = parseFloat(peso.replace(',', '.'));
    if (!p || p <= 0) return;
    onConfirmar(p);
  };

  const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
  const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
  const pesoNum = parseFloat(peso.replace(',', '.')) || 0;
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
            <span className="text-lg font-black text-amber-700 font-mono">R$ {produto.precoPromocao.toFixed(2)}/kg</span>
            <span className="text-xs text-stone-400 line-through font-mono">R$ {produto.precoVenda.toFixed(2)}/kg</span>
          </div>
        ) : (
          <p className="text-base font-bold text-emerald-700 font-mono mb-5">R$ {produto.precoVenda.toFixed(2)}/kg</p>
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
            <span className="text-2xl font-black text-emerald-800 font-mono">R$ {totalItem.toFixed(2)}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={confirmar} disabled={!peso || parseFloat(peso) <= 0}
            className="flex-1 py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all active:scale-95 shadow-md">
            Adicionar (Enter)
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

// Modal para adicionar item com valor aberto (Código 999 - Diversos)
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
      id: 999,
      nome: descricao.trim() || 'Diversos',
      precoKg: v,
      peso: String(q),
      total: +(v * q).toFixed(2),
      unidade: 'UN',
      uid: Date.now() + Math.random(),
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
            <p className="text-xs text-stone-500 font-medium">Adicionar produto com valor livre na venda</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">Descrição do Item</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Diversos, Tempero especial, Gelo..."
              className="w-full bg-stone-50 border-2 border-stone-300 focus:border-brand-500 rounded-xl px-4 py-3 text-stone-900 text-base font-bold focus:outline-none font-sans transition-colors"
              onKeyDown={e => { if (e.key === 'Enter') valorInputRef.current?.focus(); if (e.key === 'Escape') onCancelar(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">Valor Unitário (R$) *</label>
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
            <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-600 mb-1.5">Quantidade</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQtd(q => Math.max(1, (parseInt(q) || 1) - 1))}
                className="w-12 h-12 rounded-xl border-2 border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xl flex items-center justify-center transition-colors">
                −
              </button>
              <input
                type="number"
                min="1"
                value={qtd}
                onChange={e => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center py-2.5 border-2 border-stone-300 rounded-xl font-black text-lg bg-stone-50"
                onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
              />
              <button
                type="button"
                onClick={() => setQtd(q => (parseInt(q) || 1) + 1)}
                className="w-12 h-12 rounded-xl border-2 border-stone-300 bg-stone-100 hover:bg-stone-200 text-stone-800 font-black text-xl flex items-center justify-center transition-colors">
                +
              </button>
            </div>
          </div>

          {vNum > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center text-xs">
              <span className="text-amber-800 font-bold">Total do item:</span>
              <span className="font-black text-amber-900 text-lg font-mono">R$ {totalItem.toFixed(2)}</span>
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

// Exibição do PIX com QR Code dinâmico e código Copia e Cola
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
      txId: 'PDV' + Date.now().toString().slice(-6),
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
      <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
        <p className="text-amber-800 font-bold text-xs mb-1">⚠️ Chave PIX não cadastrada</p>
        <p className="text-amber-700 text-[11px] mb-2">
          Cadastre sua chave PIX na tela de Configurações para gerar o QR Code automático.
        </p>
        <button
          type="button"
          onClick={() => window.open('/configuracoes', '_blank')}
          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold">
          ⚙️ Cadastrar Chave PIX
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-stone-50 border border-stone-200 rounded-xl p-3 flex flex-col items-center">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm">📱</span>
        <span className="text-xs font-bold text-stone-800">QR Code PIX — Valor Exato</span>
      </div>

      {qrCodeUrl ? (
        <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-sm mb-2">
          <img src={qrCodeUrl} alt="QR Code Pix" className="w-40 h-40 mx-auto block" />
        </div>
      ) : (
        <div className="w-40 h-40 flex items-center justify-center text-xs text-stone-400 bg-white border border-stone-200 rounded-lg mb-2">
          Gerando QR Code...
        </div>
      )}

      <div className="w-full flex items-center justify-between text-xs px-1 mb-2">
        <span className="text-stone-500 truncate max-w-[170px]">Titular: <strong className="text-stone-800">{nomePix}</strong></span>
        <span className="text-emerald-700 font-bold font-mono text-sm">R$ {Number(total).toFixed(2)}</span>
      </div>

      <button
        type="button"
        onClick={copiarPix}
        className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all border ${copiado ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'}`}>
        {copiado ? '✓ Código Copiado para Transferência!' : '📋 Copiar Código PIX (Copia e Cola)'}
      </button>
    </div>
  );
}

// Modal mostrado quando código de barras não foi reconhecido
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
        {/* Header */}
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
              <p className="text-sm text-blue-900">Valor calculado: <span className="font-mono font-black">R$ {valorTotal?.toFixed(2)}</span></p>
              <p className="text-xs text-blue-600 mt-2 font-medium">Cadastre o produto com o código <span className="font-mono font-bold">{codigoProduto}</span> para que nas próximas leituras o leitor identifique o item e calcule o peso/valor automaticamente.</p>
            </div>
          )}
        </div>

        {/* Opção 1: Cadastrar novo produto */}
        <div className="p-6 border-b border-stone-200 bg-stone-50/50">
          <p className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2">Opção 1 — Cadastrar Novo</p>
          <button onClick={onCadastrar}
            className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all active:scale-95 shadow-md hover:brightness-105"
            style={{background:'#D4890E'}}>
            + Cadastrar Novo Produto
          </button>
          <p className="text-xs text-stone-500 mt-2 font-medium">Abre a tela de Produtos com o código já preenchido.</p>
        </div>

        {/* Opção 2: Vincular a produto existente */}
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
                  <p className="font-black text-sm text-stone-900 truncate">
                    {p.nome}
                  </p>
                  <p className="text-xs font-medium text-stone-500">{p.categoria} · {p.unidade}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-black text-sm text-emerald-700 font-mono">R$ {p.precoVenda.toFixed(2)}</p>
                  {p.codigoBarras && (
                    <p className="text-xs text-amber-600 font-mono font-bold">já tem código</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50">
          <button onClick={onFechar}
            className="w-full py-3 rounded-xl text-sm font-bold text-stone-700 hover:bg-stone-200 transition-colors">
            Cancelar (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PdvBalanca() {
  const [itensCarrinho, setItensCarrinho]     = useState(() => {
    try { const s = sessionStorage.getItem('pdv_carrinho'); return s ? JSON.parse(s) : []; }
    catch { return []; }
  });
  const [produtos, setProdutos]               = useState([]);
  const [salvando, setSalvando]               = useState(false);
  const [vendaFinalizada, setVendaFinalizada] = useState(false);
  const [confirmar, setConfirmar]             = useState(false);
  const [erroVenda, setErroVenda]             = useState(null);
  const [caixaAberto, setCaixaAberto]         = useState(null);
  const [formaPagamento, setFormaPagamento]   = useState(() => sessionStorage.getItem('pdv_forma') || 'DINHEIRO');
  const [valorPago, setValorPago]             = useState(() => sessionStorage.getItem('pdv_valorpago') || '');
  const [ultimaVendaId, setUltimaVendaId]     = useState(null);
  const [cancelando, setCancelando]           = useState(false);
  const [busca, setBusca]                     = useState('');
  const [qtds, setQtds]                       = useState({});
  const [produtoKGPendente, setProdutoKGPendente] = useState(null);
  const [itemDiversosAberto, setItemDiversosAberto] = useState(false);
  const [flashCodigo, setFlashCodigo]         = useState(null);
  const [codigoNaoEncontrado, setCodigoNaoEncontrado] = useState(null); // {codigo}
  const [vincularProduto, setVincularProduto] = useState(null); // produto selecionado pra vincular
  const [modoDividido, setModoDividido]       = useState(false);
  const [numPessoas, setNumPessoas]           = useState(2);
  const [divisoes, setDivisoes]               = useState([]);
  const [pixModalInfo, setPixModalInfo]       = useState(null);
  const [modoLayout, setModoLayout]           = useState(() => localStorage.getItem('pdv_layout_modo') || 'limpo');
  const [buscaBaixo, setBuscaBaixo]           = useState('');
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [ultimoItemAdicionado, setUltimoItemAdicionado] = useState(null);
  const [emitirNfce, setEmitirNfce]           = useState(false);
  const [cpfDestinatario, setCpfDestinatario] = useState('');
  const buscaRef = useRef(null);
  const inputBaixoRef = useRef(null);
  const sugestoesRef = useRef(null);

  // Alterna e salva a preferência de layout
  const alternarModoLayout = (modo) => {
    setModoLayout(modo);
    localStorage.setItem('pdv_layout_modo', modo);
    setSugestoesAbertas(false);
    setBuscaBaixo('');
  };

  const registrarUltimoItem = (item) => {
    if (!item) return;
    setUltimoItemAdicionado({
      nome: item.nome,
      unidade: item.unidade || 'UN',
      peso: item.peso,
      precoKg: parseFloat(item.precoKg || 0),
      total: parseFloat(item.total || 0),
    });
  };

  const alterarQuantidade = (uid, delta) => {
    setItensCarrinho(prev => {
      const atualizados = prev.map(item => {
        if (item.uid !== uid) return item;
        if (item.unidade === 'UN') {
          const novaQtd = Math.max(1, (parseInt(item.peso) || 1) + delta);
          const novo = {
            ...item,
            peso: String(novaQtd),
            total: +(novaQtd * item.precoKg).toFixed(2),
          };
          registrarUltimoItem(novo);
          return novo;
        } else {
          const novoPeso = Math.max(0.05, +(parseFloat(item.peso) + (delta * 0.1)).toFixed(3));
          const novo = {
            ...item,
            peso: novoPeso.toFixed(3),
            total: +(novoPeso * item.precoKg).toFixed(2),
          };
          registrarUltimoItem(novo);
          return novo;
        }
      });
      return atualizados;
    });
  };

  const adicionarProdutoPorObjeto = (produto, multiplicador = 1) => {
    if (!produto) return;
    if (produto.unidade === 'KG') {
      setProdutoKGPendente(produto);
      return;
    }
    const qtd = Math.max(1, multiplicador);
    const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
    const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
    setItensCarrinho(prev => {
      const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
      if (idx >= 0) {
        const novo = [...prev];
        const novaQtd = parseFloat(novo[idx].peso) + qtd;
        novo[idx] = {
          ...novo[idx],
          peso: String(novaQtd),
          total: +(novaQtd * novo[idx].precoKg).toFixed(2),
        };
        registrarUltimoItem(novo[idx]);
        return novo;
      }
      const novoItem = {
        id: produto.id,
        nome: produto.nome,
        precoKg: precoAtivo,
        precoNormal: produto.precoVenda,
        precoPromocao: produto.precoPromocao || null,
        emPromocao: !!temPromo,
        peso: String(qtd),
        total: +(qtd * precoAtivo).toFixed(2),
        unidade: 'UN',
        uid: Date.now() + Math.random(),
      };
      registrarUltimoItem(novoItem);
      return [...prev, novoItem];
    });
    setErroVenda(null);
  };

  // Barcode scanner state
  const navigate = useNavigate();
  const barcodeBuffer = useRef('');
  const barcodeTimer  = useRef(null);

  // Persiste carrinho no sessionStorage — sobrevive à navegação entre páginas
  useEffect(() => {
    sessionStorage.setItem('pdv_carrinho', JSON.stringify(itensCarrinho));
  }, [itensCarrinho]);

  useEffect(() => {
    sessionStorage.setItem('pdv_forma', formaPagamento);
  }, [formaPagamento]);

  useEffect(() => {
    sessionStorage.setItem('pdv_valorpago', valorPago);
  }, [valorPago]);

  const cliente = (() => { try { return JSON.parse(localStorage.getItem('cliente')); } catch { return null; } })();

  // Regra de Voucher: se for pago com VOUCHER (único ou se alguma pessoa pagar com Voucher na divisão),
  // a promoção é cancelada e o valor aplicado é o Preço Normal (precoNormal).
  const isVoucherAtivo = (!modoDividido && formaPagamento === 'VOUCHER') ||
    (modoDividido && divisoes.some(d => d.forma === 'VOUCHER'));

  const itensCalculados = itensCarrinho.map(item => {
    if (isVoucherAtivo && item.emPromocao && item.precoNormal > 0) {
      const totalNormal = +(parseFloat(item.peso) * item.precoNormal).toFixed(2);
      return {
        ...item,
        precoKgCobrado: item.precoNormal,
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
  const temItensComPromocao = itensCarrinho.some(i => i.emPromocao);
  const troco = formaPagamento === 'DINHEIRO' && parseFloat(valorPago) > totalGeral
    ? parseFloat(valorPago) - totalGeral : 0;

  const pesoTotalKg = itensCarrinho
    .filter(i => i.unidade !== 'UN')
    .reduce((sum, i) => sum + (parseFloat(i.peso) || 0), 0);

  const totalUnidades = itensCarrinho
    .filter(i => i.unidade === 'UN')
    .reduce((sum, i) => sum + (parseInt(i.peso) || 1), 0);

  const totalEconomia = itensCarrinho.reduce((sum, i) => {
    if (i.emPromocao && i.precoNormal > i.precoKg) {
      const econ = (i.precoNormal - i.precoKg) * parseFloat(i.peso);
      return sum + (econ > 0 ? econ : 0);
    }
    return sum;
  }, 0);

  const itemExibicao = itensCarrinho.length === 0 ? null : (ultimoItemAdicionado || itensCarrinho[itensCarrinho.length - 1]);

  // Gerador de divisões da conta
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
    const n = Math.max(2, Math.min(30, parseInt(novaQtd) || 2));
    setNumPessoas(n);
    setDivisoes(gerarDivisoes(n, totalGeral, divisoes));
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

  useEffect(() => {
    api.get('/produtos').then(({ data }) => setProdutos(data)).catch(() => setProdutos([]));
    api.get('/caixa/status').then(({ data }) => setCaixaAberto(data.aberto && !data.fechado)).catch(() => setCaixaAberto(true));

    // Se veio do "Refazer" do Controle de Caixa, carrega os itens
    try {
      const raw = localStorage.getItem('refazer_venda');
      if (raw) {
        const venda = JSON.parse(raw);
        localStorage.removeItem('refazer_venda');
        if (venda.itens?.length > 0) {
          const itensRefazer = venda.itens.map(i => ({
            id: i.produtoId || 0,
            nome: i.nome,
            precoKg: parseFloat(i.precoKg || i.preco || 0),
            peso: String(i.peso || i.quantidade || 1),
            total: parseFloat(i.total || 0),
            unidade: i.unidade || 'UN',
            uid: Date.now() + Math.random(),
          }));
          setItensCarrinho(itensRefazer);
          setErroVenda(`Venda anterior cancelada — ${venda.itens.length} item(s) recarregado(s). Confira e finalize.`);
          setTimeout(() => setErroVenda(null), 5000);
        }
      }
    } catch {}
  }, []);

  // ── LEITOR DE CÓDIGO DE BARRAS ──────────────────────────────
  // Leitores USB HID funcionam como teclado: digitam muito rápido e mandam Enter
  // Detectamos isso capturando keydown globalmente com debounce de 80ms
  const processarCodigo = useCallback(async (codigo, multiplicador = 1) => {
    if (!codigo || codigo.length < 3) return;

    // Código reservado 999: Item avulso / Diversos com valor aberto
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
        const peso  = +(produto.balancaInfo.pesoCalculado * multiplicador).toFixed(3);
        const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
        const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
        const total = +(peso * precoAtivo).toFixed(2);
        const novoItem = {
          id: produto.id,
          nome: produto.nome,
          precoKg: precoAtivo,
          precoNormal: produto.precoVenda,
          precoPromocao: produto.precoPromocao || null,
          emPromocao: !!temPromo,
          peso: peso.toFixed(3),
          total,
          unidade: 'KG',
          uid: Date.now() + Math.random()
        };
        setItensCarrinho(prev => [...prev, novoItem]);
        registrarUltimoItem(novoItem);
        setErroVenda(null);
        return;
      }

      // Caso 2: produto KG sem código de balança — pede peso manual
      if (produto.unidade === 'KG') {
        setProdutoKGPendente(produto);
        return;
      }

      // Caso 3: produto UN — adiciona 1 (ou multiplicador)
      const qtd = Math.max(1, multiplicador);
      const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
      const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
      setItensCarrinho(prev => {
        const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
        if (idx >= 0) {
          const novo = [...prev];
          const novaQtd = parseFloat(novo[idx].peso) + qtd;
          novo[idx] = {
            ...novo[idx],
            peso: String(novaQtd),
            total: +(novaQtd * novo[idx].precoKg).toFixed(2)
          };
          registrarUltimoItem(novo[idx]);
          return novo;
        }
        const novoItem = {
          id: produto.id,
          nome: produto.nome,
          precoKg: precoAtivo,
          precoNormal: produto.precoVenda,
          precoPromocao: produto.precoPromocao || null,
          emPromocao: !!temPromo,
          peso: String(qtd),
          total: +(qtd * precoAtivo).toFixed(2),
          unidade: 'UN',
          uid: Date.now() + Math.random()
        };
        registrarUltimoItem(novoItem);
        return [...prev, novoItem];
      });
      setErroVenda(null);
    } catch (e) {
      if (e.response?.status === 404) {
        // Código de balança? Mostra info extra
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
        setErroVenda('Erro ao buscar produto.');
      }
    }
  }, []);

  // Vincula código de barras a um produto existente
  const vincularCodigoBarras = async (produtoId, codigo) => {
    try {
      await api.put(`/produtos/${produtoId}`, { codigoBarras: codigo });
      // Recarrega produtos
      const { data } = await api.get('/produtos');
      setProdutos(data);
      setCodigoNaoEncontrado(null);
      setVincularProduto(null);
      // Adiciona ao carrinho
      const produto = data.find(p => p.id === produtoId);
      if (produto?.unidade === 'KG') setProdutoKGPendente(produto);
      else if (produto) {
        adicionarProdutoPorObjeto(produto);
      }
    } catch (e) {
      alert('Erro ao vincular: ' + (e.response?.data?.erro || e.message));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se foco está em campos de texto (digitação normal)
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
        // Se ficar 80ms sem nova tecla, descarta (não é scanner)
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 80);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(barcodeTimer.current); };
  }, [processarCodigo]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F9') { e.preventDefault(); setItemDiversosAberto(true); }
      if (e.key === 'F10' && itensCarrinho.length > 0 && !salvando) {
        e.preventDefault();
        if (confirmar) {
          finalizarVenda();
        } else {
          setConfirmar(true);
        }
      }
      if (e.key === 'Escape') {
        if (pixModalInfo) { setPixModalInfo(null); return; }
        setProdutoKGPendente(null); setItemDiversosAberto(false); setConfirmar(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [itensCarrinho, salvando, confirmar, pixModalInfo, modoDividido, divisoes, valorPago, totalGeral]);

  const adicionarKGManual = (produto, peso) => {
    const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
    const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
    const total = +(peso * precoAtivo).toFixed(2);
    const novoItem = {
      id: produto.id,
      nome: produto.nome,
      precoKg: precoAtivo,
      precoNormal: produto.precoVenda,
      precoPromocao: produto.precoPromocao || null,
      emPromocao: !!temPromo,
      peso: peso.toFixed(3),
      total,
      unidade: 'KG',
      uid: Date.now() + Math.random()
    };
    setItensCarrinho(prev => [...prev, novoItem]);
    registrarUltimoItem(novoItem);
    setProdutoKGPendente(null);
    setErroVenda(null);
  };

  const adicionarUN = (produto) => {
    const qtd = qtds[produto.id] || 1;
    const temPromo = produto.precoPromocao && produto.precoPromocao > 0;
    const precoAtivo = temPromo ? produto.precoPromocao : produto.precoVenda;
    setItensCarrinho(prev => {
      const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
      if (idx >= 0) {
        const novo = [...prev];
        const novaQtd = parseFloat(novo[idx].peso) + qtd;
        novo[idx] = {
          ...novo[idx],
          peso: String(novaQtd),
          total: +(novaQtd * novo[idx].precoKg).toFixed(2)
        };
        registrarUltimoItem(novo[idx]);
        return novo;
      }
      const novoItem = {
        id: produto.id,
        nome: produto.nome,
        precoKg: precoAtivo,
        precoNormal: produto.precoVenda,
        precoPromocao: produto.precoPromocao || null,
        emPromocao: !!temPromo,
        peso: String(qtd),
        total: +(qtd * precoAtivo).toFixed(2),
        unidade: 'UN',
        uid: Date.now() + Math.random()
      };
      registrarUltimoItem(novoItem);
      return [...prev, novoItem];
    });
    setQtds(q => ({ ...q, [produto.id]: 1 }));
    setErroVenda(null);
  };

  const removerItem = (uid) => {
    setItensCarrinho(prev => {
      const filtrados = prev.filter(i => i.uid !== uid);
      if (filtrados.length === 0) {
        setUltimoItemAdicionado(null);
      } else {
        const ultimo = filtrados[filtrados.length - 1];
        registrarUltimoItem(ultimo);
      }
      return filtrados;
    });
  };

  const finalizarVenda = async () => {
    if (itensCarrinho.length === 0 || salvando) return;

    let payloadVenda = {
      itens: itensCalculados.map(i => ({
        nome: i.nome,
        peso: i.peso,
        precoKg: i.precoKgCobrado,
        total: i.totalCobrado,
        unidade: i.unidade || 'UN',
        produtoId: i.id,
      }))
    };

    let pagamentosParaCupom = null;

    if (modoDividido) {
      if (Math.abs(diferencaDivisao) > 0.05) {
        return setErroVenda(`A soma das pessoas (R$ ${somaDivisoes.toFixed(2)}) não bate com o total (R$ ${totalGeral.toFixed(2)}). Ajuste os valores.`);
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

      payloadVenda.pagamentos = pags;
      pagamentosParaCupom = pags;
    } else {
      if (formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== '')
        return setErroVenda('Valor pago insuficiente.');
      payloadVenda.formaPagamento = formaPagamento;
      payloadVenda.valorPago = parseFloat(valorPago) || totalGeral;
    }

    payloadVenda.emitirNfce = emitirNfce;
    if (emitirNfce && cpfDestinatario.trim()) {
      payloadVenda.cpfDestinatario = cpfDestinatario.trim();
    }

    setConfirmar(false); setSalvando(true); setErroVenda(null);
    try {
      const { data } = await api.post('/gestao/venda', payloadVenda);
      setUltimaVendaId(data.vendaId);
      await imprimirCupom(
        itensCalculados.map(i => ({
          ...i,
          precoKg: i.precoKgCobrado,
          total: i.totalCobrado,
        })),
        totalGeral,
        cliente?.nomeAcougue,
        modoDividido ? 'MULTIPLO' : formaPagamento,
        modoDividido ? totalGeral : (parseFloat(valorPago) || totalGeral),
        data.troco || 0,
        pagamentosParaCupom,
        data.nfce
      );
      setVendaFinalizada(true);
      setTimeout(() => {
        setItensCarrinho([]); setVendaFinalizada(false); setValorPago(''); setFormaPagamento('DINHEIRO'); setErroVenda(null);
        setModoDividido(false);
        setUltimoItemAdicionado(null);
        setEmitirNfce(false);
        setCpfDestinatario('');
        sessionStorage.removeItem('pdv_carrinho');
        sessionStorage.removeItem('pdv_forma');
        sessionStorage.removeItem('pdv_valorpago');
      }, 3000);
    } catch (e) { setErroVenda(e.response?.data?.erro || 'Erro ao registrar venda.'); }
    finally { setSalvando(false); }
  };

  const cancelarUltimaVenda = async () => {
    if (!ultimaVendaId || cancelando) return;
    if (!confirm('Cancelar a ultima venda?')) return;
    setCancelando(true);
    try { await api.patch(`/gestao/venda/${ultimaVendaId}/cancelar`); setUltimaVendaId(null); alert('Venda cancelada!'); }
    catch (e) { alert(e.response?.data?.erro || 'Erro ao cancelar.'); }
    finally { setCancelando(false); }
  };

  // Produtos filtrados para lista manual
  const produtosFiltrados = busca.trim()
    ? produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()) || p.categoria?.toLowerCase().includes(busca.toLowerCase()) || p.codigoBarras?.includes(busca))
    : produtos;

  const porCategoria = produtosFiltrados.reduce((acc, p) => {
    const cat = p.categoria || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  // Sugestões para o Modo Limpo (barra inferior)
  const produtosSugeridos = (() => {
    if (!buscaBaixo.trim()) return [];
    let termo = buscaBaixo.toLowerCase().trim();
    if (termo.includes('*')) {
      termo = termo.split('*')[1]?.trim() || termo;
    }
    if (!termo) return [];
    return produtos.filter(p => (
      p.nome.toLowerCase().includes(termo) ||
      p.categoria?.toLowerCase().includes(termo) ||
      (p.codigoBarras && p.codigoBarras.includes(termo))
    )).slice(0, 8);
  })();

  const handleBuscaBaixoChange = (e) => {
    const val = e.target.value;
    setBuscaBaixo(val);
    setSugestoesAbertas(val.trim().length > 0);
    setIndiceSugerido(0);
  };

  const selecionarSugestao = (prod, multiplicador = 1) => {
    if (!prod) return;
    if (prod.unidade === 'KG') {
      setProdutoKGPendente(prod);
    } else {
      adicionarProdutoPorObjeto(prod, multiplicador);
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
      setBuscaBaixo('');
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

      // Se há multiplicador (ex: "3*coca" ou "3*789...")
      let mult = 1;
      let termo = val;
      if (val.includes('*')) {
        const partes = val.split('*');
        const m = parseFloat(partes[0]);
        if (!isNaN(m) && m > 0) {
          mult = m;
          termo = partes.slice(1).join('*').trim();
        }
      }

      // Se tem sugestões abertas e há produtos
      if (sugestoesAbertas && produtosSugeridos.length > 0) {
        const prod = produtosSugeridos[indiceSugerido] || produtosSugeridos[0];
        selecionarSugestao(prod, mult);
        return;
      }

      // Se não há lista aberta ou é código direto, processa como código de barras
      processarCodigo(termo, mult);
      setBuscaBaixo('');
      setSugestoesAbertas(false);
    }
  };

  // Auto-foco na barra inferior quando no modo limpo e sem modais abertos
  useEffect(() => {
    if (modoLayout === 'limpo') {
      if (!confirmar && !produtoKGPendente && !itemDiversosAberto && !codigoNaoEncontrado && !pixModalInfo) {
        setTimeout(() => inputBaixoRef.current?.focus(), 80);
      }
    }
  }, [modoLayout, confirmar, produtoKGPendente, itemDiversosAberto, codigoNaoEncontrado, pixModalInfo, itensCarrinho.length]);

  return (
    <div className="h-full max-h-screen bg-page text-stone-900 flex flex-col select-none font-sans overflow-hidden">

      {/* MODAL CÓDIGO NÃO ENCONTRADO */}
      {codigoNaoEncontrado && (
        <ModalCodigoNaoEncontrado
          codigo={codigoNaoEncontrado.codigo}
          balanca={codigoNaoEncontrado.balanca}
          codigoProduto={codigoNaoEncontrado.codigoProduto}
          valorTotal={codigoNaoEncontrado.valorTotal}
          produtos={produtos}
          onVincular={(produtoId) => vincularCodigoBarras(produtoId, codigoNaoEncontrado.balanca ? codigoNaoEncontrado.codigoProduto : codigoNaoEncontrado.codigo)}
          onCadastrar={() => {
            // Para código de balança, cadastra com o código curto, não o completo
            const cod = codigoNaoEncontrado.balanca ? codigoNaoEncontrado.codigoProduto : codigoNaoEncontrado.codigo;
            setCodigoNaoEncontrado(null);
            // Salva no localStorage e navega sem recarregar a página
            localStorage.setItem('novoProdutoCodigo', cod);
            navigate('/produtos');
          }}
          onFechar={() => setCodigoNaoEncontrado(null)}
        />
      )}

      {/* MODAL PESO KG */}
      {produtoKGPendente && (
        <ModalPesoKG
          produto={produtoKGPendente}
          onConfirmar={(peso) => adicionarKGManual(produtoKGPendente, peso)}
          onCancelar={() => setProdutoKGPendente(null)}
        />
      )}

      {/* MODAL ITEM DIVERSOS 999 */}
      {itemDiversosAberto && (
        <ModalItemDiversos
          onConfirmar={(item) => {
            setItensCarrinho(prev => [...prev, item]);
            setItemDiversosAberto(false);
          }}
          onCancelar={() => setItemDiversosAberto(false)}
        />
      )}

      {/* AVISO CAIXA */}
      {caixaAberto === false && (
        <div className="bg-brand-600/10 border-b border-brand-600/30 px-6 py-2 flex items-center gap-2 flex-shrink-0">
          <span>⚠️</span>
          <span className="text-amber-700 text-xs font-bold">Caixa nao aberto — va em Controle de Caixa</span>
        </div>
      )}

      {/* MODAL FINALIZAR */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4">
          <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 sm:p-7 w-full max-w-xl shadow-modal max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200 mb-4 flex-shrink-0">
              <div>
                <p className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">Finalizar Venda</p>
                <p className="text-xs sm:text-sm text-stone-500 font-medium">Confirme o recebimento e selecione o método de pagamento</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black uppercase tracking-wider text-stone-400 block mb-0.5">Total Geral</span>
                <span className="text-3xl sm:text-4xl font-black text-stone-900 font-mono tracking-tight">R$ {totalGeral.toFixed(2)}</span>
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
                      Os itens com desconto promocional foram recalculados automaticamente pelo <strong>preço normal</strong> de cadastro. A promoção é válida apenas para pagamentos em Dinheiro, PIX e Cartões.
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

                  {/* SEÇÃO PIX DINÂMICO */}
                  {formaPagamento === 'PIX' && (
                    <SecaoPixPdv total={totalGeral} cliente={cliente} />
                  )}

                  {/* SEÇÃO DINHEIRO */}
                  {formaPagamento === 'DINHEIRO' && (
                    <div className="mb-4">
                      <label className="block text-xs font-black uppercase tracking-wider text-stone-600 mb-1.5">Valor Recebido do Cliente (R$)</label>
                      <input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)}
                        placeholder={totalGeral.toFixed(2)} autoFocus
                        className="w-full bg-stone-100 border-2 border-stone-300 focus:border-brand-500 rounded-2xl px-5 py-3.5 text-stone-900 text-3xl font-black focus:outline-none font-mono text-right transition-colors"
                        onKeyDown={e => e.key === 'Enter' && finalizarVenda()} />
                      {troco > 0 && (
                        <div className="mt-3 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-2xl px-5 py-3.5 flex justify-between items-center">
                          <span className="text-emerald-800 text-sm font-black uppercase tracking-wider">Troco a Devolver</span>
                          <span className="text-emerald-800 text-3xl font-black font-mono">R$ {troco.toFixed(2)}</span>
                        </div>
                      )}
                      {parseFloat(valorPago) > 0 && parseFloat(valorPago) < totalGeral && (
                        <div className="mt-3 bg-red-500/10 border-2 border-red-500/30 rounded-2xl px-4 py-2.5 text-center">
                          <p className="text-red-700 text-sm font-bold">Falta R$ {(totalGeral - parseFloat(valorPago)).toFixed(2)}</p>
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
                      R$ {(totalGeral / numPessoas).toFixed(2)} cada (Resetar)
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
                            <span className="text-xs text-blue-700 font-semibold">PIX: <strong>R$ {Number(p.valor || 0).toFixed(2)}</strong></span>
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
                                  Troco R$ {(parseFloat(p.valorPago) - parseFloat(p.valor)).toFixed(2)}
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
                        R$ {somaDivisoes.toFixed(2)} / R$ {totalGeral.toFixed(2)}
                      </span>
                    </div>

                    {/* Breakdown por Forma */}
                    <div className="pt-1.5 border-t border-stone-200 flex flex-wrap gap-1.5">
                      {Object.entries(resumoFormasDivisao).map(([forma, item]) => item.total > 0 && (
                        <span key={forma} className="bg-white border border-stone-200 text-stone-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                          <span>{FORMAS.find(f => f.id === forma)?.icon}</span>
                          <span>{item.qtd}x {forma}:</span>
                          <strong className="font-mono">R$ {item.total.toFixed(2)}</strong>
                        </span>
                      ))}
                    </div>

                    {Math.abs(diferencaDivisao) > 0.01 && (
                      <div className="mt-1 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                        {diferencaDivisao > 0
                          ? `⚠️ Falta distribuir R$ ${diferencaDivisao.toFixed(2)}`
                          : `⚠️ Total excede a venda em R$ ${Math.abs(diferencaDivisao).toFixed(2)}`}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* OPÇÃO DE EMISSÃO FISCAL (NFC-e) */}
            <div className="mb-3 p-3.5 rounded-2xl border border-stone-200 bg-stone-50/80 flex-shrink-0">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={emitirNfce}
                  onChange={e => setEmitirNfce(e.target.checked)}
                  className="w-5 h-5 accent-emerald-600 rounded border-stone-300"
                />
                <div className="flex-1">
                  <span className="text-xs sm:text-sm font-bold text-stone-900 flex items-center gap-1.5">
                    🧾 Emitir Cupom Fiscal (NFC-e na SEFAZ/PR)
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Gera a nota com QR Code oficial e protocolo SEFAZ Paraná
                  </span>
                </div>
              </label>

              {emitirNfce && (
                <div className="mt-2.5 pt-2.5 border-t border-stone-200 flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-700 whitespace-nowrap">CPF na Nota:</span>
                  <input
                    type="text"
                    placeholder="000.000.000-00 (Opcional - Nota Paraná)"
                    value={cpfDestinatario}
                    onChange={e => setCpfDestinatario(e.target.value)}
                    maxLength={14}
                    className="flex-1 px-3 py-1.5 text-xs border border-stone-300 rounded-lg font-mono bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {erroVenda && <p className="mb-3 text-red-700 text-sm font-medium bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 flex-shrink-0">{erroVenda}</p>}

            <div className="flex gap-3 pt-3 border-t border-stone-200 flex-shrink-0">
              <button
                onClick={finalizarVenda}
                disabled={
                  salvando ||
                  (!modoDividido && formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== '') ||
                  (modoDividido && Math.abs(diferencaDivisao) > 0.05)
                }
                className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black text-base uppercase tracking-wider rounded-2xl transition-all shadow-md active:scale-98"
              >
                {salvando ? 'Processando...' : 'Confirmar Venda (F10)'}
              </button>
              <button
                onClick={() => { setConfirmar(false); setErroVenda(null); }}
                className="flex-1 py-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-base rounded-2xl transition-all"
              >
                Cancelar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL QR CODE PIX INDIVIDUAL PARA QUEM PAGA NO PIX NA CONTA DIVIDIDA */}
      {pixModalInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border-2 border-stone-200 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-base font-black text-stone-900">QR Code PIX - {pixModalInfo.nome}</p>
                <p className="text-xs text-stone-500 font-medium">Valor individual: <strong className="text-blue-700 font-mono text-sm">R$ {Number(pixModalInfo.valor || 0).toFixed(2)}</strong></p>
              </div>
              <button onClick={() => setPixModalInfo(null)} className="text-stone-400 hover:text-stone-700 text-xl font-bold leading-none p-1">✕</button>
            </div>
            <SecaoPixPdv total={Number(pixModalInfo.valor || 0)} cliente={cliente} />
            <button
              onClick={() => setPixModalInfo(null)}
              className="w-full mt-3 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-black uppercase tracking-wider rounded-xl transition-colors"
            >
              Fechar QR Code
            </button>
          </div>
        </div>
      )}

      {/* TOPO — STATUS SCANNER E SELETOR DE MODO */}
      <header className="bg-white border-b border-stone-200 px-4 py-2 flex items-center justify-between flex-shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg shadow-2xs">
            📷
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-stone-900 tracking-tight">Frente de Caixa (PDV)</h1>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-black tracking-wide ${modoLayout === 'limpo' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-blue-100 text-blue-900 border border-blue-300'}`}>
                {modoLayout === 'limpo' ? '⚡ Modo Limpo' : '📑 Modo Clássico'}
              </span>
            </div>
            <p className="text-xs text-stone-500 font-medium">Aponte o scanner para o produto — ele será adicionado automaticamente</p>
          </div>
        </div>

        {/* Flash feedback do scan */}
        {flashCodigo && (
          <div className="flex items-center gap-2 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-xl px-5 py-2 animate-pulse">
            <span className="text-emerald-700 text-lg font-black">✓</span>
            <span className="text-emerald-800 text-sm font-black font-mono">{flashCodigo}</span>
          </div>
        )}

        {/* SELETOR DE MODO DO PDV (ALTERNÂNCIA FÁCIL) */}
        <div className="flex items-center gap-5">
          <div className="flex items-center bg-stone-100 p-1.5 rounded-2xl border border-stone-200 shadow-inner">
            <button
              type="button"
              onClick={() => alternarModoLayout('limpo')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
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
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
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
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition-colors shadow-2xs"
            title="Alternar Tela Cheia (F11) para aproveitar o monitor inteiro"
          >
            <span>⛶</span>
            <span>Tela Cheia</span>
          </button>

          <div className="text-right min-w-28 pl-4 border-l border-stone-200">
            <p className="text-xs text-stone-500 font-bold">{itensCarrinho.length} item(ns)</p>
            <p className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight leading-none mt-0.5">R$ {totalGeral.toFixed(2)}</p>
          </div>
        </div>
      </header>

      {modoLayout === 'classico' ? (
        /* CORPO — MODO CLÁSSICO (100% PRESERVADO) */
        <div className="flex flex-1 overflow-hidden">

          {/* LISTA MANUAL DE PRODUTOS */}
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
                                R$ {p.precoPromocao.toFixed(2)}/{isUN ? 'un' : 'kg'}
                              </p>
                              <p className="text-xs text-stone-400 line-through font-mono">
                                R$ {p.precoVenda.toFixed(2)}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-emerald-700 font-bold font-mono mt-1">R$ {p.precoVenda.toFixed(2)}/{isUN ? 'un' : 'kg'}</p>
                          )}
                        </div>
                        {isUN ? (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center bg-stone-100 border-2 border-stone-200 rounded-xl overflow-hidden">
                              <button onClick={() => setQtds(q => ({ ...q, [p.id]: Math.max(1, (q[p.id]||1) - 1) }))} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors font-black text-base">−</button>
                              <span className="px-2 text-stone-900 font-black font-mono text-sm sm:text-base min-w-[1.75rem] text-center">{qtd}</span>
                              <button onClick={() => setQtds(q => ({ ...q, [p.id]: (q[p.id]||1) + 1 }))} className="w-8 h-8 flex items-center justify-center text-stone-700 hover:text-stone-900 hover:bg-stone-200 transition-colors font-black text-base">+</button>
                            </div>
                            <button onClick={() => adicionarUN(p)} className="bg-brand-600 hover:bg-brand-700 text-white font-black text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all active:scale-95 shadow-sm">
                              + {(precoAtivo * qtd).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
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

          {/* CUPOM */}
          <section className="w-3/5 flex flex-col bg-white">
            <div className="px-6 py-4 border-b border-stone-200 flex-shrink-0 flex items-center justify-between bg-stone-50/50">
              <div>
                <p className="text-base text-stone-900 font-black flex items-center gap-2"><span>🛒</span> Cupom Fiscal / Itens</p>
                <p className="text-stone-500 text-xs font-semibold mt-0.5">{itensCarrinho.length} item(ns) adicionados</p>
              </div>
              <span className="text-3xl font-black text-stone-900 font-mono">R$ {totalGeral.toFixed(2)}</span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {itensCarrinho.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-stone-400 gap-3 py-16">
                  <span className="text-6xl">📷</span>
                  <p className="text-sm font-bold text-center text-stone-500 leading-relaxed">Aponte o leitor de código de barras<br/>ou selecione ao lado</p>
                </div>
              )}
              {itensCarrinho.map((item, idx) => (
                <div key={item.uid} className="bg-white border-2 border-stone-200 hover:border-brand-500 rounded-2xl p-4 flex items-center justify-between group transition-all shadow-2xs">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span className="text-stone-400 text-sm font-black w-6 text-center flex-shrink-0">{idx+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base sm:text-lg font-black text-stone-900 truncate leading-snug">{item.nome}</p>
                        {item.emPromocao && (
                          <span className="text-xs bg-amber-500/15 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">🔥 Promo</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-stone-500 mt-0.5">
                        <span className="font-bold text-stone-700">{item.unidade === 'UN' ? `${item.peso} un` : `${item.peso} kg`}</span>
                        <span className="mx-2 text-stone-300 font-normal">×</span>
                        <span className="font-mono">R$ {parseFloat(item.precoKg).toFixed(2)}/{item.unidade === 'UN' ? 'un' : 'kg'}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                    <span className="text-emerald-700 font-black text-xl font-mono">R$ {item.total.toFixed(2)}</span>
                    <button onClick={() => removerItem(item.uid)} className="text-stone-300 hover:text-red-600 transition-colors text-2xl leading-none opacity-40 group-hover:opacity-100 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 font-bold">×</button>
                  </div>
                </div>
              ))}
            </div>

            {erroVenda && !confirmar && (
              <div className="mx-6 mb-3 text-xs sm:text-sm font-bold rounded-xl px-4 py-3 border text-amber-800 bg-amber-50 border-amber-300">{erroVenda}</div>
            )}

            <div className="border-t border-stone-200 p-6 space-y-4 flex-shrink-0 bg-stone-50/60">
              <div className="flex justify-between items-baseline">
                <span className="text-stone-500 uppercase text-xs sm:text-sm tracking-widest font-black">TOTAL A PAGAR</span>
                <span className="text-4xl sm:text-5xl font-black text-stone-900 font-mono tracking-tight">R$ {totalGeral.toFixed(2)}</span>
              </div>
              <button onClick={() => setConfirmar(true)} disabled={itensCarrinho.length === 0 || salvando}
                className={`w-full py-5 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider transition-all duration-200 active:scale-98 shadow-md
                  ${vendaFinalizada ? 'bg-emerald-600 text-white'
                  : itensCarrinho.length === 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed shadow-none'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg'}`}>
                {salvando ? 'Processando...' : vendaFinalizada ? '✓ Venda Concluída!' : 'FINALIZAR VENDA (F10)'}
              </button>
              <div className="flex gap-3">
                <button onClick={() => { setItensCarrinho([]); setErroVenda(null); }} disabled={itensCarrinho.length === 0}
                  className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-black text-stone-500 hover:text-stone-800 hover:bg-stone-200 bg-stone-100 transition-colors disabled:opacity-0">
                  Limpar carrinho
                </button>
                {ultimaVendaId && (
                  <button onClick={cancelarUltimaVenda} disabled={cancelando}
                    className="flex-1 py-3 rounded-xl text-xs sm:text-sm font-black text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 transition-colors">
                    {cancelando ? 'Cancelando...' : '↩ Cancelar última'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* CORPO — MODO LIMPO (CAIXA RÁPIDO COM BUSCA INFERIOR) */
        <div className="flex flex-1 flex-col overflow-hidden bg-stone-100/60">
          {/* ÁREA SUPERIOR: CUPOM À ESQUERDA + RESUMO/TOTAIS À DIREITA */}
          <div className="flex flex-1 overflow-hidden">

            {/* PAINEL PRINCIPAL: ITENS DA VENDA ATUAL (CUPOM AMPLO) */}
            <section className="flex-1 flex flex-col bg-white border-r border-stone-200 overflow-hidden">


              {/* Tabela de Itens do Cupom ou Mensagem de Aguardando */}
              <div className="flex-1 overflow-y-auto">
                {itensCarrinho.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center select-none">
                    <div className="w-24 h-24 rounded-3xl bg-white border-2 border-stone-200 flex items-center justify-center mb-5 text-4xl shadow-md">
                      🛒
                    </div>
                    <h3 className="text-xl font-black text-stone-900 mb-1.5">Caixa Aberto · Pronto para Vender</h3>
                    <p className="text-sm text-stone-500 max-w-md mb-8 leading-relaxed font-medium">
                      Aponte o leitor de código de barras ou utilize a <strong>barra de busca na parte inferior</strong> da tela para registrar produtos rapidamente.
                    </p>
                    <div className="flex flex-wrap gap-3 justify-center max-w-lg">
                      <div className="px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-700 flex items-center gap-2 font-bold">
                        <span className="bg-stone-200 text-stone-900 px-2 py-0.5 rounded-md font-mono font-black text-xs">F9</span>
                        <span>Item Avulso (999)</span>
                      </div>
                      <div className="px-4 py-2.5 bg-white rounded-xl border border-stone-200 shadow-2xs text-xs text-stone-700 flex items-center gap-2 font-bold">
                        <span className="bg-stone-200 text-stone-900 px-2 py-0.5 rounded-md font-mono font-black text-xs">F10</span>
                        <span>Finalizar Venda</span>
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
                      <div className="col-span-5">Produto / Descrição</div>
                      <div className="col-span-2 text-right">Preço Unit.</div>
                      <div className="col-span-2 text-center">Qtd / Peso</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>

                    {/* Linhas dos Itens */}
                    {itensCarrinho.map((item, idx) => (
                      <div
                        key={item.uid}
                        className="grid grid-cols-12 items-center bg-white border-2 border-stone-200 hover:border-brand-500 rounded-2xl p-4 sm:p-4.5 shadow-2xs transition-all group"
                      >
                        {/* # */}
                        <div className="col-span-1 text-center font-black text-base sm:text-lg text-stone-500 font-mono">
                          {idx + 1}
                        </div>

                        {/* Nome */}
                        <div className="col-span-5 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-stone-900 text-lg sm:text-xl truncate leading-snug">{item.nome}</p>
                            {item.emPromocao && (
                              <span className="text-xs bg-amber-500/15 text-amber-800 font-extrabold px-2 py-0.5 rounded border border-amber-500/30 flex-shrink-0">🔥 Promo</span>
                            )}
                          </div>
                          <span className="text-sm text-stone-500 font-bold">
                            {item.unidade === 'UN' ? 'Unidade' : 'Quilo (KG)'}
                          </span>
                        </div>

                        {/* Preço Unitário */}
                        <div className="col-span-2 text-right text-base sm:text-lg font-black text-stone-800 font-mono">
                          R$ {parseFloat(item.precoKg).toFixed(2)}
                        </div>

                        {/* Qtd / Peso com botões de ajuste rápido */}
                        <div className="col-span-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => alterarQuantidade(item.uid, -1)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-black text-lg sm:text-xl flex items-center justify-center transition-colors active:scale-95"
                            title="Diminuir quantidade"
                          >
                            −
                          </button>
                          <span className="font-black text-base sm:text-lg font-mono text-stone-900 min-w-[4rem] text-center">
                            {item.peso} {item.unidade.toLowerCase()}
                          </span>
                          <button
                            type="button"
                            onClick={() => alterarQuantidade(item.uid, +1)}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 font-black text-lg sm:text-xl flex items-center justify-center transition-colors active:scale-95"
                            title="Aumentar quantidade"
                          >
                            +
                          </button>
                        </div>

                        {/* Subtotal e Excluir */}
                        <div className="col-span-2 flex items-center justify-end gap-3">
                          <span className="font-black text-xl sm:text-2xl font-mono text-emerald-700">
                            R$ {item.total.toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removerItem(item.uid)}
                            className="w-9 h-9 rounded-xl text-stone-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center text-xl font-black transition-all opacity-40 group-hover:opacity-100"
                            title="Remover item da venda"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* PAINEL LATERAL DIREITO: DISPLAY FRENTE DE CAIXA / CLIENTE E FINALIZAÇÃO (FUNDO CLARO E LETRAS GRANDES) */}
            <aside className="w-84 md:w-96 lg:w-[410px] flex flex-col bg-stone-100/90 text-stone-900 p-3.5 sm:p-4 flex-shrink-0 border-l-2 border-stone-200 justify-between overflow-y-auto gap-2.5 shadow-sm">
              
              {/* TOPO: STATUS E DISPLAY DE PRODUTOS */}
              <div className="space-y-2.5 flex-shrink-0">
                
                {/* BARRA DE STATUS DO CAIXA */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-stone-200 shadow-2xs">
                    <span className={`w-2.5 h-2.5 rounded-full ${itensCarrinho.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`} />
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-stone-800">
                      {itensCarrinho.length > 0 ? 'Registrando Compra' : 'Caixa Livre · Pronto'}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-stone-600 bg-white px-2.5 py-1 rounded-full border border-stone-200 uppercase shadow-2xs">
                    Frente de Caixa
                  </span>
                </div>

                {/* DISPLAY DO PRODUTO ATUAL / ÚLTIMO ITEM PASSADO */}
                {itemExibicao ? (
                  <div className="bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-emerald-500 shadow-sm relative overflow-hidden animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                        Item #{itensCarrinho.length}
                      </span>
                      {itemExibicao.emPromocao && (
                        <span className="text-xs bg-amber-100 text-amber-900 font-black px-2.5 py-1 rounded-full border border-amber-300">
                          🔥 Promoção
                        </span>
                      )}
                    </div>

                    {/* Nome do Produto com Alta Visibilidade */}
                    <h3 className="text-lg sm:text-xl font-black text-stone-900 leading-tight my-1.5 truncate" title={itemExibicao.nome}>
                      {itemExibicao.nome}
                    </h3>

                    {/* Dados de Peso / Qtd / Preço / Subtotal */}
                    <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200 grid grid-cols-3 gap-1.5 text-center items-center">
                      <div className="text-left pl-1">
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-stone-500 block tracking-wider">
                          {itemExibicao.unidade === 'UN' ? 'Qtd' : 'Peso'}
                        </span>
                        <span className="text-sm sm:text-base font-black font-mono text-stone-900 truncate block">
                          {itemExibicao.peso} {itemExibicao.unidade?.toLowerCase() || 'un'}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-stone-500 block tracking-wider">
                          Unitário
                        </span>
                        <span className="text-xs sm:text-sm font-black font-mono text-stone-700 block truncate">
                          R$ {parseFloat(itemExibicao.precoKg || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="text-right pr-1">
                        <span className="text-[10px] sm:text-xs uppercase font-extrabold text-emerald-700 block tracking-wider">
                          Subtotal
                        </span>
                        <span className="text-base sm:text-lg font-black font-mono text-emerald-700 block truncate">
                          R$ {parseFloat(itemExibicao.total || 0).toFixed(2)}
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
                      <h4 className="text-sm font-black text-stone-900 leading-tight">Pronto para Registrar</h4>
                      <p className="text-xs text-stone-400 truncate">Aguardando código no leitor ou busca...</p>
                    </div>
                  </div>
                )}

                {/* VISOR DIGITAL: TOTAL A PAGAR (FUNDO CLARO COM MÁXIMA LEITURA) */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border-2 border-stone-300 shadow-sm relative overflow-hidden flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-stone-500 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      TOTAL A PAGAR
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-black text-stone-800 bg-stone-100 px-2.5 py-1 rounded-full border border-stone-200">
                      {itensCarrinho.length} {itensCarrinho.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  <div className="my-1 flex items-baseline justify-end gap-2 font-mono">
                    <span className="text-3xl sm:text-4xl text-stone-400 font-black select-none">R$</span>
                    <span className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-emerald-600 leading-none">
                      {totalGeral.toFixed(2)}
                    </span>
                  </div>

                  {/* Detalhes extras de resumo */}
                  <div className="mt-2.5 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs sm:text-sm font-bold text-stone-600">
                    <div>
                      {pesoTotalKg > 0 && (
                        <span>Peso: <strong className="font-mono text-stone-900 font-black">{pesoTotalKg.toFixed(3)} kg</strong></span>
                      )}
                      {pesoTotalKg > 0 && totalUnidades > 0 && <span className="mx-1.5">•</span>}
                      {totalUnidades > 0 && (
                        <span>Qtd: <strong className="font-mono text-stone-900 font-black">{totalUnidades} un</strong></span>
                      )}
                      {pesoTotalKg === 0 && totalUnidades === 0 && (
                        <span>Itens: <strong className="font-mono text-stone-900 font-black">{itensCarrinho.length}</strong></span>
                      )}
                    </div>

                    {totalEconomia > 0 && (
                      <span className="text-amber-900 font-black bg-amber-50 px-2 py-0.5 rounded border border-amber-300 text-xs">
                        Econ: R$ {totalEconomia.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>

                {erroVenda && !confirmar && (
                  <div className="bg-red-50 border-2 border-red-300 text-red-700 text-sm font-bold rounded-xl p-3 shadow-2xs">
                    ⚠️ {erroVenda}
                  </div>
                )}
              </div>

              {/* RODAPÉ DO PAINEL: BOTÕES DE FINALIZAÇÃO E ATALHOS */}
              <div className="space-y-2.5 pt-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setConfirmar(true)}
                  disabled={itensCarrinho.length === 0 || salvando}
                  className={`w-full py-4 px-5 rounded-2xl font-black text-base sm:text-lg uppercase tracking-wider transition-all duration-150 active:scale-98 flex items-center justify-between shadow-md ${
                    itensCarrinho.length === 0
                      ? 'bg-stone-200/90 hover:bg-stone-200 text-stone-500 border-2 border-stone-300 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-700/25 border-2 border-emerald-400/40 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-base ${
                      itensCarrinho.length === 0 ? 'bg-stone-300 text-stone-500' : 'bg-white/20 text-white'
                    }`}>
                      {salvando ? '⏳' : vendaFinalizada ? '✓' : '💳'}
                    </span>
                    <span>{salvando ? 'Processando...' : vendaFinalizada ? 'Concluída!' : 'FINALIZAR VENDA'}</span>
                  </div>
                  <span className={`text-xs sm:text-sm font-mono font-black px-2.5 py-1 rounded-lg border ${
                    itensCarrinho.length === 0 ? 'bg-stone-300/80 border-stone-400 text-stone-600' : 'bg-emerald-950/60 border-emerald-300/40 text-emerald-100'
                  }`}>
                    F10
                  </span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setItemDiversosAberto(true)}
                    className="py-3 px-3 bg-white hover:bg-amber-50 text-amber-900 border-2 border-amber-300 hover:border-amber-400 rounded-xl text-xs sm:text-sm font-black transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span className="text-base">🏷️</span>
                    <span>+ Diversos (F9)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setItensCarrinho([]); setErroVenda(null); setUltimoItemAdicionado(null); }}
                    disabled={itensCarrinho.length === 0}
                    className="py-3 px-3 bg-white hover:bg-red-50 text-stone-700 hover:text-red-700 border-2 border-stone-200 hover:border-red-300 rounded-xl text-xs sm:text-sm font-black transition-all shadow-2xs disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span className="text-base">🧹</span>
                    <span>Limpar</span>
                  </button>
                </div>

                {ultimaVendaId && (
                  <button
                    type="button"
                    onClick={cancelarUltimaVenda}
                    disabled={cancelando}
                    className="w-full py-2.5 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {cancelando ? 'Cancelando...' : '↩ Cancelar Última Venda'}
                  </button>
                )}
              </div>
            </aside>
          </div>

          {/* BARRA DE PESQUISA E CÓDIGO DE BARRAS INFERIOR (FIXADA NO RODAPÉ - COMPACTA) */}
          <div className="relative bg-white border-t border-stone-200 px-4 py-2.5 shadow-lg z-20 flex-shrink-0">
            {/* POPUP DE SUGESTÕES FLUTUANTE ACIMA DA BARRA */}
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
                                    R$ {prod.precoPromocao.toFixed(2)}
                                  </p>
                                </div>
                                <span className="text-xs text-stone-400 line-through font-mono">
                                  R$ {prod.precoVenda.toFixed(2)}/{prod.unidade === 'UN' ? 'un' : 'kg'}
                                </span>
                              </div>
                            ) : (
                              <p className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                                R$ {prod.precoVenda.toFixed(2)}
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
