import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';

const fmt  = v  => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dias  = d  => { const diff = Math.floor((Date.now() - new Date(d)) / 86400000); return diff === 0 ? 'hoje' : diff === 1 ? 'ontem' : `${diff} dias atrás`; };

const inp = { width: '100%', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', color: '#1E293B', outline: 'none', fontFamily: 'inherit' };
const lbl = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px' };

// ─── MODAL: CADASTRO/EDIÇÃO DE FORNECEDOR ────────────────────
function ModalFornecedor({ fornecedor, onSalvar, onFechar }) {
  const [form, setForm]     = useState(fornecedor || { nome: '', cnpj: '', vendedor: '', telefone: '', prazoPagamento: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]     = useState(null);

  const salvar = async () => {
    if (!form.nome.trim()) { setErro('Informe o nome.'); return; }
    setSalvando(true); setErro(null);
    try {
      if (fornecedor?.id) await api.patch(`/fornecedores/${fornecedor.id}`, form);
      else                await api.post('/fornecedores', form);
      onSalvar();
    } catch (e) { setErro(e.response?.data?.erro || 'Erro ao salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>{fornecedor?.id ? 'Editar Fornecedor' : 'Novo Fornecedor'}</p>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Nome *</label><input style={inp} value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Frigorífico XYZ" /></div>
          <div><label style={lbl}>CNPJ</label><input style={inp} value={form.cnpj || ''} onChange={e => setForm({ ...form, cnpj: e.target.value })} /></div>
          <div><label style={lbl}>Telefone</label><input style={inp} value={form.telefone || ''} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(44) 99999-0000" /></div>
          <div><label style={lbl}>Vendedor</label><input style={inp} value={form.vendedor || ''} onChange={e => setForm({ ...form, vendedor: e.target.value })} /></div>
          <div><label style={lbl}>Prazo Pagamento</label><input style={inp} value={form.prazoPagamento || ''} onChange={e => setForm({ ...form, prazoPagamento: e.target.value })} placeholder="30 dias" /></div>
          <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Observações</label><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={form.observacoes || ''} onChange={e => setForm({ ...form, observacoes: e.target.value })} /></div>
          {erro && <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '13px', fontWeight: 600 }}>❌ {erro}</div>}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ padding: '10px 20px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ padding: '10px 24px', background: '#D97706', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', opacity: salvando ? 0.5 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: TABELA DE PREÇOS DO FORNECEDOR ───────────────────
function ModalPrecos({ fornecedor, produtos, onFechar }) {
  const [precos, setPrecos]         = useState([]);
  const [editando, setEditando]     = useState({});
  const [novoProdutoId, setNovoProdutoId] = useState('');
  const [novoPreco, setNovoPreco]   = useState('');
  const [novaUnidade, setNovaUnidade] = useState('KG');

  const carregar = async () => {
    const { data } = await api.get(`/fornecedores/${fornecedor.id}/precos`);
    setPrecos(data);
  };
  useEffect(() => { carregar(); }, []);

  const salvarPreco = async (produtoId, preco, unidade) => {
    if (!preco || preco <= 0) return;
    await api.post(`/fornecedores/${fornecedor.id}/precos`, { produtoId, preco, unidade });
    setEditando({});
    carregar();
  };

  const adicionar = async () => {
    if (!novoProdutoId || !novoPreco) return;
    await salvarPreco(parseInt(novoProdutoId), parseFloat(novoPreco), novaUnidade);
    setNovoProdutoId(''); setNovoPreco(''); setNovaUnidade('KG');
  };

  const remover = async (precoId) => {
    if (!confirm('Remover este produto?')) return;
    await api.delete(`/fornecedores/precos/${precoId}`);
    carregar();
  };

  const disponiveis = produtos.filter(p => !precos.some(pr => pr.produtoId === p.id));
  const inpSm = { background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '7px', padding: '7px 10px', fontSize: '13px', color: '#1E293B', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>Tabela de Preços</p>
            <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>{fornecedor.nome}</p>
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Adicionar novo produto */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', marginBottom: '16px', display: 'grid', gridTemplateColumns: '2fr 80px 1fr auto', gap: '10px', alignItems: 'end' }}>
            <div>
              <label style={{ ...lbl }}>+ Adicionar Produto</label>
              <select style={inpSm} value={novoProdutoId} onChange={e => setNovoProdutoId(e.target.value)}>
                <option value="">Selecione...</option>
                {disponiveis.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ ...lbl }}>Un.</label>
              <select style={inpSm} value={novaUnidade} onChange={e => setNovaUnidade(e.target.value)}>
                <option value="KG">kg</option>
                <option value="UN">un</option>
              </select>
            </div>
            <div>
              <label style={{ ...lbl }}>Preço (R$)</label>
              <input style={inpSm} type="number" step="0.01" value={novoPreco} onChange={e => setNovoPreco(e.target.value)} placeholder="0,00" />
            </div>
            <button onClick={adicionar} disabled={!novoProdutoId || !novoPreco}
              style={{ padding: '8px 18px', background: '#D97706', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'white', opacity: (!novoProdutoId || !novoPreco) ? 0.4 : 1 }}>
              Adicionar
            </button>
          </div>

          {precos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8', fontSize: '13px' }}>Nenhum produto cadastrado ainda.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Produto', 'Un.', 'Preço', 'Atualizado', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {precos.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{p.produto.nome}</td>
                    <td style={{ padding: '10px 12px', color: '#64748B', fontSize: '13px' }}>{p.unidade === 'KG' ? 'kg' : 'un'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {editando[p.id] !== undefined ? (
                        <input style={{ ...inpSm, width: '100px' }} type="number" step="0.01" value={editando[p.id]} autoFocus
                          onChange={e => setEditando({ ...editando, [p.id]: e.target.value })}
                          onBlur={() => salvarPreco(p.produtoId, parseFloat(editando[p.id]), p.unidade)}
                          onKeyDown={e => { if (e.key === 'Enter') salvarPreco(p.produtoId, parseFloat(editando[p.id]), p.unidade); if (e.key === 'Escape') setEditando({}); }} />
                      ) : (
                        <button onClick={() => setEditando({ [p.id]: String(p.precoAtual) })}
                          style={{ background: 'none', border: 'none', color: '#16A34A', fontWeight: 700, fontSize: '13px', cursor: 'pointer', padding: 0, fontFamily: 'monospace' }}>
                          {fmt(p.precoAtual)}
                        </button>
                      )}
                      {p.precoAnterior && (
                        <span style={{ fontSize: '11px', color: p.precoAtual > p.precoAnterior ? '#DC2626' : '#16A34A', marginLeft: '6px' }}>
                          {p.precoAtual > p.precoAnterior ? '↗' : '↘'} era {fmt(p.precoAnterior)}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94A3B8', fontSize: '12px' }}>{dias(p.updatedAt)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button onClick={() => remover(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', fontSize: '16px' }}
                        onMouseEnter={e => e.target.style.color = '#EF4444'} onMouseLeave={e => e.target.style.color = '#CBD5E1'}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ padding: '10px 24px', background: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── DRAWER: DETALHES DO FORNECEDOR GANHADOR ────────────────
function DrawerFornecedor({ fornecedor, onFechar, onEditar }) {
  if (!fornecedor) return null;
  const campo = (label, valor) => valor ? (
    <div style={{ marginBottom: '14px' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>{label}</p>
      <p style={{ fontSize: '14px', color: '#1E293B', fontWeight: 600 }}>{valor}</p>
    </div>
  ) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onFechar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
      <div style={{ position: 'relative', width: '340px', background: 'white', height: '100%', boxShadow: '-10px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.2s ease' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ width: '48px', height: '48px', background: '#FEF3C7', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '10px' }}>🏭</div>
            <p style={{ fontWeight: 800, fontSize: '18px', color: '#1E293B' }}>{fornecedor.nome}</p>
            {fornecedor.cnpj && <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>CNPJ: {fornecedor.cnpj}</p>}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#94A3B8' }}>×</button>
        </div>
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {campo('Vendedor / Contato', fornecedor.vendedor)}
          {campo('Telefone', fornecedor.telefone)}
          {campo('Prazo de Pagamento', fornecedor.prazoPagamento)}
          {campo('Observações', fornecedor.observacoes)}
          <div style={{ marginTop: '8px', padding: '12px 14px', background: '#DCFCE7', borderRadius: '10px', border: '1px solid #BBF7D0' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>⭐ Melhor fornecedor selecionado</p>
            <p style={{ fontSize: '11px', color: '#16A34A', marginTop: '3px' }}>{fornecedor._count?.precos || 0} produto(s) cadastrado(s)</p>
          </div>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
          <button onClick={() => { onEditar(fornecedor); onFechar(); }} style={{ flex: 1, padding: '10px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>✏️ Editar</button>
          {fornecedor.telefone && (
            <a href={`https://wa.me/55${fornecedor.telefone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
              style={{ flex: 1, padding: '10px', background: '#16A34A', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              💬 WhatsApp
            </a>
          )}
        </div>
      </div>
      <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
    </div>
  );
}

// ─── ABA: COMPARAÇÃO ────────────────────────────────────────
function AbaComparacao({ onVerFornecedor }) {
  const [dados, setDados] = useState({ fornecedores: [], linhas: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/fornecedores/comparacao/tabela')
      .then(r => setDados(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>Carregando...</div>;
  if (!dados.linhas.length) return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
      <p style={{ fontSize: '40px' }}>⚖️</p>
      <p style={{ fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>Nenhum preço cadastrado ainda</p>
      <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Cadastre fornecedores e seus preços para comparar</p>
    </div>
  );

  // calcular economia total
  const economiaTotal = dados.linhas.reduce((acc, linha) => {
    const precos = Object.values(linha.precos).map(p => p.preco);
    if (precos.length < 2) return acc;
    return acc + (Math.max(...precos) - Math.min(...precos));
  }, 0);

  return (
    <div>
      {economiaTotal > 0 && (
        <div style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', borderRadius: '12px', padding: '16px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', color: 'white' }}>
          <span style={{ fontSize: '28px' }}>💰</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: '15px' }}>Potencial de economia: {fmt(economiaTotal)} por compra</p>
            <p style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>Escolhendo sempre o fornecedor mais barato em cada produto</p>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '500px' }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', position: 'sticky', left: 0, background: '#F8FAFC' }}>Produto</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>Un.</th>
                {dados.fornecedores.map(f => (
                  <th key={f.id} style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748B', minWidth: '130px' }}>{f.nome}</th>
                ))}
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#94A3B8' }}>Melhor</th>
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map(linha => {
                const unidade = Object.values(linha.precos)[0]?.unidade || 'KG';
                const melhorForn = dados.fornecedores.find(f => f.id === linha.melhor?.fornecedorId);
                const precos = Object.values(linha.precos).map(p => p.preco);
                const maxPreco = precos.length > 1 ? Math.max(...precos) : null;
                const economia = maxPreco && linha.melhor ? maxPreco - linha.melhor.preco : 0;

                return (
                  <tr key={linha.produto.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B', fontSize: '14px', position: 'sticky', left: 0, background: 'white' }}>{linha.produto.nome}</td>
                    <td style={{ padding: '12px 8px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>{unidade === 'KG' ? 'kg' : 'un'}</td>
                    {dados.fornecedores.map(f => {
                      const p = linha.precos[f.id];
                      const ehMelhor = linha.melhor?.fornecedorId === f.id;
                      const atualizado = p ? dias(p.updatedAt) : null;
                      const velho = p && (Date.now() - new Date(p.updatedAt)) > 30 * 86400000;
                      return (
                        <td key={f.id} style={{ padding: '10px 16px', textAlign: 'right', background: ehMelhor ? '#DCFCE7' : 'transparent' }}>
                          {p ? (
                            <div>
                              <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: ehMelhor ? 800 : 600, color: ehMelhor ? '#16A34A' : '#475569' }}>
                                {ehMelhor ? '⭐ ' : ''}{fmt(p.preco)}
                              </span>
                              <div style={{ fontSize: '10px', color: velho ? '#F59E0B' : '#94A3B8', marginTop: '2px' }}>
                                {velho ? '⚠ ' : ''}{atualizado}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: '#CBD5E1', fontSize: '13px' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {melhorForn ? (
                        <button onClick={() => onVerFornecedor(melhorForn)}
                          style={{ padding: '5px 12px', background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: '99px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: '#16A34A', whiteSpace: 'nowrap' }}>
                          {melhorForn.nome}
                          {economia > 0 && <span style={{ marginLeft: '5px', opacity: 0.75 }}>(-{fmt(economia)})</span>}
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', fontSize: '11px', color: '#94A3B8' }}>
          💡 Clique no fornecedor destacado em verde para ver os dados de contato · ⚠ amarelo = preço há mais de 30 dias
        </div>
      </div>
    </div>
  );
}

// ─── ABA: LISTA DE COMPRAS ───────────────────────────────────
function AbaListaCompras({ produtos }) {
  const [comparacao, setComparacao]     = useState({ fornecedores: [], linhas: [] });
  const [selecionados, setSelecionados] = useState({});   // produtoId -> quantidade
  const [lista, setLista]               = useState(null); // resultado agrupado
  const [loading, setLoading]           = useState(true);
  const printRef = useRef();

  useEffect(() => {
    api.get('/fornecedores/comparacao/tabela')
      .then(r => setComparacao(r.data))
      .finally(() => setLoading(false));
  }, []);

  const toggleProduto = (id) => {
    setSelecionados(prev => {
      if (prev[id] !== undefined) { const n = { ...prev }; delete n[id]; return n; }
      return { ...prev, [id]: 1 };
    });
    setLista(null);
  };

  const gerarLista = () => {
    const porFornecedor = {};
    let semFornecedor = [];

    Object.entries(selecionados).forEach(([prodIdStr, qtd]) => {
      const prodId = parseInt(prodIdStr);
      const linha = comparacao.linhas.find(l => l.produto.id === prodId);
      if (!linha || !linha.melhor) {
        const prod = produtos.find(p => p.id === prodId);
        if (prod) semFornecedor.push({ produto: prod, qtd, unidade: 'KG' });
        return;
      }
      const forn = comparacao.fornecedores.find(f => f.id === linha.melhor.fornecedorId);
      const precoInfo = linha.precos[linha.melhor.fornecedorId];
      if (!forn) return;

      if (!porFornecedor[forn.id]) porFornecedor[forn.id] = { fornecedor: forn, itens: [], total: 0 };
      const subtotal = precoInfo.preco * qtd;
      porFornecedor[forn.id].itens.push({ produto: linha.produto, qtd, preco: precoInfo.preco, unidade: precoInfo.unidade, subtotal });
      porFornecedor[forn.id].total += subtotal;
    });

    setLista({ grupos: Object.values(porFornecedor), semFornecedor });
  };

  const imprimir = () => {
    const conteudo = printRef.current.innerHTML;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Lista de Compras</title><style>
      body{font-family:Arial,sans-serif;padding:20px;color:#1E293B}
      h1{font-size:18px;margin-bottom:4px}
      h2{font-size:14px;margin:16px 0 6px;color:#D97706}
      table{width:100%;border-collapse:collapse;margin-bottom:12px}
      th{background:#F8FAFC;padding:6px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B}
      td{padding:6px 10px;border-bottom:1px solid #F1F5F9;font-size:13px}
      .total{text-align:right;font-weight:700;font-size:14px;margin-top:4px}
      .grand{margin-top:16px;padding:12px;background:#F0FDF4;border-radius:8px;font-weight:700;font-size:16px}
    </style></head><body>${conteudo}</body></html>`);
    w.document.close();
    w.print();
  };

  const produtosComPreco = comparacao.linhas.map(l => l.produto.id);
  const totalGeral = lista ? lista.grupos.reduce((a, g) => a + g.total, 0) : 0;

  if (loading) return <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>Carregando...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', alignItems: 'start' }}>
      {/* Seleção de produtos */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <p style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>Selecione os produtos</p>
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>O sistema escolhe o melhor preço automaticamente</p>
        </div>
        <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
          {produtos.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Nenhum produto cadastrado</div>
          ) : produtos.map(p => {
            const temPreco = produtosComPreco.includes(p.id);
            const sel = selecionados[p.id] !== undefined;
            return (
              <div key={p.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '10px', background: sel ? '#FEF3C7' : 'white', opacity: temPreco ? 1 : 0.45 }}>
                <input type="checkbox" checked={sel} disabled={!temPreco} onChange={() => toggleProduto(p.id)}
                  style={{ width: '16px', height: '16px', cursor: temPreco ? 'pointer' : 'not-allowed', accentColor: '#D97706' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B' }}>{p.nome}</p>
                  {!temPreco && <p style={{ fontSize: '10px', color: '#94A3B8' }}>sem preço de fornecedor</p>}
                </div>
                {sel && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => setSelecionados(prev => ({ ...prev, [p.id]: Math.max(0.5, (prev[p.id] || 1) - 0.5) }))}
                      style={{ width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: '13px', fontWeight: 700, minWidth: '30px', textAlign: 'center' }}>{selecionados[p.id]}</span>
                    <button onClick={() => setSelecionados(prev => ({ ...prev, [p.id]: (prev[p.id] || 1) + 0.5 }))}
                      style={{ width: '24px', height: '24px', border: '1px solid #E2E8F0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '12px 14px', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={gerarLista} disabled={Object.keys(selecionados).length === 0}
            style={{ width: '100%', padding: '11px', background: '#D97706', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', opacity: Object.keys(selecionados).length === 0 ? 0.4 : 1 }}>
            🛒 Gerar Lista de Compras
          </button>
        </div>
      </div>

      {/* Resultado */}
      {!lista ? (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px' }}>🛒</p>
          <p style={{ fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>Selecione os produtos e gere a lista</p>
          <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>O sistema vai montar a lista agrupada pelo melhor fornecedor de cada item</p>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontWeight: 700, fontSize: '15px', color: '#1E293B' }}>Lista de Compras</p>
            <button onClick={imprimir} style={{ padding: '8px 16px', background: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', color: 'white' }}>🖨️ Imprimir</button>
          </div>

          <div ref={printRef}>
            <h1 style={{ display: 'none' }}>Lista de Compras — {new Date().toLocaleDateString('pt-BR')}</h1>

            {lista.grupos.map(grupo => (
              <div key={grupo.fornecedor.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 800, fontSize: '14px', color: '#92400E' }}>🏭 {grupo.fornecedor.nome}</p>
                    {grupo.fornecedor.telefone && <p style={{ fontSize: '12px', color: '#B45309', marginTop: '1px' }}>📞 {grupo.fornecedor.telefone}{grupo.fornecedor.vendedor ? ` · ${grupo.fornecedor.vendedor}` : ''}</p>}
                    {grupo.fornecedor.prazoPagamento && <p style={{ fontSize: '11px', color: '#B45309', marginTop: '1px' }}>💳 {grupo.fornecedor.prazoPagamento}</p>}
                  </div>
                  <p style={{ fontWeight: 800, fontSize: '16px', color: '#D97706' }}>{fmt(grupo.total)}</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['Produto', 'Un.', 'Qtd', 'Preço unit.', 'Subtotal'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Produto' ? 'left' : 'right', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.itens.map((item, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1E293B', fontSize: '13px' }}>{item.produto.nome}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748B', fontSize: '12px' }}>{item.unidade === 'KG' ? 'kg' : 'un'}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#1E293B', fontSize: '13px' }}>{item.qtd}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', color: '#475569', fontSize: '13px' }}>{fmt(item.preco)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1E293B', fontSize: '13px' }}>{fmt(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {lista.semFornecedor.length > 0 && (
              <div style={{ background: '#FEF9C3', borderRadius: '10px', border: '1px solid #FDE047', padding: '12px 16px', marginBottom: '12px' }}>
                <p style={{ fontWeight: 700, fontSize: '13px', color: '#854D0E', marginBottom: '6px' }}>⚠ Sem fornecedor definido:</p>
                {lista.semFornecedor.map((item, i) => (
                  <p key={i} style={{ fontSize: '13px', color: '#713F12' }}>• {item.produto.nome} — {item.qtd} {item.unidade}</p>
                ))}
              </div>
            )}

            <div style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
              <p style={{ fontWeight: 700, fontSize: '15px' }}>💰 Total Geral</p>
              <p style={{ fontWeight: 800, fontSize: '22px' }}>{fmt(totalGeral)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────
export default function Fornecedores() {
  const [aba, setAba]               = useState('lista');
  const [fornecedores, setFornecedores] = useState([]);
  const [produtos, setProdutos]     = useState([]);
  const [alertas, setAlertas]       = useState([]);
  const [modal, setModal]           = useState(null);
  const [precosModal, setPrecosModal] = useState(null);
  const [drawerForn, setDrawerForn] = useState(null);

  const carregar = async () => {
    const [f, p] = await Promise.all([api.get('/fornecedores'), api.get('/produtos')]);
    setFornecedores(f.data); setProdutos(p.data);
  };

  const carregarAlertas = async () => {
    const { data } = await api.get('/fornecedores/comparacao/alertas');
    setAlertas(data);
  };

  useEffect(() => { carregar(); carregarAlertas(); }, []);

  const remover = async (id) => {
    if (!confirm('Remover este fornecedor?')) return;
    await api.delete(`/fornecedores/${id}`);
    carregar();
  };

  const abas = [
    { id: 'lista',       label: 'Fornecedores', icon: '🏭' },
    { id: 'comparacao',  label: 'Comparação',   icon: '⚖️' },
    { id: 'lista-compras', label: 'Lista de Compras', icon: '🛒' },
    { id: 'alertas',     label: 'Alertas',      icon: '🚨', count: alertas.filter(a => Math.abs(a.variacao) >= 5).length },
  ];

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
      {modal !== null && (
        <ModalFornecedor fornecedor={modal} onSalvar={() => { setModal(null); carregar(); }} onFechar={() => setModal(null)} />
      )}
      {precosModal && (
        <ModalPrecos fornecedor={precosModal} produtos={produtos} onFechar={() => setPrecosModal(null)} />
      )}
      {drawerForn && (
        <DrawerFornecedor fornecedor={drawerForn} onFechar={() => setDrawerForn(null)} onEditar={(f) => { setDrawerForn(null); setModal(f); }} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1E293B' }}>Fornecedores</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Compare preços e gerencie seus fornecedores</p>
        </div>
        {aba === 'lista' && (
          <button onClick={() => setModal({})} style={{ padding: '10px 20px', background: '#D97706', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white' }}>
            + Novo Fornecedor
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #E2E8F0' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700, color: aba === a.id ? '#D97706' : '#64748B',
            borderBottom: aba === a.id ? '2px solid #D97706' : '2px solid transparent',
            marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <span>{a.icon}</span>{a.label}
            {a.count > 0 && <span style={{ background: '#EF4444', color: 'white', borderRadius: '99px', padding: '1px 7px', fontSize: '10px', fontWeight: 700 }}>{a.count}</span>}
          </button>
        ))}
      </div>

      {/* Aba: Lista */}
      {aba === 'lista' && (
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          {fornecedores.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '48px' }}>🏭</p>
              <p style={{ fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>Nenhum fornecedor cadastrado</p>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Clique em "+ Novo Fornecedor" para começar</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Nome', 'Vendedor', 'Telefone', 'Prazo Pgto', 'Produtos', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fornecedores.map((f, i) => (
                  <tr key={f.id} style={{ borderBottom: i < fornecedores.length - 1 ? '1px solid #F1F5F9' : 'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1E293B', fontSize: '14px', cursor: 'pointer' }}
                      onClick={() => setDrawerForn(f)}>{f.nome}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px' }}>{f.vendedor || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px' }}>{f.telefone || '—'}</td>
                    <td style={{ padding: '12px 16px', color: '#475569', fontSize: '13px' }}>{f.prazoPagamento || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 700 }}>
                        {f._count?.precos || 0} produtos
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                      <button onClick={() => setPrecosModal(f)} style={{ padding: '6px 12px', background: '#D97706', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: 'white' }}>📋 Preços</button>
                      <button onClick={() => setModal(f)} style={{ padding: '6px 12px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#475569' }}>✏️</button>
                      <button onClick={() => remover(f.id)} style={{ padding: '6px 10px', background: 'white', border: '1.5px solid #E2E8F0', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', color: '#CBD5E1' }}
                        onMouseEnter={e => { e.target.style.color = '#EF4444'; e.target.style.borderColor = '#EF4444'; }}
                        onMouseLeave={e => { e.target.style.color = '#CBD5E1'; e.target.style.borderColor = '#E2E8F0'; }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Aba: Comparação */}
      {aba === 'comparacao' && <AbaComparacao onVerFornecedor={setDrawerForn} />}

      {/* Aba: Lista de Compras */}
      {aba === 'lista-compras' && <AbaListaCompras produtos={produtos} />}

      {/* Aba: Alertas */}
      {aba === 'alertas' && (
        <div>
          {alertas.length === 0 ? (
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '60px', textAlign: 'center' }}>
              <p style={{ fontSize: '40px' }}>✅</p>
              <p style={{ fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>Nenhuma variação significativa</p>
              <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Sem mudanças de preço nos últimos 7 dias</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {alertas.map(a => (
                <div key={a.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #E2E8F0', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <span style={{ fontSize: '28px' }}>{a.tipo === 'alta' ? '🔴' : '🟢'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px' }}><strong>{a.produto}</strong> · {a.fornecedor}</p>
                    <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                      De <span style={{ textDecoration: 'line-through' }}>{fmt(a.precoAnterior)}</span> para{' '}
                      <strong style={{ color: a.tipo === 'alta' ? '#DC2626' : '#16A34A' }}>{fmt(a.precoAtual)}</strong>
                      {' '}em {new Date(a.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div style={{ padding: '6px 14px', borderRadius: '99px', fontSize: '13px', fontWeight: 800, background: a.tipo === 'alta' ? '#FEE2E2' : '#DCFCE7', color: a.tipo === 'alta' ? '#991B1B' : '#166534' }}>
                    {a.tipo === 'alta' ? '↗' : '↘'} {Math.abs(a.variacao).toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
