import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const CATEGORIAS_KG = ['Bovino', 'Suino', 'Frango', 'Embutido', 'Outros'];
const CATEGORIAS_UN = ['Espetinho', 'Bebida', 'Porcao', 'Outros'];

const VAZIO = { nome: '', precoVenda: '', precoPromocao: '', custo: '', categoria: 'Bovino', unidade: 'KG', estoqueAtual: '', codigoBarras: '', validade: '' };

const ICONE_CAT = {
  Bovino:'🥩', Suino:'🐷', Frango:'🍗', Embutido:'🌭', Espetinho:'🍢',
  Bebida:'🥤', Porcao:'🍱', Outros:'📦',
};


// Detecta etiqueta EAN-13 de balança e sugere o código curto do produto.
// Toledo/Filizola/Urano usam o prefixo "2" + código produto + valor + verificador.
// Tenta o formato Toledo (6+5, mais comum no BR) e Filizola (5+6).
function detectarBalanca(codigo) {
  if (!codigo || !/^2\d{12}$/.test(codigo)) return null;
  const tentativa6e5 = parseInt(codigo.substring(1, 7), 10).toString();
  const tentativa5e6 = parseInt(codigo.substring(1, 6), 10).toString();
  const valor6e5     = parseInt(codigo.substring(7, 12), 10) / 100;
  return {
    completo: codigo,
    sugerido: tentativa6e5,            // padrão Toledo (mais comum)
    alternativo: tentativa5e6,          // padrão Filizola (menos comum)
    valorReferencia: valor6e5,          // só pra dar contexto
  };
}

function CodigoBarrasField({ value, onChange, unidade, inp, lbl }) {
  const [editando, setEditando] = React.useState(!value);
  const [temp, setTemp]         = React.useState(value || '');
  const inputRef                = React.useRef(null);

  React.useEffect(() => {
    setTemp(value || '');
    setEditando(!value);
  }, [value]);

  const balanca = detectarBalanca(temp);

  const confirmar = (override) => {
    const final = (override !== undefined ? override : temp).trim();
    onChange(final);
    setTemp(final);
    setEditando(false);
  };

  const limpar = () => {
    onChange('');
    setTemp('');
    setEditando(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div>
      <label className={lbl}>
        Código de Barras
        {value && <span className="ml-2 text-xs text-emerald-700 font-bold normal-case">✓ cadastrado</span>}
        {!value && <span className="ml-2 text-xs text-stone-400 normal-case font-normal">(opcional)</span>}
      </label>

      {value && !editando ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <span className="text-lg">📷</span>
            <span className="font-mono font-bold text-emerald-700 text-sm flex-1">{value}</span>
            {unidade === 'KG' && (
              <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">Balança</span>
            )}
          </div>
          <button type="button" onClick={() => { setTemp(value); setEditando(true); setTimeout(() => inputRef.current?.focus(), 100); }}
            className="px-3 py-2.5 rounded-lg border border-stone-300 text-xs text-stone-600 hover:border-brand-500 hover:text-brand-600 transition-all font-bold whitespace-nowrap">
            ✏️ Editar
          </button>
          <button type="button" onClick={limpar}
            className="px-3 py-2.5 rounded-lg border border-stone-300 text-xs text-stone-600 hover:border-red-400 hover:text-red-700 transition-all font-bold">
            ×
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={temp}
              onChange={e => setTemp(e.target.value)}
              className={inp + " flex-1"}
              placeholder={unidade === 'KG' ? 'Ex: 100  (código da balança)' : 'Ex: 7891234567890'}
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') { setTemp(value||''); setEditando(false); } }}
              autoFocus={editando && !!value}
            />
            {temp && !balanca && (
              <button type="button" onClick={() => confirmar()}
                className="px-3 py-2.5 rounded-lg text-xs font-bold text-white transition-all active:scale-95 whitespace-nowrap bg-brand-600 hover:bg-brand-700">
                ✓ Ok
              </button>
            )}
            {value && (
              <button type="button" onClick={() => { setTemp(value); setEditando(false); }}
                className="px-3 py-2.5 rounded-lg border border-stone-300 text-xs text-stone-500 hover:text-stone-700 transition-all">
                ✕
              </button>
            )}
          </div>

          {balanca && (
            <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-lg">📊</span>
                <div className="flex-1 text-xs text-blue-800">
                  <p className="font-bold mb-0.5">Etiqueta de balança detectada!</p>
                  <p className="text-blue-700">
                    Esse código tem o peso embutido (muda a cada pesagem).
                    Use só o <b>código do produto</b> programado na balança:
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => confirmar(balanca.sugerido)}
                  className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all active:scale-95">
                  ✓ Usar <span className="font-mono">{balanca.sugerido}</span>
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">Toledo / mais comum</span>
                </button>
                {balanca.alternativo !== balanca.sugerido && (
                  <button type="button" onClick={() => confirmar(balanca.alternativo)}
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-lg bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 text-xs font-bold transition-all active:scale-95">
                    Usar <span className="font-mono">{balanca.alternativo}</span>
                    <span className="block text-[10px] font-normal text-blue-600 mt-0.5">Filizola</span>
                  </button>
                )}
                <button type="button" onClick={() => confirmar()}
                  className="px-3 py-2 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 text-xs transition-all">
                  Manter completo
                </button>
              </div>
              <p className="text-[10px] text-blue-600 mt-2">
                💡 O valor R$ {balanca.valorReferencia.toFixed(2)} embutido no código se refere ao peso atual,
                não ao preço cadastrado.
              </p>
            </div>
          )}
        </>
      )}
      {unidade === 'KG' && !value && !balanca && (
        <p className="text-xs text-stone-500 mt-1">
          💡 Digite o código curto programado na balança (ex: <span className="font-mono font-bold">100</span> para Alcatra)
        </p>
      )}
    </div>
  );
}

export default function GestaoProdutos() {
  const [produtos, setProdutos]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [modalEstoque, setModalEstoque] = useState(null); // produto selecionado
  const [editando, setEditando]     = useState(null);
  const [form, setForm]             = useState(VAZIO);
  const [salvando, setSalvando]     = useState(false);
  const [erro, setErro]             = useState(null);
  const [busca, setBusca]           = useState('');
  const [qtdAjuste, setQtdAjuste]   = useState('');
  const [opAjuste, setOpAjuste]     = useState('adicionar');
  const [ajustando, setAjustando]   = useState(false);

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await api.get('/produtos'); setProdutos(data); }
    catch { setErro('Erro ao carregar produtos.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  // Abre modal automaticamente se veio do leitor de código de barras
  useEffect(() => {
    const codigo = localStorage.getItem('novoProdutoCodigo');
    if (codigo) {
      localStorage.removeItem('novoProdutoCodigo');
      setTimeout(() => {
        setEditando(null);
        setForm({ ...VAZIO, codigoBarras: codigo });
        setErro(null);
        setModal(true);
      }, 300); // pequeno delay para a tela carregar
    }
  }, []);

  const abrirNovo = () => {
    setEditando(null);
    setForm(VAZIO);
    setErro(null);
    setModal(true);
  };

  const abrirEditar = (p) => {
    setEditando(p.id);
    setForm({
      nome: p.nome,
      precoVenda: p.precoVenda,
      precoPromocao: p.precoPromocao !== undefined && p.precoPromocao !== null ? p.precoPromocao : '',
      custo: p.custo,
      categoria: p.categoria,
      unidade: p.unidade || 'KG',
      estoqueAtual: p.estoqueAtual,
      codigoBarras: p.codigoBarras || '',
      validade: p.validade ? new Date(p.validade).toISOString().split('T')[0] : ''
    });
    setErro(null); setModal(true);
  };

  const salvar = async () => {
    if (!form.nome || !form.precoVenda) return setErro('Nome e preco sao obrigatorios.');
    setSalvando(true); setErro(null);
    try {
      if (editando) await api.put(`/produtos/${editando}`, form);
      else await api.post('/produtos', form);
      setModal(false); carregar();
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  const deletar = async (id) => {
    if (!confirm('Remover este produto?')) return;
    try { await api.delete(`/produtos/${id}`); carregar(); }
    catch { alert('Erro ao remover.'); }
  };

  const ajustarEstoque = async () => {
    if (!qtdAjuste || parseFloat(qtdAjuste) <= 0) return;
    setAjustando(true);
    try {
      await api.patch(`/produtos/${modalEstoque.id}/estoque`, {
        quantidade: parseFloat(qtdAjuste),
        operacao: opAjuste,
      });
      setModalEstoque(null); setQtdAjuste(''); setOpAjuste('adicionar');
      carregar();
    } catch (e) { alert(e.response?.data?.erro || 'Erro ao ajustar.'); }
    finally { setAjustando(false); }
  };

  // Quando muda unidade, muda categoria default
  const setUnidade = (u) => {
    setForm(f => ({
      ...f,
      unidade: u,
      categoria: u === 'UN' ? 'Espetinho' : 'Bovino'
    }));
  };

  const inp = "w-full bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500 transition-colors font-mono";
  const lbl = "block text-xs text-stone-500 font-medium mb-1";

  const filtrar = (lista) => {
    if (!busca.trim()) return lista;
    const b = busca.trim().toLowerCase();
    return lista.filter(p =>
      p.nome.toLowerCase().includes(b) ||
      (p.codigoBarras && p.codigoBarras.toLowerCase().includes(b))
    );
  };

  const produtosKG = filtrar(produtos.filter(p => (p.unidade || 'KG') === 'KG'));
  const produtosUN = filtrar(produtos.filter(p => p.unidade === 'UN'));

  return (
    <div className="min-h-screen bg-page p-6">

      {/* MODAL PRODUTO */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-md shadow-modal">
            <p className="text-xs text-brand-700 font-semibold font-bold mb-5">
              {editando ? 'Editar Produto' : 'Novo Produto'}
            </p>

            {/* Seletor de unidade */}
            <div className="mb-4">
              <label className={lbl}>Tipo de Produto</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setUnidade('KG')}
                  className={`py-3 rounded-lg border-2 text-sm font-bold transition-all
                    ${form.unidade === 'KG' ? 'border-brand-500 bg-brand-500/10 text-amber-700' : 'border-stone-300 text-stone-500 hover:border-stone-400'}`}>
                  🥩 Carne (KG)
                </button>
                <button onClick={() => setUnidade('UN')}
                  className={`py-3 rounded-lg border-2 text-sm font-bold transition-all
                    ${form.unidade === 'UN' ? 'border-blue-400 bg-blue-400/10 text-blue-700' : 'border-stone-300 text-stone-500 hover:border-stone-400'}`}>
                  🍢 Unidade (UN)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className={lbl}>Nome do Produto</label>
                <input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})}
                  className={inp} placeholder={form.unidade === 'UN' ? 'Ex: Espetinho de Frango' : 'Ex: Picanha'} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>
                    {form.unidade === 'UN' ? 'Preço Normal (R$)' : 'Preço Normal (R$/kg)'} *
                  </label>
                  <input type="number" step="0.01" value={form.precoVenda} onChange={e => setForm({...form, precoVenda: e.target.value})}
                    className={inp} placeholder={form.unidade === 'UN' ? '5.00' : '69.90'} />
                </div>
                <div>
                  <label className={lbl}>
                    Preço Promoção (R$)
                    <span className="text-[10px] text-amber-600 block font-normal">(opcional)</span>
                  </label>
                  <input type="number" step="0.01" value={form.precoPromocao} onChange={e => setForm({...form, precoPromocao: e.target.value})}
                    className={inp + " border-amber-300 focus:border-amber-500"} placeholder="0.00" />
                </div>
                <div>
                  <label className={lbl}>Custo (R$)</label>
                  <input type="number" step="0.01" value={form.custo} onChange={e => setForm({...form, custo: e.target.value})}
                    className={inp} placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}
                    className={inp}>
                    {(form.unidade === 'UN' ? CATEGORIAS_UN : CATEGORIAS_KG).map(c =>
                      <option key={c} value={c}>{c}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className={lbl}>
                    {form.unidade === 'UN' ? 'Estoque Inicial (un)' : 'Estoque Inicial (kg)'}
                  </label>
                  <input type="number" value={form.estoqueAtual} onChange={e => setForm({...form, estoqueAtual: e.target.value})}
                    className={inp} placeholder={form.unidade === 'UN' ? '0' : '0.000'} />
                </div>
              </div>

              {/* Código de Barras */}
              <CodigoBarrasField
                value={form.codigoBarras}
                onChange={v => setForm({...form, codigoBarras: v})}
                unidade={form.unidade}
                inp={inp}
                lbl={lbl}
              />

              {/* Validade */}
              <div>
                <label className={lbl}>Validade <span className="text-stone-400 normal-case font-normal">(opcional)</span></label>
                <input type="date" value={form.validade}
                  onChange={e => setForm({...form, validade: e.target.value})}
                  className={inp} />
              </div>

              {/* Info box */}
              <div className={`rounded-lg px-3 py-2.5 text-xs border ${form.unidade === 'UN' ? 'bg-blue-500/5 border-blue-500/20 text-blue-700' : 'bg-brand-600/5 border-brand-600/20 text-amber-700'}`}>
                {form.unidade === 'UN'
                  ? '📦 Produto vendido por unidade. O estoque diminui 1 por venda (ou qtd informada).'
                  : '⚖️ Produto vendido por peso. O estoque vem da desossa e diminui em kg a cada venda.'}
              </div>

              {erro && <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{erro}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={salvar} disabled={salvando}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs font-medium rounded transition-all active:scale-95">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
              <button onClick={() => setModal(false)}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AJUSTE DE ESTOQUE (UN) */}
      {modalEstoque && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white border border-stone-200 rounded-xl p-6 w-full max-w-sm shadow-modal">
            <p className="text-xs text-blue-700 font-medium font-bold mb-1">Ajustar Estoque</p>
            <p className="text-stone-900 font-bold mb-4">{modalEstoque.nome}</p>
            <p className="text-stone-600 text-sm mb-4">
              Estoque atual: <span className="font-bold text-stone-900">{modalEstoque.estoqueAtual} un</span>
            </p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { id: 'adicionar', label: 'Adicionar', cor: 'border-emerald-500 bg-emerald-500/10 text-emerald-700' },
                { id: 'remover',   label: 'Remover',   cor: 'border-red-500 bg-red-500/10 text-red-700' },
                { id: 'definir',   label: 'Definir',   cor: 'border-brand-600 bg-brand-600/10 text-amber-700' },
              ].map(op => (
                <button key={op.id} onClick={() => setOpAjuste(op.id)}
                  className={`py-2 rounded-lg border-2 text-xs font-bold transition-all
                    ${opAjuste === op.id ? op.cor : 'border-stone-300 text-stone-500'}`}>
                  {op.label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className={lbl}>Quantidade (unidades)</label>
              <input type="number" value={qtdAjuste} onChange={e => setQtdAjuste(e.target.value)}
                autoFocus min="0"
                className={inp} placeholder="0"
                onKeyDown={e => e.key === 'Enter' && ajustarEstoque()} />
            </div>

            {qtdAjuste && (
              <div className="bg-stone-100 rounded px-3 py-2 text-xs mb-4">
                <span className="text-stone-600">Resultado: </span>
                <span className="text-stone-900 font-bold">
                  {opAjuste === 'adicionar' ? modalEstoque.estoqueAtual + parseFloat(qtdAjuste || 0)
                  : opAjuste === 'remover' ? Math.max(0, modalEstoque.estoqueAtual - parseFloat(qtdAjuste || 0))
                  : parseFloat(qtdAjuste || 0)} un
                </span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={ajustarEstoque} disabled={ajustando}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-stone-900 font-bold text-xs font-medium rounded transition-all active:scale-95">
                {ajustando ? 'Salvando...' : 'Confirmar'}
              </button>
              <button onClick={() => { setModalEstoque(null); setQtdAjuste(''); setOpAjuste('adicionar'); }}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Produtos e Precos</h1>
          <p className="text-xs text-stone-500 mt-0.5">{produtosKG.length} carne(s) · {produtosUN.length} unidade(s)</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Campo de busca */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por nome ou código..."
              className="pl-8 pr-4 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-amber-500 text-stone-700 w-56 transition-colors"
            />
            {busca && (
              <button onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-sm font-bold">
                ×
              </button>
            )}
          </div>
          <button onClick={abrirNovo}
            className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded transition-all active:scale-95">
            + Novo Produto
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-stone-500">
          <span className="animate-pulse text-sm">Carregando...</span>
        </div>
      ) : produtos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-600 gap-3">
          <span className="text-4xl">🥩</span>
          <p className="text-sm font-bold">Nenhum produto cadastrado</p>
          <button onClick={abrirNovo}
            className="mt-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2.5 rounded">
            + Cadastrar primeiro produto
          </button>
        </div>
      ) : produtosKG.length === 0 && produtosUN.length === 0 && busca ? (
        <div className="flex flex-col items-center justify-center py-24 text-stone-600 gap-3">
          <span className="text-4xl">🔍</span>
          <p className="text-sm font-bold">Nenhum produto encontrado para "{busca}"</p>
          <button onClick={() => setBusca('')} className="text-xs text-amber-700 underline">Limpar busca</button>
        </div>
      ) : (
        <div className="space-y-6">

          {/* CARNES (KG) */}
          {produtosKG.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🥩</span>
                <p className="text-xs text-stone-500 font-medium font-bold">Carnes — vendidos por KG</p>
                <span className="text-xs bg-brand-600/10 text-amber-700 border border-brand-600/20 px-2 py-0.5 rounded">{produtosKG.length}</span>
              </div>
              <TabelaProdutos
                produtos={produtosKG}
                unidade="KG"
                onEditar={abrirEditar}
                onDeletar={deletar}
                onAjustarEstoque={null}
              />
            </div>
          )}

          {/* UNIDADES (UN) */}
          {produtosUN.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🍢</span>
                <p className="text-xs text-stone-500 font-medium font-bold">Espetinhos e Bebidas — vendidos por Unidade</p>
                <span className="text-xs bg-blue-500/10 text-blue-700 border border-blue-500/20 px-2 py-0.5 rounded">{produtosUN.length}</span>
              </div>
              <TabelaProdutos
                produtos={produtosUN}
                unidade="UN"
                onEditar={abrirEditar}
                onDeletar={deletar}
                onAjustarEstoque={(p) => { setModalEstoque(p); setQtdAjuste(''); setOpAjuste('adicionar'); }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TabelaProdutos({ produtos, unidade, onEditar, onDeletar, onAjustarEstoque }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead><tr className="border-b border-stone-200">
          {['Produto', 'Categoria', unidade === 'UN' ? 'Preco/un' : 'Preco/kg', 'Custo', 'Margem', 'Estoque', ''].map((h, i) => (
            <th key={i} className={`text-xs text-stone-500 font-medium py-3 px-4 font-normal ${i < 2 ? 'text-left' : 'text-right'} last:text-center`}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {produtos.map(p => {
            const margem = p.precoVenda > 0 ? (((p.precoVenda - p.custo) / p.precoVenda) * 100).toFixed(1) : '0.0';
            const ok = parseFloat(margem) >= 35;
            const estoqueBaixo = unidade === 'UN' ? p.estoqueAtual <= 5 : false;
            return (
              <tr key={p.id} className="border-b border-stone-200/50 hover:bg-stone-100/30 transition-colors group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span>{unidade === 'UN' ? (p.categoria === 'Bebida' ? '🥤' : '🍢') : '🥩'}</span>
                    <div>
                      <span className="text-sm font-bold text-stone-900">{p.nome}</span>
                      {p.codigoBarras && <span className="ml-2 text-xs text-stone-500 font-mono bg-stone-100 px-1.5 py-0.5 rounded">{p.codigoBarras}</span>}
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 text-xs text-stone-600">{p.categoria}</td>
                <td className="py-3 px-4 text-sm text-right">
                  {p.precoPromocao && p.precoPromocao > 0 ? (
                    <div>
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-[10px] bg-amber-500/15 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">🔥 Promo</span>
                        <span className="text-amber-700 font-bold font-mono">R$ {p.precoPromocao.toFixed(2)}</span>
                      </div>
                      <span className="text-[11px] text-stone-400 line-through block font-mono">R$ {p.precoVenda.toFixed(2)}</span>
                    </div>
                  ) : (
                    <span className="text-emerald-700 font-bold font-mono">R$ {p.precoVenda.toFixed(2)}</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-stone-600 text-right">R$ {p.custo.toFixed(2)}</td>
                <td className="py-3 px-4 text-right">
                  <span className={`text-xs px-2 py-1 rounded font-bold ${ok ? 'bg-emerald-400/10 text-emerald-700' : 'bg-red-400/10 text-red-700'}`}>
                    {margem}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className={`font-bold font-mono ${estoqueBaixo ? 'text-red-700' : 'text-stone-900'}`}>
                    {unidade === 'UN' ? `${p.estoqueAtual} un` : `${p.estoqueAtual.toFixed(3)} kg`}
                  </span>
                  {estoqueBaixo && <span className="ml-1 text-xs text-red-700">⚠</span>}
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {onAjustarEstoque && (
                      <button onClick={() => onAjustarEstoque(p)}
                        className="text-xs text-blue-700 hover:text-blue-800 px-2 py-1 rounded border border-blue-700 hover:border-blue-400 transition-colors">
                        +/- Estoque
                      </button>
                    )}
                    <button onClick={() => onEditar(p)}
                      className="text-xs text-stone-600 hover:text-amber-700 px-2 py-1 rounded border border-stone-300 hover:border-brand-600 transition-colors">
                      Editar
                    </button>
                    <button onClick={() => onDeletar(p.id)}
                      className="text-xs text-stone-600 hover:text-red-700 px-2 py-1 rounded border border-stone-300 hover:border-red-500 transition-colors">
                      ×
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
