import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { imprimirCupom } from '../utils/imprimirCupom';
import { gerarPayloadPix, gerarQrCodePixDataUrl } from '../utils/pix';

function DividirContaPdv({ total }) {
  const [aberto, setAberto] = React.useState(false);
  const [pessoas, setPessoas] = React.useState(2);
  const porPessoa = pessoas > 0 ? total / pessoas : total;
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)}
        className="text-xs text-stone-400 hover:text-stone-600 underline underline-offset-2 mt-1 mb-1">
        🍽️ Dividir conta
      </button>
    );
  }
  return (
    <div className="mt-1 mb-1 p-2 bg-stone-50 rounded border border-stone-200 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs text-stone-600">
        <span>Dividir entre</span>
        <button onClick={() => setPessoas(p => Math.max(2, p - 1))}
          className="w-5 h-5 rounded-full border border-stone-300 bg-white font-bold text-sm leading-none">−</button>
        <input type="number" value={pessoas} min="2"
          onChange={e => setPessoas(Math.max(2, parseInt(e.target.value) || 2))}
          className="w-10 text-center px-1 py-0.5 border border-stone-200 rounded font-bold text-xs" />
        <button onClick={() => setPessoas(p => p + 1)}
          className="w-5 h-5 rounded-full border border-stone-300 bg-white font-bold text-sm leading-none">+</button>
        <span>pessoas</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-emerald-700 font-mono text-sm">R$ {porPessoa.toFixed(2)} cada</span>
        <button onClick={() => setAberto(false)}
          className="text-stone-400 hover:text-stone-600 text-base leading-none">×</button>
      </div>
    </div>
  );
}

const FORMAS = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵', cor: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' },
  { id: 'PIX',      label: 'PIX',      icon: '📱', cor: 'border-blue-500 bg-blue-500/10 text-blue-700' },
  { id: 'DEBITO',   label: 'Debito',   icon: '💳', cor: 'border-purple-500 bg-purple-500/10 text-purple-700' },
  { id: 'CREDITO',  label: 'Credito',  icon: '💳', cor: 'border-orange-500 bg-orange-500/10 text-orange-700' },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-sm shadow-modal">
        <p className="text-xs text-stone-500 font-medium mb-1">Produto KG detectado</p>
        <p className="text-lg font-bold text-stone-900 mb-1">{produto.nome}</p>
        <p className="text-sm text-emerald-700 mb-5">R$ {produto.precoVenda.toFixed(2)}/kg</p>
        <label className="block text-xs text-stone-500 font-medium mb-1.5">Peso (kg)</label>
        <input
          ref={inputRef}
          type="number" step="0.001" value={peso}
          onChange={e => setPeso(e.target.value)}
          placeholder="0.000"
          className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-2xl font-bold font-mono focus:outline-none focus:border-brand-500 text-right mb-2"
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
        />
        {parseFloat(peso) > 0 && (
          <p className="text-right text-emerald-700 text-sm font-bold mb-4">
            = R$ {(parseFloat(peso.replace(',','.')) * produto.precoVenda).toFixed(2)}
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={confirmar} disabled={!peso || parseFloat(peso) <= 0}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wide rounded-lg transition-all active:scale-95">
            Adicionar (Enter)
          </button>
          <button onClick={onCancelar}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-lg transition-all">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-sm shadow-modal">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">🏷️</span>
          <div>
            <p className="text-base font-bold text-stone-900">Item Avulso / Diversos (999)</p>
            <p className="text-xs text-stone-500">Adicionar produto com valor livre na venda</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Descrição do Item</label>
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Ex: Diversos, Tempero especial, Gelo..."
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500 font-sans"
              onKeyDown={e => { if (e.key === 'Enter') valorInputRef.current?.focus(); if (e.key === 'Escape') onCancelar(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Valor Unitário (R$) *</label>
            <input
              ref={valorInputRef}
              type="number"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="0,00"
              className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-2xl font-bold font-mono focus:outline-none focus:border-brand-500 text-right"
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Quantidade</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQtd(q => Math.max(1, (parseInt(q) || 1) - 1))}
                className="w-9 h-9 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 font-bold text-base flex items-center justify-center">
                −
              </button>
              <input
                type="number"
                min="1"
                value={qtd}
                onChange={e => setQtd(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center py-2 border border-stone-300 rounded-lg font-bold text-sm"
                onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
              />
              <button
                type="button"
                onClick={() => setQtd(q => (parseInt(q) || 1) + 1)}
                className="w-9 h-9 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 font-bold text-base flex items-center justify-center">
                +
              </button>
            </div>
          </div>

          {vNum > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 flex justify-between items-center text-xs">
              <span className="text-emerald-700 font-medium">Total do item:</span>
              <span className="font-bold text-emerald-800 text-sm font-mono">R$ {totalItem.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={confirmar}
            disabled={!vNum || vNum <= 0}
            className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wide rounded-lg transition-all active:scale-95">
            Adicionar (Enter)
          </button>
          <button
            onClick={onCancelar}
            className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-lg transition-all">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col" style={{maxHeight:'80vh'}}>
        {/* Header */}
        <div className="px-6 py-5 border-b border-stone-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚠️</span>
            <p className="font-bold text-stone-900 text-base">Código não cadastrado</p>
          </div>
          <p className="text-sm text-stone-600">
            O código <span className="font-mono font-bold text-amber-600">{codigo}</span> não está vinculado a nenhum produto.
          </p>
          {balanca && (
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <p className="text-xs text-blue-700 font-bold mb-1">🏷️ Etiqueta com Peso/Preço Detectada</p>
              <p className="text-xs text-blue-600">Código do produto: <span className="font-mono font-bold">{codigoProduto}</span></p>
              <p className="text-xs text-blue-600">Valor calculado: <span className="font-mono font-bold">R$ {valorTotal?.toFixed(2)}</span></p>
              <p className="text-xs text-blue-500 mt-1">Cadastre o produto com o código <span className="font-mono font-bold">{codigoProduto}</span> para que nas próximas leituras o leitor identifique o item e calcule o peso/valor automaticamente.</p>
            </div>
          )}
        </div>

        {/* Opção 1: Cadastrar novo produto */}
        <div className="p-6 border-b border-stone-200">
          <p className="text-xs font-semibold text-stone-500 mb-3">Opção 1 — Cadastrar Novo</p>
          <button onClick={onCadastrar}
            className="w-full py-3 rounded-xl font-bold text-sm uppercase tracking-wide text-white transition-all active:scale-95"
            style={{background:'#D4890E'}}>
            + Cadastrar Novo Produto
          </button>
          <p className="text-xs text-stone-500 mt-2">Vai abrir a tela de Produtos com o código já preenchido.</p>
        </div>

        {/* Opção 2: Vincular a produto existente */}
        <div className="px-6 pt-6 pb-3 flex-shrink-0">
          <p className="text-xs font-semibold text-stone-500 mb-3">Opção 2 — Vincular a Produto Existente</p>
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">🔍</span>
            <input ref={inputRef} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full bg-white border border-stone-300 rounded-lg pl-9 pr-4 py-2.5 text-sm text-stone-900 focus:outline-none focus:border-brand-600" />
          </div>
        </div>
        <div style={{padding:'0 24px 12px', flex:1, overflowY:'auto', maxHeight:'220px'}}>
          {filtrados.length === 0 ? (
            <p style={{textAlign:'center', color:'#94A3B8', fontSize:'12px', padding:'16px 0'}}>Nenhum produto encontrado</p>
          ) : (
            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
              {filtrados.map(p => (
                <button key={p.id} onClick={() => onVincular(p.id)}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'10px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0',
                    background:'white', cursor:'pointer', textAlign:'left', transition:'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background='#F8FAFC'; e.currentTarget.style.borderColor='#D97706'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='white'; e.currentTarget.style.borderColor='#E2E8F0'; }}>
                  <div style={{flex:1, minWidth:0}}>
                    <p style={{fontWeight:700, fontSize:'14px', color:'#1E293B', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:'2px'}}>
                      {p.nome}
                    </p>
                    <p style={{fontSize:'12px', color:'#64748B'}}>{p.categoria} · {p.unidade}</p>
                  </div>
                  <div style={{textAlign:'right', marginLeft:'12px', flexShrink:0}}>
                    <p style={{fontWeight:700, fontSize:'13px', color:'#16A34A'}}>R$ {p.precoVenda.toFixed(2)}</p>
                    {p.codigoBarras && (
                      <p style={{fontSize:'11px', color:'#D97706', fontFamily:'monospace', fontWeight:600}}>já tem código</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200">
          <button onClick={onFechar}
            className="w-full py-2.5 rounded-lg text-sm text-stone-700 hover:bg-stone-100 transition-colors">
            Cancelar
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
  const buscaRef = useRef(null);

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
  const totalGeral = itensCarrinho.reduce((s, i) => s + i.total, 0);
  const troco = formaPagamento === 'DINHEIRO' && parseFloat(valorPago) > totalGeral
    ? parseFloat(valorPago) - totalGeral : 0;

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
  const processarCodigo = useCallback(async (codigo) => {
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
        const peso  = produto.balancaInfo.pesoCalculado;
        const total = produto.balancaInfo.valorTotal;
        setItensCarrinho(prev => [...prev, {
          id: produto.id, nome: produto.nome, precoKg: produto.precoVenda,
          peso: peso.toFixed(3), total, unidade: 'KG', uid: Date.now()
        }]);
        setErroVenda(null);
        return;
      }

      // Caso 2: produto KG sem código de balança — pede peso manual
      if (produto.unidade === 'KG') {
        setProdutoKGPendente(produto);
        return;
      }

      // Caso 3: produto UN — adiciona 1 (ou +1 se já estiver no carrinho)
      const qtd = 1;
      setItensCarrinho(prev => {
        const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
        if (idx >= 0) {
          const novo = [...prev];
          novo[idx] = { ...novo[idx], peso: String(parseFloat(novo[idx].peso) + qtd), total: novo[idx].total + produto.precoVenda };
          return novo;
        }
        return [...prev, {
          id: produto.id, nome: produto.nome, precoKg: produto.precoVenda,
          peso: String(qtd), total: qtd * produto.precoVenda, unidade: 'UN', uid: Date.now()
        }];
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
        setItensCarrinho(prev => {
          const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
          if (idx >= 0) {
            const novo = [...prev];
            novo[idx] = { ...novo[idx], peso: String(parseFloat(novo[idx].peso) + 1), total: novo[idx].total + produto.precoVenda };
            return novo;
          }
          return [...prev, {
            id: produto.id, nome: produto.nome, precoKg: produto.precoVenda,
            peso: '1', total: produto.precoVenda, unidade: 'UN', uid: Date.now()
          }];
        });
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
      if (e.key === 'F10' && itensCarrinho.length > 0 && !salvando) { e.preventDefault(); setConfirmar(true); }
      if (e.key === 'Escape') { setProdutoKGPendente(null); setItemDiversosAberto(false); setConfirmar(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [itensCarrinho, salvando]);

  const adicionarKGManual = (produto, peso) => {
    setItensCarrinho(prev => [...prev, {
      id: produto.id, nome: produto.nome, precoKg: produto.precoVenda,
      peso: peso.toFixed(3), total: peso * produto.precoVenda, unidade: 'KG', uid: Date.now()
    }]);
    setProdutoKGPendente(null);
    setErroVenda(null);
  };

  const adicionarUN = (produto) => {
    const qtd = qtds[produto.id] || 1;
    setItensCarrinho(prev => {
      const idx = prev.findIndex(i => i.id === produto.id && i.unidade === 'UN');
      if (idx >= 0) {
        const novo = [...prev];
        novo[idx] = { ...novo[idx], peso: String(parseFloat(novo[idx].peso) + qtd), total: novo[idx].total + produto.precoVenda * qtd };
        return novo;
      }
      return [...prev, {
        id: produto.id, nome: produto.nome, precoKg: produto.precoVenda,
        peso: String(qtd), total: qtd * produto.precoVenda, unidade: 'UN', uid: Date.now()
      }];
    });
    setQtds(q => ({ ...q, [produto.id]: 1 }));
    setErroVenda(null);
  };

  const removerItem = (uid) => setItensCarrinho(prev => prev.filter(i => i.uid !== uid));

  const finalizarVenda = async () => {
    if (itensCarrinho.length === 0 || salvando) return;
    if (formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== '')
      return setErroVenda('Valor pago insuficiente.');
    setConfirmar(false); setSalvando(true); setErroVenda(null);
    try {
      const { data } = await api.post('/gestao/venda', {
        itens: itensCarrinho.map(i => ({
          nome: i.nome, peso: i.peso, precoKg: i.precoKg, total: i.total,
          unidade: i.unidade || 'UN', produtoId: i.id,
        })),
        formaPagamento,
        valorPago: parseFloat(valorPago) || totalGeral,
      });
      setUltimaVendaId(data.vendaId);
      imprimirCupom(itensCarrinho, totalGeral, cliente?.nomeAcougue, formaPagamento, parseFloat(valorPago) || totalGeral, data.troco || 0);
      setVendaFinalizada(true);
      setTimeout(() => {
        setItensCarrinho([]); setVendaFinalizada(false); setValorPago(''); setFormaPagamento('DINHEIRO'); setErroVenda(null);
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

  return (
    <div className="h-screen bg-page text-stone-900 flex flex-col select-none font-mono overflow-hidden">

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-md shadow-modal">
            <p className="text-sm font-bold text-stone-900 mb-5 text-center">Finalizar Venda</p>
            <div className="grid grid-cols-4 gap-2 mb-5">
              {FORMAS.map(f => (
                <button key={f.id} onClick={() => { setFormaPagamento(f.id); if (f.id !== 'DINHEIRO') setValorPago(''); }}
                  className={`flex flex-col items-center py-3 rounded-lg border-2 text-xs font-bold uppercase tracking-wide transition-all ${formaPagamento === f.id ? f.cor : 'border-stone-300 text-stone-500 hover:border-stone-400'}`}>
                  <span className="text-xl mb-1">{f.icon}</span>{f.label}
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className="text-stone-600">Total</span>
              <span className="text-2xl font-bold text-stone-900">R$ {totalGeral.toFixed(2)}</span>
            </div>
            <DividirContaPdv total={totalGeral} />
            <div className="mb-4" />

            {/* SEÇÃO PIX DINÂMICO */}
            {formaPagamento === 'PIX' && (
              <SecaoPixPdv total={totalGeral} cliente={cliente} />
            )}
            {formaPagamento === 'DINHEIRO' && (
              <div className="mb-4">
                <label className="block text-xs text-stone-500 font-medium mb-1">Valor Recebido</label>
                <input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)}
                  placeholder={totalGeral.toFixed(2)} autoFocus
                  className="w-full bg-stone-100 border border-stone-300 rounded px-4 py-3 text-stone-900 text-xl font-bold focus:outline-none focus:border-brand-500 font-mono text-right"
                  onKeyDown={e => e.key === 'Enter' && finalizarVenda()} />
                {troco > 0 && (
                  <div className="mt-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 flex justify-between">
                    <span className="text-emerald-700 text-xs font-semibold">Troco</span>
                    <span className="text-emerald-700 text-2xl font-bold">R$ {troco.toFixed(2)}</span>
                  </div>
                )}
                {parseFloat(valorPago) > 0 && parseFloat(valorPago) < totalGeral && (
                  <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 text-center">
                    <p className="text-red-700 text-xs font-bold">Falta R$ {(totalGeral - parseFloat(valorPago)).toFixed(2)}</p>
                  </div>
                )}
              </div>
            )}
            {erroVenda && <p className="mb-3 text-red-700 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{erroVenda}</p>}
            <div className="flex gap-3">
              <button onClick={finalizarVenda}
                disabled={formaPagamento === 'DINHEIRO' && parseFloat(valorPago) < totalGeral && valorPago !== ''}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wide rounded transition-all">
                Confirmar (F10)
              </button>
              <button onClick={() => { setConfirmar(false); setErroVenda(null); }}
                className="flex-1 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded transition-all">
                Cancelar (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOPO — STATUS SCANNER */}
      <header className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📷</span>
          <div>
            <p className="text-xs font-bold text-stone-900">Leitor de Código de Barras</p>
            <p className="text-xs text-stone-500">Aponte o scanner para o produto — ele será adicionado automaticamente</p>
          </div>
        </div>

        {/* Flash feedback do scan */}
        {flashCodigo && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 animate-pulse">
            <span className="text-emerald-700 text-lg">✓</span>
            <span className="text-emerald-700 text-sm font-bold font-mono">{flashCodigo}</span>
          </div>
        )}

        <div className="text-right min-w-24">
          <p className="text-xs text-stone-500 font-medium">Total</p>
          <p className="text-xl font-bold text-stone-900">R$ {totalGeral.toFixed(2)}</p>
        </div>
      </header>

      {/* CORPO */}
      <div className="flex flex-1 overflow-hidden">

        {/* LISTA MANUAL DE PRODUTOS */}
        <section className="w-2/5 flex flex-col border-r border-stone-200" style={{minWidth:0}}>
          <div className="px-4 py-2 border-b border-stone-200 flex-shrink-0 bg-page flex items-center justify-between">
            <p className="text-xs text-stone-500 font-medium">Ou selecione manualmente:</p>
            <button
              onClick={() => setItemDiversosAberto(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-2.5 py-1 rounded-md transition-all active:scale-95 flex items-center gap-1 shadow-sm"
              title="Adicionar item avulso com valor em aberto (Atalho: F9 ou digite 999)">
              <span>🏷️</span>
              <span>+ Diversos (999) [F9]</span>
            </button>
          </div>
          <div className="px-4 py-3 border-b border-stone-200 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">🔍</span>
              <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && busca.trim() === '999') {
                    setBusca('');
                    setItemDiversosAberto(true);
                  }
                }}
                placeholder="Buscar produto ou digite '999' para diversos..."
                className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-9 pr-4 py-2.5 text-stone-900 text-sm focus:outline-none focus:border-brand-500 transition-colors"
              />
              {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 text-lg">×</button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {produtosFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-2">
                <span className="text-4xl">🔍</span>
                <p className="text-xs font-medium">Nenhum produto encontrado</p>
              </div>
            ) : Object.entries(porCategoria).map(([cat, prods]) => (
              <div key={cat}>
                <div className="px-4 py-2 bg-white border-b border-stone-200/50 sticky top-0">
                  <p className="text-xs text-stone-500 font-medium font-bold">{cat}</p>
                </div>
                {prods.map(p => {
                  const isUN = p.unidade === 'UN';
                  const qtd = qtds[p.id] || 1;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-200/40 hover:bg-stone-100/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-stone-900 truncate">{p.nome}</p>
                          {p.codigoBarras && <span className="text-xs text-stone-500 font-mono flex-shrink-0">{p.codigoBarras}</span>}
                        </div>
                        <p className="text-xs text-emerald-700 font-bold mt-0.5">R$ {p.precoVenda.toFixed(2)}/{isUN ? 'un' : 'kg'}</p>
                      </div>
                      {isUN ? (
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <div className="flex items-center bg-stone-100 border border-stone-300 rounded-lg overflow-hidden">
                            <button onClick={() => setQtds(q => ({ ...q, [p.id]: Math.max(1, (q[p.id]||1) - 1) }))} className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors font-bold">−</button>
                            <span className="px-2 text-stone-900 font-bold text-sm min-w-[1.5rem] text-center">{qtd}</span>
                            <button onClick={() => setQtds(q => ({ ...q, [p.id]: (q[p.id]||1) + 1 }))} className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors font-bold">+</button>
                          </div>
                          <button onClick={() => adicionarUN(p)} className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all active:scale-95">
                            + {(p.precoVenda * qtd).toLocaleString('pt-BR', { style:'currency', currency:'BRL' })}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setProdutoKGPendente(p)} className="ml-3 flex-shrink-0 bg-stone-100 border border-stone-300 hover:border-stone-400 text-stone-700 font-bold text-xs px-4 py-2 rounded-lg transition-all active:scale-95">
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
          <div className="px-5 pt-4 pb-3 border-b border-stone-200 flex-shrink-0 flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-700 font-bold">🛒 Cupom</p>
              <p className="text-stone-500 text-xs mt-0.5">{itensCarrinho.length} item(s)</p>
            </div>
            <span className="text-2xl font-bold text-stone-900">R$ {totalGeral.toFixed(2)}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {itensCarrinho.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-3 py-12">
                <span className="text-5xl">📷</span>
                <p className="text-xs font-medium text-center leading-relaxed">Aponte o leitor<br/>para o produto</p>
              </div>
            )}
            {itensCarrinho.map((item, idx) => (
              <div key={item.uid} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between group hover:border-brand-400 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-stone-400 text-xs font-bold w-5 text-center flex-shrink-0">{idx+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-stone-900 truncate leading-tight">{item.nome}</p>
                    <p className="text-sm text-stone-500 mt-0.5">
                      {item.unidade === 'UN' ? `${item.peso} un` : `${item.peso} kg`}
                      <span className="mx-1 text-stone-300">×</span>
                      R$ {parseFloat(item.precoKg).toFixed(2)}/{item.unidade === 'UN' ? 'un' : 'kg'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <span className="text-emerald-700 font-bold text-lg font-mono">R$ {item.total.toFixed(2)}</span>
                  <button onClick={() => removerItem(item.uid)} className="text-stone-300 hover:text-red-600 transition-colors text-2xl leading-none opacity-0 group-hover:opacity-100 w-6 text-center font-light">×</button>
                </div>
              </div>
            ))}
          </div>

          {erroVenda && !confirmar && (
            <div className="mx-4 mb-2 text-xs rounded px-3 py-2 border text-amber-700 bg-amber-50 border-amber-900">{erroVenda}</div>
          )}

          <div className="border-t border-stone-200 p-4 space-y-3 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-stone-600 uppercase text-xs tracking-widest font-bold">Total</span>
              <span className="text-3xl font-bold text-stone-900 font-mono">R$ {totalGeral.toFixed(2)}</span>
            </div>
            <button onClick={() => setConfirmar(true)} disabled={itensCarrinho.length === 0 || salvando}
              className={`w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-200 active:scale-95
                ${vendaFinalizada ? 'bg-emerald-600 text-white'
                : itensCarrinho.length === 0 ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft'}`}>
              {salvando ? 'Registrando...' : vendaFinalizada ? '✓ Venda Registrada!' : 'Finalizar Venda (F10)'}
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setItensCarrinho([]); setErroVenda(null); }} disabled={itensCarrinho.length === 0}
                className="flex-1 py-2 rounded text-xs text-stone-500 hover:text-stone-600 transition-colors disabled:opacity-0">
                Limpar carrinho
              </button>
              {ultimaVendaId && (
                <button onClick={cancelarUltimaVenda} disabled={cancelando}
                  className="flex-1 py-2 rounded text-xs text-red-600 hover:text-red-700 border border-red-200 transition-colors">
                  {cancelando ? 'Cancelando...' : '↩ Cancelar ultima'}
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
