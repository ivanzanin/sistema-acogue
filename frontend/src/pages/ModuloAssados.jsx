import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const BRL = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMAS = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'VOUCHER'];
const FORMA_ICON = { DINHEIRO: '💵', PIX: '📱', DEBITO: '💳', CREDITO: '💳', VOUCHER: '🎫' };
const EMOJIS = ['🍗', '🥩', '🌭', '🍖', '🔥', '🥓', '🫀', '🍔'];
const CORES = ['#D97706','#DC2626','#059669','#7C3AED','#DB2777','#0284C7','#65A30D','#EA580C'];

const inp = {
  width: '100%', padding: '10px 12px', border: '1.5px solid #E2E8F0',
  borderRadius: '8px', fontSize: '14px', color: '#1E293B', background: 'white',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const btn = (bg, color = 'white') => ({
  border: 'none', borderRadius: '10px', padding: '10px 18px', fontWeight: 700,
  fontSize: '13px', cursor: 'pointer', color, background: bg,
  fontFamily: 'inherit', transition: 'opacity 0.15s',
});
const lbl = { fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '5px' };

// ── Modal de Abrir Sessão ─────────────────────────────────────
const TEMPLATE_KEY = 'assados_template_v1';

function ModalAbrirSessao({ onAberta, onFechar }) {
  const [abrindo, setAbrindo] = useState(false);
  const [template, setTemplate] = useState([]);
  const [estoques, setEstoques] = useState({});       // produtoId (sessão template index) -> valor digitado
  const [acougueMap, setAcougueMap] = useState({});   // produtoOrigemId -> produto do açougue
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(TEMPLATE_KEY);
        let tpl = raw ? JSON.parse(raw) : [];

        // Sempre busca produtos do açougue (para mostrar estoque e auto-vincular por nome)
        let acougueProdutos = [];
        try {
          const { data } = await api.get('/produtos');
          acougueProdutos = data;
        } catch {}

        // Auto-vincula por nome quando o template não tem produtoOrigemId
        tpl = tpl.map(t => {
          if (t.produtoOrigemId) return t;
          const match = acougueProdutos.find(p =>
            p.nome.trim().toLowerCase() === t.nome.trim().toLowerCase()
          );
          return match ? { ...t, produtoOrigemId: match.id } : t;
        });

        setTemplate(tpl);
        const e = {}; tpl.forEach((_, i) => { e[i] = ''; });
        setEstoques(e);

        const map = {};
        acougueProdutos.forEach(p => { map[p.id] = p; });
        setAcougueMap(map);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const abrir = async () => {
    setAbrindo(true);
    try {
      await api.post('/assados/abrir');

      // Para vinculados, validar estoque vs açougue e perguntar se quer adicionar diferença
      const ajustesAcougue = [];
      for (let i = 0; i < template.length; i++) {
        const t = template[i];
        const qtd = parseFloat(estoques[i]) || 0;
        if (!t.produtoOrigemId || qtd <= 0) continue;
        const acougue = acougueMap[t.produtoOrigemId];
        if (!acougue) continue;
        const disponivel = acougue.estoqueAtual || 0;
        if (qtd > disponivel) {
          ajustesAcougue.push({
            template: t, acougue, diferenca: qtd - disponivel,
            qtdSessao: qtd, unidade: t.unidade,
          });
        }
      }

      if (ajustesAcougue.length > 0) {
        const linhas = ajustesAcougue.map(a =>
          `• ${a.template.emoji || '🍗'} ${a.template.nome}: você quer ${a.qtdSessao} un mas o açougue tem ${a.acougue.estoqueAtual || 0} un → vai adicionar +${a.diferenca.toFixed(2)} un ao açougue`
        ).join('\n');
        const ok = confirm(
          `⚠ Atenção: alguns produtos têm estoque maior que o disponível no açougue!\n\n${linhas}\n\nDeseja continuar e ajustar o estoque do açougue?`
        );
        if (!ok) { setAbrindo(false); return; }
      }

      // Cria cada produto da sessão com o estoque digitado
      for (let i = 0; i < template.length; i++) {
        const t = template[i];
        const qtd = parseFloat(estoques[i]) || 0;
        try {
          await api.post('/assados/produtos', {
            nome: t.nome, preco: String(t.preco), unidade: t.unidade,
            estoqueInicial: String(qtd), codigoBarras: t.codigoBarras || '',
            emoji: t.emoji || '🍗',
            produtoOrigemId: t.produtoOrigemId || null,
          });
        } catch (err) { console.error('Erro ao recriar produto', t.nome, err); }
      }

      // Adiciona a diferença no açougue para os produtos que excederam
      for (const a of ajustesAcougue) {
        try {
          await api.patch(`/produtos/${a.acougue.id}/estoque`, { quantidade: a.diferenca, operacao: 'adicionar' });
        } catch (err) {
          console.error('Erro ao ajustar açougue', a.template.nome, err);
        }
      }

      onAberta();
    } catch (e) { alert(e.response?.data?.erro || 'Erro ao abrir sessão.'); }
    finally { setAbrindo(false); }
  };

  const setEstoque = (i, v) => setEstoques(prev => ({ ...prev, [i]: v }));

  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: '16px', padding: '30px', color: '#94A3B8' }}>Carregando...</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '24px 28px 12px', textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '52px' }}>🔥</div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#1E293B', marginTop: '8px' }}>Módulo Assados</h2>
          {template.length === 0 ? (
            <p style={{ color: '#64748B', fontSize: '13px', marginTop: '6px', lineHeight: 1.5, maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
              Abre uma nova sessão para controlar estoque, reservas e vendas dos assados separado do sistema principal.
            </p>
          ) : (
            <p style={{ color: '#64748B', fontSize: '13px', marginTop: '6px' }}>
              Digite o estoque inicial de cada produto desta sessão
            </p>
          )}
        </div>

        {template.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 0' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {template.map((t, i) => {
                const acougue = t.produtoOrigemId ? acougueMap[t.produtoOrigemId] : null;
                const qtd = parseFloat(estoques[i]) || 0;
                const disponivel = acougue?.estoqueAtual || 0;
                const excede = acougue && qtd > disponivel;
                const unTxt = 'un'; // estoque de assados sempre em unidades
                return (
                  <div key={i} style={{ padding: '12px 14px', background: excede ? '#FEF3C7' : '#F8FAFC', border: `1.5px solid ${excede ? '#FCD34D' : '#E2E8F0'}`, borderRadius: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '24px' }}>{t.emoji || '🍗'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>{t.nome}</p>
                        <p style={{ fontSize: '11px', color: '#64748B' }}>
                          {BRL(t.preco)}/{unTxt}
                          {acougue && (
                            <span style={{ marginLeft: '6px', color: '#1E40AF', fontWeight: 600 }}>
                              · 🔗 açougue: {disponivel} {unTxt}
                            </span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={estoques[i] ?? ''}
                          onChange={e => setEstoque(i, e.target.value)}
                          style={{ width: '80px', padding: '8px 10px', border: `1.5px solid ${excede ? '#F59E0B' : '#E2E8F0'}`, borderRadius: '8px', fontSize: '14px', textAlign: 'right', fontFamily: 'inherit', outline: 'none', fontWeight: 600 }}
                          placeholder="0"
                        />
                        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>{unTxt}</span>
                      </div>
                    </div>
                    {excede && (
                      <p style={{ fontSize: '11px', color: '#92400E', marginTop: '8px', paddingLeft: '36px', lineHeight: 1.4 }}>
                        ⚠ Excede em <strong>{(qtd - disponivel).toFixed(2)} un</strong> o estoque do açougue — vai adicionar a diferença lá
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ padding: '16px 24px 20px', display: 'flex', gap: '10px', flexShrink: 0, borderTop: template.length > 0 ? '1px solid #F1F5F9' : 'none' }}>
          <button onClick={onFechar} style={{ ...btn('#F1F5F9', '#475569'), flex: 1 }}>Voltar</button>
          <button onClick={abrir} disabled={abrindo} style={{ ...btn('#D97706'), flex: 2, padding: '14px', fontSize: '15px' }}>
            {abrindo ? 'Abrindo...' : '🔥 Abrir Sessão'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de Produtos ─────────────────────────────────────────
function ModalProdutos({ produtos, onAtualizado, onFechar }) {
  const [form, setForm] = useState({ nome: '', preco: '', unidade: 'UN', estoqueInicial: '', codigoBarras: '', emoji: '🍗' });
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(null);
  const [produtoOrigem, setProdutoOrigem] = useState(null);   // produto do açougue vinculado
  const [picker, setPicker] = useState(false);                // mostra o picker
  const [acougueProds, setAcougueProds] = useState([]);
  const [buscaAcougue, setBuscaAcougue] = useState('');

  const campo = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const limpar = () => {
    setForm({ nome: '', preco: '', unidade: 'UN', estoqueInicial: '', codigoBarras: '', emoji: '🍗' });
    setEditando(null);
    setProdutoOrigem(null);
  };

  const abrirPicker = async () => {
    try {
      const { data } = await api.get('/produtos');
      setAcougueProds(data.filter(p => p.ativo !== false));
      setPicker(true);
    } catch (e) { alert('Erro ao carregar produtos do açougue.'); }
  };

  const selecionarDoAcougue = (p) => {
    setProdutoOrigem(p);
    setForm({
      nome: p.nome,
      preco: String(p.precoVenda || p.preco || 0),
      unidade: p.unidade || 'UN',
      estoqueInicial: '',
      codigoBarras: p.codigoBarras || '',
      emoji: form.emoji,
    });
    setPicker(false);
    setBuscaAcougue('');
  };

  const salvar = async () => {
    if (!form.nome.trim() || !form.preco) { alert('Nome e preço são obrigatórios.'); return; }

    const estoque = parseFloat(form.estoqueInicial) || 0;

    // Se vinculado ao açougue, avisa se quer adicionar mais do que tem disponível
    if (produtoOrigem && estoque > 0 && !editando) {
      const unTxt = form.unidade === 'KG' ? 'kg' : 'un';
      const disponivel = produtoOrigem.estoqueAtual || 0;
      if (disponivel < estoque) {
        const continuar = confirm(
          `⚠ Atenção: estoque insuficiente no açougue!\n\n` +
          `${produtoOrigem.nome} (açougue): ${disponivel} ${unTxt}\n` +
          `Você está colocando aqui: ${estoque} ${unTxt}\n\n` +
          `Deseja salvar mesmo assim?`
        );
        if (!continuar) return;
      }
    }

    setSalvando(true);
    try {
      const payload = { ...form, produtoOrigemId: produtoOrigem?.id || null };
      if (editando) {
        // No edit, o backend espera "estoqueAtual" em vez de "estoqueInicial"
        payload.estoqueAtual = form.estoqueInicial;
        delete payload.estoqueInicial;
        await api.patch(`/assados/produtos/${editando.id}`, payload);
      } else {
        await api.post('/assados/produtos', payload);
      }
      limpar();
      onAtualizado();
    } catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setSalvando(false); }
  };

  const editar = async (p) => {
    setEditando(p);
    setForm({ nome: p.nome, preco: String(p.preco), unidade: p.unidade, estoqueInicial: String(p.estoqueAtual || 0), codigoBarras: p.codigoBarras || '', emoji: p.emoji || '🍗' });
    // Se o produto tem vínculo com um produto do açougue, carrega
    if (p.produtoOrigemId) {
      try {
        const { data } = await api.get('/produtos');
        const origem = data.find(prod => prod.id === p.produtoOrigemId);
        if (origem) setProdutoOrigem(origem);
      } catch {}
    } else {
      setProdutoOrigem(null);
    }
  };

  const remover = async (id) => {
    if (!confirm('Remover este produto?')) return;
    await api.delete(`/assados/produtos/${id}`);
    onAtualizado();
  };

  const filtrados = acougueProds.filter(p => p.nome.toLowerCase().includes(buscaAcougue.toLowerCase()));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '580px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>📦 Produtos da Sessão</p>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Lista de produtos */}
          {produtos.length > 0 && (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {produtos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', gap: '12px' }}>
                  <span style={{ fontSize: '22px' }}>{p.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '14px', color: '#1E293B' }}>{p.nome}</p>
                    <p style={{ fontSize: '12px', color: '#64748B' }}>{BRL(p.preco)}/{p.unidade === 'KG' ? 'kg' : 'un'} · Estoque: {p.estoqueAtual} un</p>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => editar(p)} style={{ ...btn('#EFF6FF', '#1E40AF'), padding: '6px 10px', fontSize: '12px' }}>✏️</button>
                    <button onClick={() => remover(p.id)} style={{ ...btn('#FEF2F2', '#DC2626'), padding: '6px 10px', fontSize: '12px' }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Form de adicionar/editar */}
          <div style={{ background: editando ? '#FFF7ED' : '#F8FAFC', borderRadius: '12px', padding: '16px', border: `1px solid ${editando ? '#FED7AA' : '#E2E8F0'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <p style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>{editando ? '✏️ Editando produto' : '➕ Novo produto'}</p>
              {!editando && (
                <button onClick={abrirPicker} style={{ ...btn('#1E40AF'), padding: '6px 12px', fontSize: '12px' }}>📦 Importar do açougue</button>
              )}
            </div>

            {/* Vinculo com produto do açougue */}
            {produtoOrigem && (
              <div style={{ marginBottom: '12px', padding: '10px 12px', background: '#DBEAFE', border: '1.5px solid #93C5FD', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🔗</span>
                <div style={{ flex: 1, fontSize: '12px' }}>
                  <p style={{ fontWeight: 700, color: '#1E40AF' }}>Vinculado a: {produtoOrigem.nome}</p>
                  <p style={{ color: '#1E40AF', opacity: 0.85 }}>Açougue tem: {produtoOrigem.estoqueAtual || 0} {produtoOrigem.unidade === 'KG' ? 'kg' : 'un'} disponíveis</p>
                </div>
                <button onClick={() => setProdutoOrigem(null)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#1E40AF' }}>×</button>
              </div>
            )}

            {/* Emoji selector */}
            <div style={{ marginBottom: '12px' }}>
              <label style={lbl}>Emoji</label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => campo('emoji', e)} style={{ fontSize: '22px', padding: '6px', borderRadius: '8px', border: `2px solid ${form.emoji === e ? '#D97706' : '#E2E8F0'}`, background: form.emoji === e ? '#FFF7ED' : 'white', cursor: 'pointer' }}>{e}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={lbl}>Nome *</label>
                <input style={inp} value={form.nome} onChange={e => campo('nome', e.target.value)} placeholder="Ex: Frango Assado" />
              </div>
              <div>
                <label style={lbl}>Preço (R$) *</label>
                <input style={inp} type="number" step="0.01" value={form.preco} onChange={e => campo('preco', e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={form.unidade} onChange={e => campo('unidade', e.target.value)}>
                  <option value="UN">Unidade (UN)</option>
                  <option value="KG">Por Kilo (KG)</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Estoque inicial (unidades)</label>
                <input style={inp} type="number" step="0.5" value={form.estoqueInicial} onChange={e => campo('estoqueInicial', e.target.value)} placeholder="0" />
              </div>
              <div>
                <label style={lbl}>Código de barras</label>
                <input style={inp} value={form.codigoBarras} onChange={e => campo('codigoBarras', e.target.value)} placeholder="Opcional" />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {editando && <button onClick={limpar} style={{ ...btn('#F1F5F9', '#475569'), flex: 1 }}>Cancelar</button>}
              <button onClick={salvar} disabled={salvando} style={{ ...btn('#D97706'), flex: 2 }}>
                {salvando ? 'Salvando...' : editando ? '✓ Salvar alterações' : '➕ Adicionar produto'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Picker de produtos do açougue */}
      {picker && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontWeight: 800, fontSize: '15px', color: '#1E293B' }}>📦 Estoque do Açougue</p>
              <button onClick={() => { setPicker(false); setBuscaAcougue(''); }} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>
            <div style={{ padding: '14px 24px 0' }}>
              <input style={inp} value={buscaAcougue} onChange={e => setBuscaAcougue(e.target.value)} placeholder="🔍 Buscar produto..." autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 24px 20px' }}>
              {filtrados.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#94A3B8' }}>
                  <p style={{ fontSize: '36px', marginBottom: '6px' }}>🔍</p>
                  <p style={{ fontSize: '13px' }}>{acougueProds.length === 0 ? 'Nenhum produto cadastrado no açougue.' : 'Nenhum produto encontrado.'}</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {filtrados.map(p => (
                    <button key={p.id} onClick={() => selecionarDoAcougue(p)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#EFF6FF'; e.currentTarget.style.borderColor = '#93C5FD'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; }}>
                      <div style={{ width: '36px', height: '36px', background: '#E0F2FE', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🥩</div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>{p.nome}</p>
                        <p style={{ fontSize: '11px', color: '#64748B' }}>
                          {BRL(p.precoVenda || p.preco || 0)}/{p.unidade === 'KG' ? 'kg' : 'un'}
                          {' · '}
                          <span style={{ color: (p.estoqueAtual || 0) <= 0 ? '#DC2626' : '#16A34A', fontWeight: 600 }}>
                            {(p.estoqueAtual || 0)} {p.unidade === 'KG' ? 'kg' : 'un'} em estoque
                          </span>
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Busca de produto normal (para reservas/comandas) ──────────
function BuscaProdutoNormal({ onAdicionar }) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (termo.trim().length < 2) { setResultados([]); return; }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await api.get(`/assados/buscar-normal?q=${encodeURIComponent(termo.trim())}`);
        setResultados(data);
        setAberto(true);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [termo]);

  const selecionar = (p) => {
    onAdicionar(p);
    setTermo('');
    setResultados([]);
    setAberto(false);
  };

  return (
    <div style={{ position:'relative', marginBottom:'10px' }}>
      <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>
        🔍 Adicionar produto do açougue (Coca, arroz, etc.)
      </label>
      <input
        value={termo}
        onChange={e => setTermo(e.target.value)}
        onFocus={() => resultados.length > 0 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder="Digite o nome do produto..."
        style={{ width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' }}
      />
      {aberto && resultados.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, marginTop:'4px', background:'white', borderRadius:'10px', border:'1px solid #E2E8F0', boxShadow:'0 8px 24px rgba(0,0,0,0.12)', maxHeight:'240px', overflowY:'auto', zIndex:10 }}>
          {resultados.map(p => (
            <button key={p.id} onMouseDown={() => selecionar(p)}
              style={{ width:'100%', padding:'10px 12px', textAlign:'left', background:'none', border:'none', borderBottom:'1px solid #F1F5F9', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}
              onMouseEnter={e => e.currentTarget.style.background='#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background='none'}>
              <div>
                <p style={{ fontWeight:700, fontSize:'13px', color:'#1E293B' }}>📦 {p.nome}</p>
                <p style={{ fontSize:'11px', color:'#64748B' }}>Estoque: {p.estoqueAtual} {p.unidade === 'KG' ? 'kg' : 'un'}</p>
              </div>
              <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:'13px', color:'#16A34A' }}>{BRL(p.precoVenda)}</span>
            </button>
          ))}
        </div>
      )}
      {buscando && <p style={{ fontSize:'11px', color:'#94A3B8', marginTop:'4px' }}>Buscando...</p>}
      {!buscando && termo.length >= 2 && resultados.length === 0 && (
        <p style={{ fontSize:'11px', color:'#94A3B8', marginTop:'4px' }}>Nenhum produto encontrado.</p>
      )}
    </div>
  );
}

// ── Modal Nova Reserva ────────────────────────────────────────
function ModalNovaReserva({ produtos, onSalvo, onFechar }) {
  const [form, setForm] = useState({ nomeCliente: '', telefone: '', pago: false, observacoes: '' });
  const [itens, setItens] = useState([]); // pode conter ASSADO ou NORMAL
  const [salvando, setSalvando] = useState(false);
  const campo = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Adiciona produto de assado (botões)
  const addAssado = (produto) => {
    setItens(prev => {
      const ex = prev.find(i => i.tipo === 'ASSADO' && i.produtoId === produto.id);
      if (ex) return prev.map(i => i === ex ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { uid: Date.now() + Math.random(), tipo: 'ASSADO', produtoId: produto.id, nome: produto.nome, preco: produto.preco, quantidade: 1, unidade: produto.unidade, emoji: produto.emoji }];
    });
  };

  // Adiciona produto normal (via busca)
  const addNormal = (produto) => {
    setItens(prev => {
      const ex = prev.find(i => i.tipo === 'NORMAL' && i.produtoNormalId === produto.id);
      if (ex) return prev.map(i => i === ex ? { ...i, quantidade: i.quantidade + 1 } : i);
      return [...prev, { uid: Date.now() + Math.random(), tipo: 'NORMAL', produtoNormalId: produto.id, nome: produto.nome, preco: produto.precoVenda, quantidade: 1, unidade: produto.unidade || 'UN', emoji: '📦' }];
    });
  };

  const remItem = (uid) => setItens(prev => {
    const ex = prev.find(i => i.uid === uid);
    if (ex?.quantidade <= 1) return prev.filter(i => i.uid !== uid);
    return prev.map(i => i.uid === uid ? { ...i, quantidade: i.quantidade - 1 } : i);
  });

  const addUm = (uid) => setItens(prev => prev.map(i => i.uid === uid ? { ...i, quantidade: i.quantidade + 1 } : i));

  // Subtotal: itens NORMAL + itens ASSADO UN (KG é "a pesar")
  const totalUN = itens.reduce((s, i) => {
    if (i.tipo === 'NORMAL') return s + i.preco * i.quantidade;
    return s + (i.unidade !== 'KG' ? i.preco * i.quantidade : 0);
  }, 0);
  const temKG = itens.some(i => i.tipo === 'ASSADO' && i.unidade === 'KG');

  const salvar = async () => {
    if (!form.nomeCliente.trim()) { alert('Informe o nome do cliente.'); return; }
    if (!itens.length) { alert('Adicione pelo menos um item.'); return; }
    setSalvando(true);
    try {
      // Mapeia itens para o formato do backend
      const itensApi = itens.map(i => i.tipo === 'NORMAL' ? {
        tipo: 'NORMAL',
        produtoNormalId: i.produtoNormalId,
        nome: i.nome, preco: i.preco, quantidade: i.quantidade,
        unidade: i.unidade, total: i.preco * i.quantidade,
      } : {
        tipo: 'ASSADO',
        produtoId: i.produtoId,
        quantidade: i.quantidade,
      });
      await api.post('/assados/comandas', { ...form, itens: itensApi });
      onSalvo();
    } catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>📋 Nova Reserva</p>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={lbl}>Nome do cliente *</label>
              <input style={inp} value={form.nomeCliente} onChange={e => campo('nomeCliente', e.target.value)} placeholder="Nome do cliente" autoFocus />
            </div>
            <div>
              <label style={lbl}>Telefone</label>
              <input style={inp} value={form.telefone} onChange={e => campo('telefone', e.target.value)} placeholder="(44) 99999-9999" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
              <input type="checkbox" id="pago" checked={form.pago} onChange={e => campo('pago', e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="pago" style={{ ...lbl, margin: 0, cursor: 'pointer', color: '#059669' }}>✅ Já pagou</label>
            </div>
          </div>

          {/* Produtos de Assados */}
          <div>
            <label style={lbl}>Assados *</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
              {produtos.map((p, i) => (
                <button key={p.id} onClick={() => addAssado(p)}
                  style={{ padding: '12px 8px', borderRadius: '10px', border: '2px solid transparent', background: CORES[i % CORES.length] + '18', color: CORES[i % CORES.length], fontWeight: 700, fontSize: '13px', cursor: 'pointer', textAlign: 'center' }}>
                  <div style={{ fontSize: '22px' }}>{p.emoji}</div>
                  <div>{p.nome}</div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>{BRL(p.preco)}{p.unidade === 'KG' ? '/kg' : ''}</div>
                  <div style={{ fontSize: '11px', opacity: 0.7 }}>Estq: {p.estoqueAtual} un</div>
                </button>
              ))}
            </div>
          </div>

          {/* Busca de produto normal */}
          <BuscaProdutoNormal onAdicionar={addNormal} />

          {/* Lista de itens do pedido */}
          {itens.length > 0 && (
            <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '12px', border: '1px solid #E2E8F0' }}>
              {itens.map(i => (
                <div key={i.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px' }}>{i.emoji} {i.nome}</span>
                    {i.tipo === 'NORMAL' && <span style={{ marginLeft: '6px', fontSize: '10px', padding: '1px 6px', borderRadius: '99px', background: '#DBEAFE', color: '#1E40AF', fontWeight: 700 }}>AÇOUGUE</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={() => remItem(i.uid)} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontWeight: 700 }}>−</button>
                    <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center' }}>{i.quantidade}</span>
                    <button onClick={() => addUm(i.uid)} style={{ width: '26px', height: '26px', borderRadius: '50%', border: '1px solid #E2E8F0', background: 'white', cursor: 'pointer', fontWeight: 700 }}>+</button>
                    <span style={{ fontWeight: 700, color: i.tipo === 'ASSADO' && i.unidade === 'KG' ? '#92400E' : i.tipo === 'NORMAL' ? '#1E40AF' : '#D97706', minWidth: '60px', textAlign: 'right', fontFamily: 'monospace', fontSize: (i.tipo === 'ASSADO' && i.unidade === 'KG') ? '11px' : '14px' }}>
                      {i.tipo === 'ASSADO' && i.unidade === 'KG' ? `A pesar (${BRL(i.preco)}/kg)` : BRL(i.preco * i.quantidade)}
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: '#D97706', fontFamily: 'monospace', fontSize: '16px' }}>{temKG ? (totalUN > 0 ? `${BRL(totalUN)} + a pesar` : 'A pesar') : BRL(totalUN)}</span>
              </div>
            </div>
          )}

          <div>
            <label style={lbl}>Observações</label>
            <input style={inp} value={form.observacoes} onChange={e => campo('observacoes', e.target.value)} placeholder="Ex: entregar às 12h" />
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px' }}>
          <button onClick={onFechar} style={{ ...btn('#F1F5F9', '#475569'), flex: 1 }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btn(form.pago ? '#059669' : '#D97706'), flex: 2, padding: '12px' }}>
            {salvando ? 'Salvando...' : form.pago ? '✅ Salvar (Pago)' : '📋 Salvar Reserva'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Dividir conta (componente discreto) ───────────────────────
function DividirConta({ total }) {
  const [aberto, setAberto] = useState(false);
  const [pessoas, setPessoas] = useState(2);
  const porPessoa = pessoas > 0 ? total / pessoas : total;

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)}
        style={{ background:'none', border:'none', color:'#94A3B8', fontSize:'11px', cursor:'pointer', padding:'4px 0', marginTop:'2px', textDecoration:'underline', textUnderlineOffset:'2px' }}>
        🍽️ Dividir conta
      </button>
    );
  }

  return (
    <div style={{ marginTop:'6px', padding:'8px 12px', background:'#F8FAFC', borderRadius:'8px', border:'1px solid #E2E8F0', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#475569' }}>
        <span>Dividir entre</span>
        <button onClick={() => setPessoas(p => Math.max(2, p - 1))}
          style={{ width:'22px', height:'22px', borderRadius:'50%', border:'1px solid #CBD5E1', background:'white', cursor:'pointer', fontWeight:700, fontSize:'13px' }}>−</button>
        <input type="number" value={pessoas} min="2"
          onChange={e => setPessoas(Math.max(2, parseInt(e.target.value) || 2))}
          style={{ width:'40px', textAlign:'center', padding:'3px', border:'1px solid #E2E8F0', borderRadius:'6px', fontWeight:700, fontSize:'13px' }} />
        <button onClick={() => setPessoas(p => p + 1)}
          style={{ width:'22px', height:'22px', borderRadius:'50%', border:'1px solid #CBD5E1', background:'white', cursor:'pointer', fontWeight:700, fontSize:'13px' }}>+</button>
        <span>pessoas</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
        <span style={{ fontWeight:800, color:'#059669', fontFamily:'monospace', fontSize:'14px' }}>
          {BRL(porPessoa)} cada
        </span>
        <button onClick={() => setAberto(false)}
          style={{ background:'none', border:'none', color:'#94A3B8', fontSize:'16px', cursor:'pointer', lineHeight:1, padding:0 }}>×</button>
      </div>
    </div>
  );
}

// ── Modal Ver / Editar Comanda ────────────────────────────────
function ModalComanda({ comanda, produtos, onAtualizado, onFechar }) {
  const [pagando, setPagando] = useState(false);
  const [entregando, setEntregando] = useState(false);
  const [forma, setForma] = useState('DINHEIRO');
  const [pesos, setPesos] = useState({});  // itemId -> string
  const [scanBuffer, setScanBuffer] = useState('');
  const scanTimer = useRef(null);

  const itensKG = comanda.itens.filter(i => i.tipo !== 'NORMAL' && i.unidade === 'KG' && !i.pesoKg);
  const temKG   = itensKG.length > 0 && !comanda.pago;
  const todosPreenchidos = itensKG.every(i => parseFloat(pesos[i.id]) > 0);

  // Scanner de etiqueta da balança
  useEffect(() => {
    if (comanda.pago) return;
    const handleKey = (e) => {
      if (e.key === 'Enter') {
        const code = scanBuffer.trim();
        setScanBuffer('');
        clearTimeout(scanTimer.current);
        if (!code) return;
        // Etiqueta de balança: começa com 2 e tem 13 dígitos
        if (/^2\d{12}$/.test(code)) {
          const valorTotal = parseInt(code.substring(7, 12), 10) / 100;
          // Tenta preencher o item KG com menor peso ainda vazio
          const itemPendente = itensKG.find(i => !parseFloat(pesos[i.id]));
          if (itemPendente && itemPendente.preco > 0) {
            const pesoCalculado = +(valorTotal / itemPendente.preco).toFixed(3);
            if (pesoCalculado > 0) {
              setPesos(prev => ({ ...prev, [itemPendente.id]: String(pesoCalculado) }));
            }
          }
        }
      } else if (e.key.length === 1) {
        setScanBuffer(p => p + e.key);
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => setScanBuffer(''), 500);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(scanTimer.current); };
  }, [scanBuffer, itensKG, pesos, comanda.pago]);

  const totalCalculado = comanda.itens.reduce((s, i) => {
    if (i.tipo !== 'NORMAL' && i.unidade === 'KG') {
      const peso = i.pesoKg || parseFloat(pesos[i.id]) || 0;
      return s + i.preco * peso;
    }
    return s + i.total;
  }, 0);

  const pagar = async () => {
    if (temKG && !todosPreenchidos) { alert('Informe o peso de todos os itens por KG.'); return; }
    setPagando(true);
    try {
      const itensComPeso = comanda.itens.map(i => ({
        itemId: i.id,
        pesoKg: i.unidade === 'KG' ? (parseFloat(pesos[i.id]) || null) : null,
      }));
      await api.patch(`/assados/comandas/${comanda.id}/pagar`, { formaPagamento: forma, itensComPeso });
      onAtualizado();
    }
    catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setPagando(false); }
  };

  const entregar = async () => {
    if (!comanda.pago && !confirm('Esta reserva ainda não foi paga. Marcar como entregue mesmo assim?')) return;
    setEntregando(true);
    try { await api.patch(`/assados/comandas/${comanda.id}/entregar`); onAtualizado(); }
    catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setEntregando(false); }
  };

  const addItem = async (produto) => {
    try { await api.post(`/assados/comandas/${comanda.id}/itens`, { produtoId: produto.id, quantidade: 1 }); onAtualizado(); }
    catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
  };

  const addItemNormal = async (produto) => {
    try { await api.post(`/assados/comandas/${comanda.id}/itens-normais`, { produtoNormalId: produto.id, quantidade: 1 }); onAtualizado(); }
    catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
  };

  const remItem = async (itemId) => {
    try { await api.delete(`/assados/comandas/${comanda.id}/itens/${itemId}`); onAtualizado(); }
    catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>{comanda.nomeCliente}</p>
            {comanda.telefone && <p style={{ fontSize: '12px', color: '#64748B' }}>📞 {comanda.telefone}</p>}
          </div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Itens */}
          <div style={{ marginBottom: '16px' }}>
            {comanda.itens.map(i => (
              <div key={i.id} style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{i.nome} × {i.quantidade} {i.tipo === 'NORMAL' ? <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '99px', background: '#DBEAFE', color: '#1E40AF', fontWeight: 700, marginLeft: '4px' }}>AÇOUGUE</span> : i.unidade === 'KG' ? <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 700 }}>• por KG</span> : ''}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, color: i.tipo === 'NORMAL' ? '#1E40AF' : '#D97706', fontFamily: 'monospace' }}>
                      {i.tipo !== 'NORMAL' && i.unidade === 'KG'
                        ? (i.pesoKg ? BRL(i.preco * i.pesoKg) : (parseFloat(pesos[i.id]) > 0 ? BRL(i.preco * parseFloat(pesos[i.id])) : '⚖ A pesar'))
                        : BRL(i.total)}
                    </span>
                    {!comanda.pago && <button onClick={() => remItem(i.id)} style={{ background: 'none', border: 'none', color: '#CBD5E1', fontSize: '18px', cursor: 'pointer' }}>×</button>}
                  </div>
                </div>
                {/* Campo de peso para itens ASSADO KG não pagos */}
                {i.tipo !== 'NORMAL' && i.unidade === 'KG' && !comanda.pago && !i.pesoKg && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '11px', color: '#92400E', fontWeight: 600 }}>📷 Scaneie a etiqueta ou digite o peso:</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFFBEB', padding: '8px 10px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                      <span style={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>⚖ Peso:</span>
                      <input
                        type="number" step="0.001" min="0"
                        value={pesos[i.id] || ''}
                        onChange={e => setPesos(prev => ({ ...prev, [i.id]: e.target.value }))}
                        placeholder="0.000"
                        style={{ width: '110px', padding: '6px 8px', border: '1.5px solid #F59E0B', borderRadius: '6px', fontSize: '14px', fontFamily: 'monospace', outline: 'none', fontWeight: 700 }}
                        autoFocus={i.id === comanda.itens.filter(x => x.unidade === 'KG')[0]?.id}
                      />
                      <span style={{ fontSize: '11px', color: '#92400E' }}>kg</span>
                      {parseFloat(pesos[i.id]) > 0 && (
                        <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700 }}>= {BRL(i.preco * parseFloat(pesos[i.id]))}</span>
                      )}
                    </div>
                  </div>
                )}
                {/* Peso já registrado */}
                {i.tipo !== 'NORMAL' && i.unidade === 'KG' && i.pesoKg && (
                  <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>⚖ {i.pesoKg.toFixed(3)} kg × {BRL(i.preco)}/kg</p>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', fontWeight: 800, fontSize: '16px' }}>
              <span>Total</span>
              <span style={{ color: '#D97706', fontFamily: 'monospace' }}>{BRL(totalCalculado)}</span>
            </div>
          </div>

          {/* Adicionar itens (só se não entregue e não paga) */}
          {comanda.status !== 'ENTREGUE' && !comanda.pago && (
            <div style={{ marginBottom: '16px' }}>
              {produtos.length > 0 && (
                <>
                  <p style={{ ...lbl, marginBottom: '8px' }}>Adicionar assado</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
                    {produtos.map((p, i) => (
                      <button key={p.id} onClick={() => addItem(p)} style={{ padding: '8px', borderRadius: '8px', border: '1.5px solid ' + CORES[i % CORES.length] + '40', background: CORES[i % CORES.length] + '10', color: CORES[i % CORES.length], fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>
                        {p.emoji} {p.nome}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <BuscaProdutoNormal onAdicionar={addItemNormal} />
            </div>
          )}

          {/* Observações */}
          {comanda.observacoes && (
            <p style={{ fontSize: '13px', color: '#64748B', fontStyle: 'italic', background: '#FFF7ED', padding: '10px 12px', borderRadius: '8px' }}>
              📝 {comanda.observacoes}
            </p>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0' }}>
          {!comanda.pago && (
            <div style={{ marginBottom: '12px' }}>
              <DividirConta total={totalCalculado} />
              <p style={{ ...lbl, marginBottom: '8px', marginTop: '10px' }}>Forma de pagamento</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' }}>
                {FORMAS.map(f => (
                  <button key={f} onClick={() => setForma(f)} style={{ padding: '8px', borderRadius: '8px', border: `2px solid ${forma === f ? '#059669' : '#E2E8F0'}`, background: forma === f ? '#F0FDF4' : 'white', color: forma === f ? '#059669' : '#64748B', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                    {FORMA_ICON[f]} {f}
                  </button>
                ))}
              </div>
              <button onClick={pagar} disabled={pagando} style={{ ...btn('#059669'), width: '100%', padding: '12px', fontSize: '14px', marginBottom: '8px' }}>
                {pagando ? 'Registrando...' : '💰 Registrar Pagamento'}
              </button>
            </div>
          )}

          {comanda.status !== 'ENTREGUE' && (
            <button onClick={entregar} disabled={entregando} style={{ ...btn(comanda.pago ? '#1E293B' : '#F1F5F9', comanda.pago ? 'white' : '#475569'), width: '100%', padding: '12px', fontSize: '14px' }}>
              {entregando ? 'Registrando...' : '✅ Marcar como Entregue'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal Fechar Sessão ───────────────────────────────────────
function ModalFecharSessao({ resumo, onFechar, onFechada }) {
  const [lancarCaixa, setLancarCaixa] = useState(true);
  const [fechando, setFechando] = useState(false);
  const temEstoque = resumo.estoqueRestante?.length > 0;

  const fechar = async () => {
    if (!confirm('Fechar a sessão de assados?')) return;
    setFechando(true);
    try {
      await api.post('/assados/fechar', { lancarNoCaixa: lancarCaixa, transferirEstoque: false });
      onFechada();
    } catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setFechando(false); }
  };

  const fpIcon = { DINHEIRO:'💵', PIX:'📱', DEBITO:'💳', CREDITO:'💳', VOUCHER:'🎫' };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'780px', maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid #E2E8F0', flexShrink:0, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontWeight:800, fontSize:'17px', color:'#1E293B' }}>🔒 Fechar Sessão de Assados</p>
          <button onClick={onFechar} style={{ background:'none', border:'none', fontSize:'22px', cursor:'pointer', color:'#94A3B8', lineHeight:1 }}>×</button>
        </div>

        {/* Body — duas colunas */}
        <div style={{ flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0', minHeight:0 }}>

          {/* COLUNA ESQUERDA */}
          <div style={{ padding:'18px 20px', borderRight:'1px solid #F1F5F9', display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* 4 métricas */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <div style={{ background:'#FFF7ED', borderRadius:'10px', padding:'10px 12px', border:'1px solid #FED7AA', textAlign:'center' }}>
                <p style={{ fontSize:'10px', color:'#92400E', fontWeight:700, textTransform:'uppercase' }}>Total Assados</p>
                <p style={{ fontWeight:800, color:'#D97706', fontFamily:'monospace', fontSize:'17px', marginTop:'2px' }}>{BRL(resumo.totalAssados)}</p>
              </div>
              <div style={{ background:'#F0FDF4', borderRadius:'10px', padding:'10px 12px', border:'1px solid #86EFAC', textAlign:'center' }}>
                <p style={{ fontSize:'10px', color:'#166534', fontWeight:700, textTransform:'uppercase' }}>Total Geral</p>
                <p style={{ fontWeight:800, color:'#059669', fontFamily:'monospace', fontSize:'17px', marginTop:'2px' }}>{BRL(resumo.totalGeral)}</p>
              </div>
              <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'10px 12px', border:'1px solid #E2E8F0', textAlign:'center' }}>
                <p style={{ fontSize:'10px', color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Comandas</p>
                <p style={{ fontWeight:800, color:'#1E293B', fontSize:'17px', marginTop:'2px' }}>{resumo.totalComandas}</p>
              </div>
              <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'10px 12px', border:'1px solid #E2E8F0', textAlign:'center' }}>
                <p style={{ fontSize:'10px', color:'#64748B', fontWeight:700, textTransform:'uppercase' }}>Ticket Médio</p>
                <p style={{ fontWeight:800, color:'#1E293B', fontFamily:'monospace', fontSize:'17px', marginTop:'2px' }}>{BRL(resumo.ticketMedio)}</p>
              </div>
            </div>

            {/* Formas de pagamento */}
            {resumo.pagamentos && Object.keys(resumo.pagamentos).length > 0 && (
              <div style={{ background:'#F8FAFC', borderRadius:'10px', padding:'12px 14px', border:'1px solid #E2E8F0' }}>
                <p style={{ fontSize:'10px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Formas de pagamento</p>
                {Object.entries(resumo.pagamentos).map(([forma, valor]) => (
                  <div key={forma} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #F1F5F9' }}>
                    <span style={{ fontSize:'13px', color:'#475569' }}>{fpIcon[forma] || '💰'} {forma}</span>
                    <span style={{ fontWeight:700, fontFamily:'monospace', fontSize:'13px', color:'#1E293B' }}>{BRL(valor)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Normal */}
            {resumo.totalNormal > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#F1F5F9', borderRadius:'8px' }}>
                <span style={{ color:'#64748B', fontSize:'12px' }}>Itens do sistema normal</span>
                <span style={{ fontWeight:700, color:'#475569', fontFamily:'monospace', fontSize:'12px' }}>{BRL(resumo.totalNormal)}</span>
              </div>
            )}

            {/* Lançar no caixa */}
            {resumo.totalAssados > 0 && (
              <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'10px 12px', background: lancarCaixa ? '#F0FDF4' : '#F8FAFC', borderRadius:'10px', border:`1.5px solid ${lancarCaixa ? '#86EFAC' : '#E2E8F0'}` }}>
                <input type="checkbox" checked={lancarCaixa} onChange={e => setLancarCaixa(e.target.checked)} style={{ width:'16px', height:'16px' }} />
                <div>
                  <p style={{ fontWeight:700, fontSize:'12px', color:'#1E293B' }}>Lançar {BRL(resumo.totalAssados)} no caixa</p>
                  <p style={{ fontSize:'11px', color:'#64748B' }}>Registra como entrada no caixa principal</p>
                </div>
              </label>
            )}
          </div>

          {/* COLUNA DIREITA */}
          <div style={{ padding:'18px 20px', display:'flex', flexDirection:'column', gap:'14px', overflowY:'auto' }}>

            {/* Por produto */}
            {resumo.porProduto?.length > 0 && (
              <div>
                <p style={{ fontSize:'10px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Por produto</p>
                {resumo.porProduto.map((p, i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #F1F5F9' }}>
                    <div>
                      <p style={{ fontWeight:700, fontSize:'13px', color:'#1E293B' }}>{p.nome}</p>
                      <p style={{ fontSize:'11px', color:'#64748B', marginTop:'2px' }}>
                        {p.unidade === 'KG'
                          ? `${p.totalKg.toFixed(3)} kg · R$ ${p.precoMedio}/kg médio`
                          : `${p.totalUn} unidade${p.totalUn !== 1 ? 's' : ''}`}
                        {' · '}{p.qtdComandas} venda{p.qtdComandas !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span style={{ fontWeight:800, color:'#D97706', fontFamily:'monospace', fontSize:'14px', whiteSpace:'nowrap', marginLeft:'12px' }}>{BRL(p.receita)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Sobras */}
            {temEstoque && (
              <div style={{ background:'#FFFBEB', borderRadius:'10px', padding:'12px 14px', border:'1px solid #FDE68A' }}>
                <p style={{ fontWeight:700, fontSize:'11px', color:'#92400E', marginBottom:'8px', textTransform:'uppercase' }}>📦 Sobras de estoque</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                  {resumo.estoqueRestante.map((e, i) => (
                    <span key={i} style={{ fontSize:'12px', padding:'3px 10px', background:'#FEF3C7', borderRadius:'99px', color:'#92400E', fontWeight:600 }}>
                      {e.emoji || '🍗'} {e.nome}: {e.quantidade} un
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', borderTop:'1px solid #E2E8F0', display:'flex', gap:'10px', flexShrink:0 }}>
          <button onClick={onFechar} style={{ ...btn('#F1F5F9', '#475569'), flex:1 }}>Voltar</button>
          <button onClick={fechar} disabled={fechando} style={{ ...btn('#DC2626'), flex:2, padding:'12px' }}>
            {fechando ? 'Fechando...' : '🔒 Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Frente de Caixa dos Assados ───────────────────────────────
function FrenteAssados({ sessaoId, produtos, onVenda }) {
  const [carrinho, setCarrinho] = useState([]);
  const [forma, setForma] = useState('DINHEIRO');
  const [valorPago, setValorPago] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [scanBuffer, setScanBuffer] = useState('');
  const scanRef = useRef(null);
  const scanTimer = useRef(null);

  // Auto-foco no campo de scan
  useEffect(() => { scanRef.current?.focus(); }, []);

  const total = carrinho.reduce((s, i) => s + i.total, 0);
  const troco = forma === 'DINHEIRO' && valorPago ? Math.max(0, parseFloat(valorPago) - total) : 0;

  const addAssado = (produto) => {
    if (produto.estoqueAtual <= 0) { alert('Sem estoque!'); return; }
    setCarrinho(prev => {
      const ex = prev.find(i => i.produtoAssadoId === produto.id);
      if (ex) return prev.map(i => i.produtoAssadoId === produto.id ? { ...i, quantidade: i.quantidade + 1, total: (i.quantidade + 1) * i.preco } : i);
      return [...prev, { uid: Date.now(), produtoAssadoId: produto.id, produtoNormalId: null, nome: produto.nome, preco: produto.preco, quantidade: 1, unidade: produto.unidade, total: produto.preco, tipo: 'ASSADO', emoji: produto.emoji }];
    });
  };

  const addNormal = (produto, balancaInfo) => {
    const qtd = balancaInfo?.pesoCalculado || 1;
    const preco = produto.precoVenda;
    const total = balancaInfo?.valorTotal || preco * qtd;
    setCarrinho(prev => [...prev, {
      uid: Date.now(), produtoAssadoId: null, produtoNormalId: produto.id,
      nome: produto.nome, preco, quantidade: qtd, unidade: produto.unidade, total, tipo: 'NORMAL', emoji: '📦',
    }]);
  };

  const remItem = (uid) => setCarrinho(prev => prev.filter(i => i.uid !== uid));

  // Scanner
  const handleScanKey = useCallback(async (e) => {
    if (e.key === 'Enter') {
      const code = scanBuffer.trim();
      setScanBuffer('');
      if (!code) return;
      try {
        const { data } = await api.get(`/assados/scan/${code}`);
        if (data.tipo === 'ASSADO') addAssado(data.produto);
        else addNormal(data.produto, data.balancaInfo);
      } catch { alert('Produto não encontrado para o código: ' + code); }
    } else if (e.key.length === 1) {
      setScanBuffer(p => p + e.key);
      clearTimeout(scanTimer.current);
      scanTimer.current = setTimeout(() => setScanBuffer(''), 500);
    }
  }, [scanBuffer]);

  useEffect(() => {
    window.addEventListener('keydown', handleScanKey);
    return () => window.removeEventListener('keydown', handleScanKey);
  }, [handleScanKey]);

  const finalizar = async () => {
    if (!carrinho.length) return;
    if (forma === 'DINHEIRO' && valorPago && parseFloat(valorPago) < total) { alert('Valor pago insuficiente.'); return; }
    setFinalizando(true);
    try {
      await api.post('/assados/venda-direta', { itens: carrinho, formaPagamento: forma, valorPago: parseFloat(valorPago) || total });
      setCarrinho([]);
      setValorPago('');
      setForma('DINHEIRO');
      onVenda();
    } catch (e) { alert(e.response?.data?.erro || 'Erro ao finalizar.'); }
    finally { setFinalizando(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', background: '#FFFBF5' }}>
        <p style={{ fontWeight: 800, fontSize: '14px', color: '#1E293B' }}>⚡ Venda Rápida</p>
        <p style={{ fontSize: '11px', color: '#94A3B8' }}>Scanner ativo · aponte o leitor</p>
      </div>

      {/* Botões grandes dos produtos */}
      <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {produtos.map((p, i) => {
          const cor = CORES[i % CORES.length];
          const semEstoque = p.estoqueAtual <= 0;
          return (
            <button key={p.id} onClick={() => addAssado(p)} disabled={semEstoque}
              style={{ padding: '12px 8px', borderRadius: '12px', border: `2px solid ${cor}30`, background: semEstoque ? '#F1F5F9' : cor + '15', color: semEstoque ? '#94A3B8' : cor, fontWeight: 700, fontSize: '13px', cursor: semEstoque ? 'not-allowed' : 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '24px' }}>{p.emoji}</div>
              <div style={{ fontSize: '12px', marginTop: '2px' }}>{p.nome}</div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{BRL(p.preco)}</div>
              <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                {semEstoque ? '❌ Esgotado' : `📦 ${p.estoqueAtual} un`}
              </div>
            </button>
          );
        })}
        {produtos.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '20px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
            Nenhum produto cadastrado.<br/>Clique em 📦 Produtos para adicionar.
          </div>
        )}
      </div>

      {/* Carrinho */}
      <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #F1F5F9', padding: '8px 12px', minHeight: 0 }}>
        {carrinho.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#CBD5E1', fontSize: '13px' }}>
            Carrinho vazio
          </div>
        ) : (
          carrinho.map(item => (
            <div key={item.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 4px', borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: '13px', color: '#1E293B' }}>{item.emoji} {item.nome}</p>
                <p style={{ fontSize: '11px', color: item.tipo === 'NORMAL' ? '#64748B' : '#D97706' }}>
                  {item.tipo === 'NORMAL' ? '📦 Produto normal' : '🔥 Assado'} · {item.quantidade} {item.unidade === 'KG' ? 'kg' : 'un'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1E293B', fontSize: '14px' }}>{BRL(item.total)}</span>
                <button onClick={() => remItem(item.uid)} style={{ background: 'none', border: 'none', color: '#CBD5E1', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Total + pagamento + finalizar */}
      {carrinho.length > 0 && (
        <div style={{ borderTop: '2px solid #E2E8F0', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#64748B' }}>TOTAL</span>
            <span style={{ fontWeight: 800, fontSize: '20px', color: '#1E293B', fontFamily: 'monospace' }}>{BRL(total)}</span>
          </div>
          <DividirConta total={total} />
          <div style={{ marginBottom: '10px' }} />

          {/* Formas de pagamento */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px', marginBottom: '8px' }}>
            {FORMAS.map(f => (
              <button key={f} onClick={() => setForma(f)} style={{ padding: '7px 4px', borderRadius: '8px', border: `2px solid ${forma === f ? '#D97706' : '#E2E8F0'}`, background: forma === f ? '#FFF7ED' : 'white', color: forma === f ? '#D97706' : '#64748B', fontWeight: 700, fontSize: '11px', cursor: 'pointer' }}>
                {FORMA_ICON[f]}<br />{f}
              </button>
            ))}
          </div>

          {forma === 'DINHEIRO' && (
            <div style={{ marginBottom: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input style={{ ...inp, flex: 1 }} type="number" value={valorPago} onChange={e => setValorPago(e.target.value)} placeholder="Valor recebido" />
              {troco > 0 && <span style={{ fontWeight: 700, color: '#059669', fontSize: '13px', whiteSpace: 'nowrap' }}>Troco: {BRL(troco)}</span>}
            </div>
          )}

          <button onClick={finalizar} disabled={finalizando} style={{ ...btn('#D97706'), width: '100%', padding: '14px', fontSize: '16px' }}>
            {finalizando ? 'Finalizando...' : `💰 FINALIZAR ${BRL(total)}`}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Card de Reserva ───────────────────────────────────────────
function CardReserva({ comanda, onClick }) {
  const bg = comanda.pago ? '#F0FDF4' : '#FFFBF5';
  const border = comanda.pago ? '#86EFAC' : '#FED7AA';
  const statusBg = comanda.pago ? '#DCFCE7' : '#FEF3C7';
  const statusColor = comanda.pago ? '#166534' : '#92400E';

  return (
    <div onClick={onClick} style={{ background: bg, border: `2px solid ${border}`, borderRadius: '14px', padding: '14px', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <p style={{ fontWeight: 800, fontSize: '15px', color: '#1E293B' }}>{comanda.nomeCliente}</p>
        <span style={{ background: statusBg, color: statusColor, borderRadius: '99px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
          {comanda.pago ? '✅ PAGO' : '⏳ RESERVADO'}
        </span>
      </div>
      {comanda.itens?.map(i => (
        <p key={i.id} style={{ fontSize: '12px', color: '#64748B' }}>• {i.nome} × {i.quantidade} {i.unidade === 'KG' && !i.pesoKg ? <span style={{ color: '#92400E', fontWeight: 600 }}>— a pesar</span> : ''}</p>
      ))}
      {comanda.observacoes && <p style={{ fontSize: '11px', color: '#94A3B8', fontStyle: 'italic', marginTop: '4px' }}>📝 {comanda.observacoes}</p>}
      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '16px', color: '#D97706', fontFamily: 'monospace' }}>{comanda.itens?.some(i => i.unidade === 'KG' && !i.pesoKg) && !comanda.pago ? '⚖ A pesar' : BRL(comanda.total)}</span>
        <span style={{ fontSize: '11px', color: '#94A3B8' }}>Toque para detalhes</span>
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────
export default function ModuloAssados() {
  const [sessao, setSessao]           = useState(null);
  const [produtos, setProdutos]       = useState([]);
  const [comandas, setComandas]       = useState([]);
  const [entregues, setEntregues]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [verEntregues, setVerEntregues] = useState(false);
  const [resumo, setResumo]           = useState(null);

  // Modais
  const [modalAbrir, setModalAbrir]         = useState(false);
  const [modalProdutos, setModalProdutos]   = useState(false);
  const [modalReserva, setModalReserva]     = useState(false);
  const [modalComanda, setModalComanda]     = useState(null);
  const [modalFechar, setModalFechar]       = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/assados/sessao-ativa');
      setSessao(data.sessao);
      setProdutos(data.sessao?.produtos || []);
      setComandas(data.sessao?.comandas || []);
      setEntregues(data.entregues || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirModalFechar = async () => {
    try {
      const { data } = await api.get('/assados/resumo');
      setResumo(data);
      setModalFechar(true);
    } catch (e) { alert('Erro ao carregar resumo.'); }
  };

  const onFechada = () => {
    // Salva template para reabrir na próxima sessão com estoque zerado
    if (produtos.length > 0) {
      try {
        const tpl = produtos.map(p => ({
          nome: p.nome, preco: p.preco, unidade: p.unidade,
          emoji: p.emoji || '🍗', codigoBarras: p.codigoBarras || '',
          produtoOrigemId: p.produtoOrigemId || null,
        }));
        localStorage.setItem('assados_template_v1', JSON.stringify(tpl));
      } catch (err) { console.error('Erro ao salvar template', err); }
    }
    setModalFechar(false); setSessao(null); setProdutos([]); setComandas([]); setEntregues([]);
  };

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8', fontSize: '16px' }}>Carregando...</div>;
  }

  // ── Tela de sessão não aberta ──
  if (!sessao) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#FFFBF5' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '80px', marginBottom: '16px' }}>🔥</div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#1E293B', marginBottom: '8px' }}>Módulo Assados</h1>
            <p style={{ color: '#64748B', fontSize: '15px', marginBottom: '32px', maxWidth: '360px', lineHeight: 1.6 }}>
              Controle de estoque, reservas e financeiro separado para o dia dos assados.
            </p>
            <button onClick={() => setModalAbrir(true)} style={{ ...btn('#D97706'), padding: '16px 40px', fontSize: '16px', borderRadius: '14px' }}>
              🔥 Abrir Sessão de Assados
            </button>
          </div>
        </div>
        {modalAbrir && <ModalAbrirSessao onAberta={() => { setModalAbrir(false); carregar(); }} onFechar={() => setModalAbrir(false)} />}
      </>
    );
  }

  // ── Módulo aberto ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#FFF7ED', overflow: 'hidden' }}>
      {/* Modais */}
      {modalProdutos && <ModalProdutos produtos={produtos} onAtualizado={() => { setModalProdutos(false); carregar(); }} onFechar={() => setModalProdutos(false)} />}
      {modalReserva  && <ModalNovaReserva produtos={produtos} onSalvo={() => { setModalReserva(false); carregar(); }} onFechar={() => setModalReserva(false)} />}
      {modalComanda  && <ModalComanda comanda={modalComanda} produtos={produtos} onAtualizado={() => { setModalComanda(null); carregar(); }} onFechar={() => setModalComanda(null)} />}
      {modalFechar && resumo && <ModalFecharSessao resumo={resumo} onFechar={() => setModalFechar(false)} onFechada={onFechada} />}

      {/* Header */}
      <div style={{ background: '#1E1008', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '22px' }}>🔥</span>
          <div>
            <p style={{ fontWeight: 800, fontSize: '15px', color: '#FDE68A' }}>Assados — Sessão Aberta</p>
            <p style={{ fontSize: '11px', color: '#92400E' }}>
              {produtos.map(p => `${p.emoji} ${p.nome}: ${p.estoqueAtual}un`).join('  ·  ')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setModalProdutos(true)} style={{ ...btn('#2D1A0A', '#FDE68A'), border: '1px solid #92400E', fontSize: '12px' }}>📦 Produtos</button>
          <button onClick={abrirModalFechar} style={{ ...btn('#DC2626'), fontSize: '12px' }}>🔒 Fechar Sessão</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '16px', padding: '16px', overflow: 'hidden', minHeight: 0 }}>

        {/* Esquerda: Reservas */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
            <p style={{ fontWeight: 800, fontSize: '15px', color: '#1E293B' }}>
              📋 Reservas <span style={{ fontWeight: 500, color: '#64748B', fontSize: '13px' }}>({comandas.length})</span>
            </p>
            <button onClick={() => setModalReserva(true)} style={{ ...btn('#D97706'), padding: '8px 14px', fontSize: '13px' }}>+ Nova Reserva</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px', minHeight: 0 }}>
            {comandas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                <p style={{ fontSize: '36px', marginBottom: '8px' }}>📋</p>
                <p style={{ fontSize: '13px' }}>Nenhuma reserva ainda</p>
              </div>
            ) : (
              comandas.map(c => <CardReserva key={c.id} comanda={c} onClick={() => setModalComanda(c)} />)
            )}

            {/* Entregues */}
            {entregues.length > 0 && (
              <div>
                <button onClick={() => setVerEntregues(v => !v)} style={{ width: '100%', padding: '10px', background: '#F1F5F9', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', color: '#475569' }}>
                  {verEntregues ? '▲' : '▼'} Ver Entregues ({entregues.length})
                </button>
                {verEntregues && entregues.map(c => (
                  <div key={c.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '12px', marginTop: '8px', opacity: 0.7 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p style={{ fontWeight: 700, color: '#475569', fontSize: '14px' }}>✅ {c.nomeCliente}</p>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#475569' }}>{BRL(c.total)}</span>
                    </div>
                    {c.itens.map(i => <p key={i.id} style={{ fontSize: '11px', color: '#94A3B8' }}>• {i.nome} × {i.quantidade}</p>)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Direita: Frente de caixa */}
        <FrenteAssados sessaoId={sessao.id} produtos={produtos} onVenda={carregar} />
      </div>
    </div>
  );
}
