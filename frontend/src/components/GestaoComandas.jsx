import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FORMAS = [
  { id: 'DINHEIRO', label: 'Dinheiro', icon: '💵' },
  { id: 'PIX',      label: 'PIX',      icon: '📱' },
  { id: 'DEBITO',   label: 'Debito',   icon: '💳' },
  { id: 'CREDITO',  label: 'Credito',  icon: '💳' },
];

const formatarData = (isoStr) => {
  if (!isoStr) return '--/--/----';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--/--/----';
  return d.toLocaleDateString('pt-BR');
};

const formatarHora = (isoStr) => {
  if (!isoStr) return '--:--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatarDataHora = (isoStr) => {
  if (!isoStr) return '--/-- às --:--';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '--/-- às --:--';
  return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
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

  const inp = 'w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-sm focus:outline-none focus:border-brand-500 font-mono transition-colors';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-white border border-stone-200 rounded-2xl p-8 w-full max-w-sm shadow-modal">
        <p className="text-base text-stone-900 font-bold mb-1">Nova Comanda</p>
        <p className="text-xs text-stone-500 mb-6">Informe o nome do cliente para abrir a comanda</p>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-stone-500 font-medium mb-1.5">Nome do Cliente</label>
            <input value={nome} onChange={e => setNome(e.target.value)} autoFocus className={inp} placeholder="Ex: Joao Silva" onKeyDown={e => e.key === 'Enter' && salvar()} />
          </div>
          {erro && <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={salvar} disabled={busy} className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition-all active:scale-95 shadow-sm">
            {busy ? 'Criando...' : '+ Abrir Comanda'}
          </button>
          <button onClick={onFechar} className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-lg transition-all">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL FECHAR COMANDA ─────────────────────────────────────────────────────
function ModalFecharComanda({ comanda, onFechado, onCancelar }) {
  const [forma, setForma]     = useState('DINHEIRO');
  const [valorPago, setValorPago] = useState('');
  const [busy, setBusy]       = useState(false);
  const [erro, setErro]       = useState(null);

  const troco = forma === 'DINHEIRO' && parseFloat(valorPago) > comanda.total
    ? parseFloat(valorPago) - comanda.total : 0;

  const fechar = async () => {
    if (forma === 'DINHEIRO' && parseFloat(valorPago) < comanda.total && valorPago !== '')
      return setErro('Valor pago insuficiente.');
    setBusy(true); setErro(null);
    try {
      await api.post(`/comandas/${comanda.id}/fechar`, { formaPagamento: forma, valorPago: parseFloat(valorPago) || comanda.total });
      onFechado();
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao fechar.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm">
      <div className="bg-white border border-stone-300 rounded-2xl p-7 w-full max-w-md shadow-2xl">
        <p className="text-xs text-brand-700 font-semibold font-bold mb-1">Fechar Comanda</p>
        <p className="text-stone-600 text-sm mb-5">{comanda.nomeCliente} — Aberta em {formatarData(comanda.criadaEm)}</p>
        <div className="bg-stone-100 rounded-xl px-5 py-4 flex justify-between items-center mb-5">
          <span className="text-stone-600 text-sm">Total</span>
          <span className="text-3xl font-bold text-stone-900">{fmt(comanda.total)}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {FORMAS.map(f => (
            <button key={f.id} onClick={() => { setForma(f.id); if (f.id !== 'DINHEIRO') setValorPago(''); }}
              className={`flex flex-col items-center py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all ${forma === f.id ? 'border-brand-500 bg-brand-500/10 text-amber-700' : 'border-stone-300 text-stone-500 hover:border-stone-400'}`}>
              <span className="text-xl mb-1">{f.icon}</span>{f.label}
            </button>
          ))}
        </div>
        {forma === 'DINHEIRO' && (
          <div className="mb-4 space-y-3">
            <div>
              <label className="block text-xs text-stone-500 font-medium mb-1.5">Valor Recebido</label>
              <input type="number" value={valorPago} onChange={e => setValorPago(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-xl font-bold font-mono focus:outline-none focus:border-brand-500 text-right"
                placeholder={comanda.total.toFixed(2)} autoFocus onKeyDown={e => e.key === 'Enter' && fechar()} />
            </div>
            {troco > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex justify-between items-center">
                <span className="text-emerald-700 text-xs font-semibold">Troco</span>
                <span className="text-emerald-700 text-2xl font-bold">{fmt(troco)}</span>
              </div>
            )}
            {parseFloat(valorPago) > 0 && parseFloat(valorPago) < comanda.total && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2 text-center">
                <p className="text-red-700 text-xs font-bold">Falta {fmt(comanda.total - parseFloat(valorPago))}</p>
              </div>
            )}
          </div>
        )}
        {erro && <p className="mb-3 text-red-700 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}
        <div className="flex gap-3">
          <button onClick={fechar} disabled={busy} className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-stone-900 font-bold text-sm uppercase tracking-wide rounded-xl transition-all active:scale-95">
            {busy ? 'Fechando...' : '✓ Fechar e Cobrar'}
          </button>
          <button onClick={onCancelar} className="flex-1 py-3.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm rounded-xl transition-all">Voltar</button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL DE PESO PARA PRODUTOS KG ───────────────────────────────────────────
function ModalPesoKG({ produto, pesoInicial, onConfirmar, onCancelar }) {
  const [peso, setPeso] = useState(pesoInicial ? String(pesoInicial) : '');
  const inputRef = useRef(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); inputRef.current?.select(); }, []);

  const confirmar = () => {
    const p = parseFloat(String(peso).replace(',', '.'));
    if (!p || p <= 0) return;
    onConfirmar(p);
  };

  const valorCalc = parseFloat(String(peso).replace(',', '.')) * produto.precoVenda;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
      <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-sm shadow-xl">
        <p className="text-xs text-stone-500 font-medium mb-1">Informe o peso</p>
        <p className="text-lg font-bold text-stone-900 mb-1">{produto.nome}</p>
        <p className="text-sm text-emerald-700 mb-5">{fmt(produto.precoVenda)}/kg</p>
        <label className="block text-xs text-stone-500 font-medium mb-1.5">Peso (kg)</label>
        <input
          ref={inputRef}
          type="number" step="0.001" value={peso}
          onChange={e => setPeso(e.target.value)}
          placeholder="0.000"
          className="w-full bg-stone-100 border border-stone-300 rounded-lg px-4 py-3 text-stone-900 text-2xl font-bold font-mono focus:outline-none focus:border-amber-500 text-right mb-2"
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') onCancelar(); }}
        />
        {valorCalc > 0 && (
          <p className="text-right text-emerald-700 text-sm font-bold mb-4">= {fmt(valorCalc)}</p>
        )}
        <div className="flex gap-3 mt-3">
          <button onClick={confirmar} disabled={!peso || parseFloat(String(peso).replace(',','.')) <= 0}
            className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wide rounded-lg transition-all active:scale-95">
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

// ─── VISÃO INTERNA DA MESA ────────────────────────────────────────────────────
function VisaoMesa({ comanda: inicial, produtos, vendidosCount, onVoltar, onFechada }) {
  const [comanda, setComanda]     = useState(inicial);
  const [adicionando, setAdicionando] = useState(null);
  const [removendo, setRemovendo] = useState(null);
  const [modalFechar, setModalFechar] = useState(false);
  const [busca, setBusca]         = useState('');
  const [qtds, setQtds]           = useState({});
  const [pesoKG, setPesoKG]       = useState(null);
  const [flashCodigo, setFlashCodigo] = useState(null);
  const [erro, setErro]           = useState(null);
  const buscaRef = useRef(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef(null);

  useEffect(() => { buscaRef.current?.focus(); }, []);

  const recarregar = async () => {
    try { const { data } = await api.get(`/comandas/${comanda.id}`); setComanda(data); } catch {}
  };

  // Filtra produtos pela busca (nome, categoria, código)
  const produtosFiltrados = busca.trim()
    ? produtos.filter(p =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        (p.codigoBarras && p.codigoBarras.includes(busca))
      )
    : produtos;

  // Ordena por mais vendidos depois agrupa por categoria
  const produtosOrdenados = [...produtosFiltrados].sort((a, b) => (vendidosCount[b.id] || 0) - (vendidosCount[a.id] || 0));
  const porCategoria = {};
  for (const p of produtosOrdenados) {
    if (!porCategoria[p.categoria]) porCategoria[p.categoria] = [];
    porCategoria[p.categoria].push(p);
  }

  const adicionarItem = async (produto, quantidade) => {
    setAdicionando(produto.id);
    setErro(null);
    try {
      const { data } = await api.post(`/comandas/${comanda.id}/itens`, { produtoId: produto.id, pesoKg: quantidade });
      setComanda(data);
      setQtds(q => ({ ...q, [produto.id]: 1 }));
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao adicionar.'); }
    finally { setAdicionando(null); }
  };

  const removerItem = async (itemId) => {
    setRemovendo(itemId);
    try { await api.delete(`/comandas/${comanda.id}/itens/${itemId}`); await recarregar(); }
    catch (e) { setErro(e.response?.data?.erro || 'Erro ao remover.'); }
    finally { setRemovendo(null); }
  };

  // ── Scanner ─────────────────────────────────────────────────
  const processarCodigo = useCallback(async (codigo) => {
    if (!codigo || codigo.length < 3) return;
    setFlashCodigo(codigo);
    setTimeout(() => setFlashCodigo(null), 1500);
    try {
      const { data: produto } = await api.get(`/produtos/barcode/${codigo}`);
      if (produto.balancaInfo && produto.unidade === 'KG' && produto.balancaInfo.pesoCalculado) {
        await adicionarItem(produto, produto.balancaInfo.pesoCalculado);
        return;
      }
      if (produto.unidade === 'KG') { setPesoKG({ produto }); return; }
      await adicionarItem(produto, 1);
    } catch (e) {
      if (e.response?.status === 404) setErro('Produto não encontrado.');
      else setErro('Erro ao buscar produto.');
    }
  }, [comanda.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
    return () => { window.removeEventListener('keydown', handleKeyDown); clearTimeout(barcodeTimer.current); };
  }, [processarCodigo]);

  return (
    <div className="flex flex-col h-screen bg-page font-mono overflow-hidden">
      {modalFechar && (
        <ModalFecharComanda comanda={comanda} onFechado={() => { setModalFechar(false); onFechada(); }} onCancelar={() => setModalFechar(false)} />
      )}

      {pesoKG && (
        <ModalPesoKG
          produto={pesoKG.produto}
          pesoInicial={pesoKG.pesoInicial}
          onConfirmar={async (peso) => { await adicionarItem(pesoKG.produto, peso); setPesoKG(null); }}
          onCancelar={() => setPesoKG(null)}
        />
      )}

      {/* TOPO — STATUS SCANNER + INFO COMANDA */}
      <header className="bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between flex-shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} className="text-stone-500 hover:text-amber-700 transition-colors text-2xl leading-none font-bold mr-1">←</button>
          <span className="text-2xl">📷</span>
          <div>
            <p className="text-xs font-bold text-stone-900">Leitor de Código de Barras</p>
            <p className="text-xs text-stone-500">Aponte o scanner para o produto — ele será adicionado automaticamente</p>
          </div>
        </div>

        {flashCodigo && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2 animate-pulse">
            <span className="text-emerald-700 text-lg">✓</span>
            <span className="text-emerald-700 text-sm font-bold font-mono">{flashCodigo}</span>
          </div>
        )}

        <div className="text-right min-w-24">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1 mb-1">
            <p className="text-xs text-amber-900 font-bold leading-tight">{comanda.nomeCliente}</p>
            <p className="text-[10px] text-amber-700">Aberta em {formatarData(comanda.criadaEm)}</p>
          </div>
          <p className="text-xs text-stone-500 font-medium">Total</p>
          <p className="text-xl font-bold text-stone-900">{fmt(comanda.total)}</p>
        </div>
      </header>

      {/* CORPO */}
      <div className="flex flex-1 overflow-hidden">

        {/* LISTA MANUAL DE PRODUTOS */}
        <section className="w-2/5 flex flex-col border-r border-stone-200" style={{minWidth:0}}>
          <div className="px-4 py-2 border-b border-stone-200 flex-shrink-0 bg-page">
            <p className="text-xs text-stone-500 font-medium">Ou selecione manualmente:</p>
          </div>
          <div className="px-4 py-3 border-b border-stone-200 flex-shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">🔍</span>
              <input ref={buscaRef} value={busca} onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, categoria ou código..."
                className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-9 pr-4 py-2.5 text-stone-900 text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
              {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-700 text-lg">×</button>}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {produtosOrdenados.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-2">
                <span className="text-4xl">🔍</span>
                <p className="text-xs font-medium">Nenhum produto encontrado</p>
              </div>
            ) : Object.entries(porCategoria).map(([cat, prods]) => (
              <div key={cat}>
                <div className="px-4 py-2 bg-white border-b border-stone-200/50 sticky top-0">
                  <p className="text-xs text-stone-500 font-bold">{cat}</p>
                </div>
                {prods.map(p => {
                  const isUN = p.unidade === 'UN';
                  const qtd = qtds[p.id] || 1;
                  const ocupado = adicionando === p.id;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b border-stone-200/40 hover:bg-stone-100/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-stone-900 truncate">{p.nome}</p>
                          {p.codigoBarras && <span className="text-xs text-stone-500 font-mono flex-shrink-0">{p.codigoBarras}</span>}
                        </div>
                        <p className="text-xs text-emerald-700 font-bold mt-0.5">{fmt(p.precoVenda)}/{isUN ? 'un' : 'kg'}</p>
                      </div>
                      {isUN ? (
                        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                          <div className="flex items-center bg-stone-100 border border-stone-300 rounded-lg overflow-hidden">
                            <button onClick={() => setQtds(q => ({ ...q, [p.id]: Math.max(1, (q[p.id]||1) - 1) }))} className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors font-bold">−</button>
                            <span className="px-2 text-stone-900 font-bold text-sm min-w-[1.5rem] text-center">{qtd}</span>
                            <button onClick={() => setQtds(q => ({ ...q, [p.id]: (q[p.id]||1) + 1 }))} className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200 transition-colors font-bold">+</button>
                          </div>
                          <button onClick={() => adicionarItem(p, qtd)} disabled={ocupado} className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all active:scale-95">
                            {ocupado ? '...' : `+ ${fmt(p.precoVenda * qtd)}`}
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setPesoKG({ produto: p })} className="ml-3 flex-shrink-0 bg-stone-100 border border-stone-300 hover:border-stone-400 text-stone-700 font-bold text-xs px-4 py-2 rounded-lg transition-all active:scale-95">
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

        {/* CUPOM / COMANDA */}
        <section className="w-3/5 flex flex-col bg-white">
          <div className="px-5 pt-4 pb-3 border-b border-stone-200 flex-shrink-0 flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-700 font-bold">🛒 Comanda</p>
              <p className="text-stone-500 text-xs mt-0.5">{comanda.itens?.length || 0} item(s)</p>
            </div>
            <span className="text-2xl font-bold text-stone-900">{fmt(comanda.total)}</span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            {(!comanda.itens || comanda.itens.length === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-3 py-12">
                <span className="text-5xl">📷</span>
                <p className="text-xs font-medium text-center leading-relaxed">Aponte o leitor<br/>para o produto</p>
              </div>
            ) : comanda.itens.map((item, idx) => {
              const prod = produtos.find(p => p.id === item.produtoId);
              const isKG = prod?.unidade === 'KG';
              return (
                <div key={item.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex items-center justify-between group hover:border-amber-400 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-stone-400 text-xs font-bold w-5 text-center flex-shrink-0">{idx+1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-base font-bold text-stone-900 leading-tight">{item.nome}</span>
                        {item.criadoEm && (
                          <span className="text-[11px] font-normal text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded leading-none flex-shrink-0" title={`Incluso em ${formatarData(item.criadoEm)}`}>
                            {formatarData(item.criadoEm)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-stone-500 mt-0.5">
                        {isKG ? `${parseFloat(item.pesoKg).toFixed(3)} kg` : `${parseFloat(item.pesoKg)} un`}
                        <span className="mx-1 text-stone-300">×</span>
                        {fmt(item.precoKg)}/{isKG ? 'kg' : 'un'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <span className="text-emerald-700 font-bold text-lg font-mono">{fmt(item.total)}</span>
                    <button onClick={() => removerItem(item.id)} disabled={removendo === item.id} className="text-stone-300 hover:text-red-600 transition-colors text-2xl leading-none opacity-0 group-hover:opacity-100 w-6 text-center font-light">
                      {removendo === item.id ? '…' : '×'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {erro && (
            <div className="mx-4 mb-2 text-xs rounded px-3 py-2 border text-amber-700 bg-amber-50 border-amber-200">{erro}</div>
          )}

          <div className="border-t border-stone-200 p-4 space-y-3 flex-shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-stone-600 uppercase text-xs tracking-widest font-bold">Total</span>
              <span className="text-3xl font-bold text-stone-900 font-mono">{fmt(comanda.total)}</span>
            </div>
            <button onClick={() => setModalFechar(true)} disabled={!comanda.itens?.length}
              className={`w-full py-4 rounded-lg font-bold text-sm uppercase tracking-wide transition-all duration-200 active:scale-95
                ${!comanda.itens?.length ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
              💰 Fechar e Cobrar
            </button>
            <div className="flex gap-2">
              <button onClick={async () => {
                const msg = comanda.itens?.length
                  ? `Cancelar esta comanda?\n\n${comanda.itens.length} item(s) — ${fmt(comanda.total)}\n\nA comanda sera removida sem cobrar e o estoque sera devolvido.`
                  : 'Cancelar esta comanda vazia?';
                if (!confirm(msg)) return;
                try {
                  await api.post(`/comandas/${comanda.id}/cancelar`);
                  onFechada();
                } catch (e) {
                  alert(e.response?.data?.erro || 'Erro ao cancelar comanda.');
                }
              }} className="flex-1 py-2.5 text-xs font-bold rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors">
                × Cancelar Comanda
              </button>
              <button onClick={recarregar} className="flex-1 py-2.5 text-xs text-stone-500 hover:text-stone-700 transition-colors border border-stone-200 rounded-lg">
                ↻ Atualizar
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── VISÃO PRINCIPAL — GRID DE MESAS ─────────────────────────────────────────
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

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resC, resP] = await Promise.all([api.get('/comandas'), api.get('/produtos')]);
      setComandas(resC.data);
      setProdutos(resP.data);

      // Conta quantas vezes cada produto foi vendido nas comandas abertas
      const contagem = {};
      for (const c of resC.data) {
        for (const item of (c.itens || [])) {
          if (item.produtoId) contagem[item.produtoId] = (contagem[item.produtoId] || 0) + parseFloat(item.pesoKg);
        }
      }
      setVendidosCount(contagem);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    if (mesaAberta) return;
    const interval = setInterval(() => carregar(), 15000);
    return () => clearInterval(interval);
  }, [mesaAberta, carregar]);

  const abrirMesa = async (comanda) => {
    try { const { data } = await api.get(`/comandas/${comanda.id}`); setMesaAberta(data); } catch {}
  };

  const onCriarComanda = (nova) => { setModalNova(false); setMesaAberta(nova); carregar(); };

  const cancelarComanda = async (comanda) => {
    const qntItens = comanda.itens?.length || 0;
    const msg = qntItens > 0
      ? `Cancelar a comanda de ${comanda.nomeCliente}?\n\n${qntItens} item(s) — ${fmt(comanda.total)}\n\nA comanda sera removida sem cobrar e o estoque sera devolvido.`
      : `Cancelar a comanda vazia de ${comanda.nomeCliente}?`;
    if (!confirm(msg)) return;
    setCancelandoId(comanda.id);
    try {
      await api.post(`/comandas/${comanda.id}/cancelar`);
      await carregar();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar comanda.');
    } finally { setCancelandoId(null); }
  };

  const comandasOrdenadas = [...comandas].sort((a, b) => {
    const ta = new Date(a.criadaEm).getTime();
    const tb = new Date(b.criadaEm).getTime();
    return ordemData === 'desc' ? tb - ta : ta - tb;
  });

  if (mesaAberta) {
    return (
      <VisaoMesa
        comanda={mesaAberta}
        produtos={produtos}
        vendidosCount={vendidosCount}
        onVoltar={() => { setMesaAberta(null); carregar(); }}
        onFechada={() => { setMesaAberta(null); carregar(); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-page text-stone-900">
      {modalNova && <ModalNovaComanda onCriar={onCriarComanda} onFechar={() => setModalNova(false)} />}

      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Comandas</h1>
          <p className="text-xs text-stone-500 mt-0.5">{comandas.length} comanda(s) aberta(s)</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOrdemData(prev => prev === 'asc' ? 'desc' : 'asc')}
            title="Alternar ordem de exibição por data"
            className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 hover:border-stone-400 px-3 py-2.5 rounded-lg transition-all bg-stone-50 hover:bg-stone-100"
          >
            <span>{ordemData === 'asc' ? '⏳ Mais antigas 1º' : '⚡ Mais recentes 1º'}</span>
          </button>
          <button onClick={carregar} className="text-xs text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 px-4 py-2.5 rounded-lg transition-all" title="Atualizar">↻</button>
          <button onClick={() => navigate('/assados')}
            className="bg-amber-600 hover:bg-amber-500 active:scale-95 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all">
            🔥 Assados
          </button>
          <button onClick={() => setModalNova(true)} className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-all ">
            + Nova Comanda
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-32 text-stone-600"><span className="animate-pulse text-sm">Carregando...</span></div>
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
                      <p className="text-xs text-stone-500 font-medium mb-1">Cliente</p>
                      <p className="text-sm font-bold text-stone-900 leading-tight line-clamp-2 group-hover:text-amber-700 transition-colors">{c.nomeCliente}</p>
                    </div>
                    {temItens && (
                      <div className="text-center py-1">
                        <p className="text-lg font-bold text-emerald-700 leading-none">{fmt(c.total)}</p>
                        <p className="text-xs text-stone-500 mt-1">{c.itens.length} item(s)</p>
                      </div>
                    )}
                    <div className="flex items-end justify-between pt-2 border-t border-stone-200/60">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-stone-400 font-semibold mb-0.5">Aberta em</p>
                        <p className="text-sm font-bold text-stone-800 leading-tight">
                          {formatarData(c.criadaEm)}
                        </p>
                      </div>
                      <span className="text-stone-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all text-sm font-bold">→</span>
                    </div>
                  </button>

                  {/* Botão X de cancelar (aparece no hover) */}
                  <button
                    onClick={(e) => { e.stopPropagation(); cancelarComanda(c); }}
                    disabled={ocupado}
                    title="Cancelar comanda (não cobra, devolve estoque)"
                    className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white text-base font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 flex items-center justify-center z-10">
                    {ocupado ? '…' : '×'}
                  </button>
                </div>
              );
            })}
            <button onClick={() => setModalNova(true)}
              className="aspect-square flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 hover:border-brand-600/50 hover:bg-brand-600/5 text-stone-600 hover:text-amber-500 transition-all duration-200 hover:scale-105 active:scale-95 gap-2">
              <span className="text-4xl font-thin">+</span>
              <span className="text-xs font-semibold">Nova Comanda</span>
            </button>
          </div>
        )}
        {!loading && comandas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-stone-600 gap-4 -mt-4">
            <span className="text-6xl">📋</span>
            <p className="text-sm font-bold">Nenhuma comanda aberta</p>
            <button onClick={() => setModalNova(true)} className="mt-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-3 rounded-lg transition-all active:scale-95">+ Abrir Primeira Comanda</button>
          </div>
        )}
      </div>
    </div>
  );
}
