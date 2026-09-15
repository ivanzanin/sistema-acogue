// frontend/src/pages/ContasPagar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const fmt  = v  => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtD = d  => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
const TODAY = new Date().toISOString().split('T')[0];

const CATEGORIAS = ['Mercadoria', 'Aluguel', 'Energia', 'Água', 'Gás', 'Funcionários', 'Impostos', 'Manutenção', 'Embalagens', 'Outros'];
const FORMAS_PAG = ['Dinheiro', 'Pix', 'Boleto', 'Transferência Bancária', 'Cheque', 'Cartão de Débito', 'Cartão de Crédito'];

const STATUS_STYLE = {
  PAGO:      { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0', icon: '✅' },
  PENDENTE:  { bg: '#FEF3C7', color: '#92400E', border: '#FDE68A', icon: '🕐' },
  VENCIDO:   { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA', icon: '🔴' },
  CANCELADO: { bg: '#F1F5F9', color: '#475569', border: '#CBD5E1', icon: '✖' },
};

const inp = {
  width: '100%', background: 'white', border: '1.5px solid #E2E8F0',
  borderRadius: '8px', padding: '9px 12px', fontSize: '14px',
  color: '#1E293B', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748B',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '5px',
};
const btnBase = {
  border: 'none', borderRadius: '8px', fontSize: '13px',
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s',
};

function Badge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.PENDENTE;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: '99px', padding: '3px 10px', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── MODAL: NOVA / EDITAR CONTA ───────────────────────────────
function ModalConta({ conta, fornecedores, onSalvar, onFechar }) {
  const novo = !conta?.id;
  const [form, setForm] = useState(conta || {
    fornecedorId: '', descricao: '', valor: '', categoria: 'Mercadoria',
    dataEmissao: TODAY, dataVencimento: '', observacoes: '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const campo = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const salvar = async () => {
    if (!form.descricao?.trim()) { setErro('Informe a descrição.'); return; }
    if (!form.dataVencimento)    { setErro('Informe o vencimento.'); return; }
    if (!form.valor || Number(form.valor) <= 0) { setErro('Informe um valor válido.'); return; }
    setSalvando(true); setErro(null);
    try {
      if (novo) await api.post('/contas-pagar', form);
      else      await api.patch(`/contas-pagar/${conta.id}`, form);
      onSalvar();
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao salvar.');
    } finally { setSalvando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '20px' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>{novo ? '+ Nova Conta a Pagar' : 'Editar Conta'}</p>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#94A3B8' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Fornecedor */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Fornecedor</label>
            <select style={inp} value={form.fornecedorId || ''} onChange={e => campo('fornecedorId', e.target.value)}>
              <option value="">— Sem fornecedor —</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Descrição *</label>
            <input style={inp} value={form.descricao} onChange={e => campo('descricao', e.target.value)} placeholder="Ex: NF 001234 — Carne bovina" />
          </div>

          {/* Valor */}
          <div>
            <label style={lbl}>Valor (R$) *</label>
            <input style={inp} type="number" step="0.01" min="0" value={form.valor} onChange={e => campo('valor', e.target.value)} placeholder="0,00" />
          </div>

          {/* Categoria */}
          <div>
            <label style={lbl}>Categoria</label>
            <select style={inp} value={form.categoria} onChange={e => campo('categoria', e.target.value)}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          {/* Emissão */}
          <div>
            <label style={lbl}>Data de Emissão</label>
            <input style={inp} type="date" value={form.dataEmissao?.split('T')[0] || ''} onChange={e => campo('dataEmissao', e.target.value)} />
          </div>

          {/* Vencimento */}
          <div>
            <label style={lbl}>Vencimento *</label>
            <input style={inp} type="date" value={form.dataVencimento?.split('T')[0] || ''} onChange={e => campo('dataVencimento', e.target.value)} />
          </div>

          {/* Observações */}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={lbl}>Observações</label>
            <textarea style={{ ...inp, minHeight: '64px', resize: 'vertical' }} value={form.observacoes || ''} onChange={e => campo('observacoes', e.target.value)} placeholder="Número NF, condição negociada, etc." />
          </div>

          {erro && (
            <div style={{ gridColumn: '1/-1', padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', color: '#991B1B', fontSize: '13px', fontWeight: 600 }}>
              ❌ {erro}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ ...btnBase, padding: '10px 20px', background: 'white', border: '1.5px solid #E2E8F0', color: '#475569' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} style={{ ...btnBase, padding: '10px 24px', background: '#D97706', color: 'white', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL: REGISTRAR PAGAMENTO ───────────────────────────────
function ModalPagar({ conta, onSalvar, onFechar }) {
  const [form, setForm] = useState({ dataPagamento: TODAY, formaPagamento: 'Pix' });
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    setSalvando(true);
    try {
      await api.patch(`/contas-pagar/${conta.id}/pagar`, form);
      onSalvar();
    } catch (e) { alert(e.response?.data?.erro || 'Erro.'); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}>
      <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, fontSize: '16px', color: '#1E293B' }}>💸 Registrar Pagamento</p>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: '#94A3B8' }}>×</button>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Info da conta */}
          <div style={{ background: '#F8FAFC', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
            <p style={{ fontWeight: 700, color: '#1E293B', fontSize: '14px' }}>{conta.descricao}</p>
            {conta.fornecedor && <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>🏭 {conta.fornecedor.nome}</p>}
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#D97706', marginTop: '8px' }}>{fmt(conta.valor)}</p>
            <p style={{ fontSize: '12px', color: conta.status === 'VENCIDO' ? '#991B1B' : '#94A3B8', marginTop: '4px' }}>
              {conta.status === 'VENCIDO' ? '🔴 Venceu em' : '📅 Vence em'} {fmtD(conta.dataVencimento)}
            </p>
          </div>

          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={lbl}>Data do Pagamento</label>
              <input style={inp} type="date" value={form.dataPagamento} onChange={e => setForm(p => ({ ...p, dataPagamento: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Forma de Pagamento *</label>
              <select style={inp} value={form.formaPagamento} onChange={e => setForm(p => ({ ...p, formaPagamento: e.target.value }))}>
                {FORMAS_PAG.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onFechar} style={{ ...btnBase, padding: '10px 20px', background: 'white', border: '1.5px solid #E2E8F0', color: '#475569' }}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando} style={{ ...btnBase, padding: '10px 24px', background: '#16A34A', color: 'white', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? 'Registrando...' : '✅ Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CARDS DE KPI ─────────────────────────────────────────────
function KpiCard({ icon, label, valor, sub, cor, bg }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px 20px', borderTop: `3px solid ${cor}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '22px' }}>{icon}</span>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      </div>
      <p style={{ fontSize: '22px', fontWeight: 800, color: cor }}>{valor}</p>
      {sub && <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

// ─── TABELA DE CONTAS ─────────────────────────────────────────
function TabelaContas({ contas, onPagar, onEditar, onCancelar }) {
  if (contas.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <p style={{ fontSize: '48px' }}>📄</p>
        <p style={{ fontWeight: 700, color: '#1E293B', marginTop: '8px' }}>Nenhuma conta encontrada</p>
        <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Ajuste os filtros ou cadastre uma nova conta</p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            {['Fornecedor / Descrição', 'Categoria', 'Vencimento', 'Valor', 'Status', 'Ações'].map(h => (
              <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contas.map((c, i) => {
            const vencida = c.status === 'VENCIDO';
            const diasAtraso = vencida ? Math.floor((new Date() - new Date(c.dataVencimento)) / 86400000) : 0;
            return (
              <tr key={c.id}
                style={{ borderBottom: i < contas.length - 1 ? '1px solid #F1F5F9' : 'none', background: vencida ? '#FFF8F8' : 'white' }}
                onMouseEnter={e => e.currentTarget.style.background = vencida ? '#FFF0F0' : '#FAFAFA'}
                onMouseLeave={e => e.currentTarget.style.background = vencida ? '#FFF8F8' : 'white'}>

                {/* Fornecedor / Descrição */}
                <td style={{ padding: '12px 16px', maxWidth: '260px' }}>
                  <p style={{ fontWeight: 700, color: '#1E293B', fontSize: '13px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</p>
                  {c.fornecedor ? (
                    <p style={{ fontSize: '11px', color: '#64748B' }}>🏭 {c.fornecedor.nome}</p>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#CBD5E1' }}>Sem fornecedor</p>
                  )}
                  {c.observacoes && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', fontStyle: 'italic' }}>📝 {c.observacoes}</p>}
                </td>

                {/* Categoria */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <span style={{ background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: '99px', padding: '3px 10px', fontSize: '11px', fontWeight: 600 }}>{c.categoria}</span>
                </td>

                {/* Vencimento */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: vencida ? '#DC2626' : '#1E293B' }}>{fmtD(c.dataVencimento)}</p>
                  {vencida && <p style={{ fontSize: '11px', color: '#DC2626' }}>{diasAtraso}d em atraso</p>}
                  {c.status === 'PAGO' && c.dataPagamento && <p style={{ fontSize: '11px', color: '#16A34A' }}>Pago {fmtD(c.dataPagamento)}</p>}
                  {c.formaPagamento && <p style={{ fontSize: '11px', color: '#94A3B8' }}>{c.formaPagamento}</p>}
                </td>

                {/* Valor */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <p style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '14px', color: c.status === 'PAGO' ? '#16A34A' : vencida ? '#DC2626' : '#1E293B' }}>
                    {fmt(c.valor)}
                  </p>
                </td>

                {/* Status */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <Badge status={c.status} />
                </td>

                {/* Ações */}
                <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(c.status === 'PENDENTE' || c.status === 'VENCIDO') && (
                      <button onClick={() => onPagar(c)}
                        style={{ ...btnBase, padding: '6px 12px', background: '#16A34A', color: 'white', fontSize: '12px' }}>
                        💸 Pagar
                      </button>
                    )}
                    {c.status !== 'PAGO' && c.status !== 'CANCELADO' && (
                      <button onClick={() => onEditar(c)}
                        style={{ ...btnBase, padding: '6px 10px', background: 'white', border: '1.5px solid #E2E8F0', color: '#475569', fontSize: '12px' }}>
                        ✏️
                      </button>
                    )}
                    {c.status !== 'CANCELADO' && c.status !== 'PAGO' && (
                      <button onClick={() => onCancelar(c.id)}
                        style={{ ...btnBase, padding: '6px 10px', background: 'white', border: '1.5px solid #E2E8F0', color: '#CBD5E1', fontSize: '12px' }}
                        onMouseEnter={e => { e.target.style.color = '#EF4444'; e.target.style.borderColor = '#EF4444'; }}
                        onMouseLeave={e => { e.target.style.color = '#CBD5E1'; e.target.style.borderColor = '#E2E8F0'; }}>
                        🗑️
                      </button>
                    )}
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

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function ContasPagar() {
  const [aba, setAba]             = useState('apagar');
  const [contas, setContas]       = useState([]);
  const [fornecedores, setForn]   = useState([]);
  const [resumo, setResumo]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);  // 'nova' | 'editar' | 'pagar'
  const [contaAtual, setContaAtual] = useState(null);

  // filtros
  const [filtroForn, setFiltroForn]   = useState('');
  const [filtroCat, setFiltroCat]     = useState('');
  const [filtroInicio, setFiltroIni]  = useState('');
  const [filtroFim, setFiltroFim]     = useState('');
  const [busca, setBusca]             = useState('');

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [resContas, resForn, resResumo] = await Promise.all([
        api.get('/contas-pagar'),
        api.get('/fornecedores'),
        api.get('/contas-pagar/resumo'),
      ]);
      setContas(resContas.data);
      setForn(resForn.data);
      setResumo(resResumo.data);
    } catch (e) {
      console.error('[contas:carregar]', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const cancelar = async (id) => {
    if (!confirm('Cancelar esta conta?')) return;
    await api.delete(`/contas-pagar/${id}`);
    carregar();
  };

  const abrirEditar = (conta) => { setContaAtual(conta); setModal('editar'); };
  const abrirPagar  = (conta) => { setContaAtual(conta); setModal('pagar'); };
  const fecharModal = () => { setModal(null); setContaAtual(null); };
  const salvoModal  = () => { fecharModal(); carregar(); };

  // filtrar contas por aba e filtros manuais
  const contasFiltradas = contas.filter(c => {
    if (aba === 'apagar'    && c.status !== 'PENDENTE' && c.status !== 'VENCIDO') return false;
    if (aba === 'pagas'     && c.status !== 'PAGO')      return false;
    if (aba === 'canceladas'&& c.status !== 'CANCELADO') return false;
    if (filtroForn && String(c.fornecedorId) !== filtroForn) return false;
    if (filtroCat  && c.categoria !== filtroCat)         return false;
    if (busca) {
      const b = busca.toLowerCase();
      const nome = c.fornecedor?.nome?.toLowerCase() || '';
      if (!c.descricao.toLowerCase().includes(b) && !nome.includes(b)) return false;
    }
    return true;
  });

  const totalFiltrado = contasFiltradas.reduce((a, c) => a + c.valor, 0);
  const qtdVencidas   = contasFiltradas.filter(c => c.status === 'VENCIDO').length;

  const abas = [
    { id: 'apagar',     label: 'A Pagar',   icon: '🕐', count: contas.filter(c => c.status === 'PENDENTE' || c.status === 'VENCIDO').length },
    { id: 'pagas',      label: 'Pagas',     icon: '✅', count: null },
    { id: 'canceladas', label: 'Canceladas',icon: '✖',  count: null },
  ];

  return (
    <div style={{ padding: '24px', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* Modais */}
      {modal === 'nova' && (
        <ModalConta fornecedores={fornecedores} onSalvar={salvoModal} onFechar={fecharModal} />
      )}
      {modal === 'editar' && contaAtual && (
        <ModalConta conta={contaAtual} fornecedores={fornecedores} onSalvar={salvoModal} onFechar={fecharModal} />
      )}
      {modal === 'pagar' && contaAtual && (
        <ModalPagar conta={contaAtual} onSalvar={salvoModal} onFechar={fecharModal} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1E293B' }}>Contas a Pagar</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Controle de pagamentos e vencimentos</p>
        </div>
        <button onClick={() => setModal('nova')}
          style={{ ...btnBase, padding: '10px 20px', background: '#D97706', color: 'white' }}>
          + Nova Conta
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <KpiCard icon="🕐" label="A Pagar (Pendente)" valor={fmt(resumo.totalPendente || 0)} cor="#D97706" />
        <KpiCard icon="🔴" label="Vencidas" valor={fmt(resumo.totalVencido || 0)} sub={`${resumo.qtdVencidas || 0} conta(s)`} cor="#DC2626" />
        <KpiCard icon="⚡" label="Vence em 7 dias" valor={fmt(resumo.totalAVencer7 || 0)} sub={`${resumo.qtdAVencer7 || 0} conta(s)`} cor="#F59E0B" />
        <KpiCard icon="✅" label="Pago no mês" valor={fmt(resumo.totalPagoMes || 0)} cor="#16A34A" />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '20px' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700,
            color: aba === a.id ? '#D97706' : '#64748B',
            borderBottom: aba === a.id ? '2px solid #D97706' : '2px solid transparent',
            marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'inherit',
          }}>
            <span>{a.icon}</span>{a.label}
            {a.count > 0 && <span style={{ background: '#DC2626', color: 'white', borderRadius: '99px', padding: '1px 7px', fontSize: '10px', fontWeight: 700 }}>{a.count}</span>}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '16px', padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px', alignItems: 'end' }}>
          <div>
            <label style={lbl}>🔍 Buscar</label>
            <input style={inp} value={busca} onChange={e => setBusca(e.target.value)} placeholder="Descrição ou fornecedor..." />
          </div>
          <div>
            <label style={lbl}>Fornecedor</label>
            <select style={inp} value={filtroForn} onChange={e => setFiltroForn(e.target.value)}>
              <option value="">Todos</option>
              {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Categoria</label>
            <select style={inp} value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Rodapé de filtros: total */}
        {contasFiltradas.length > 0 && (
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>
              {contasFiltradas.length} conta(s)
              {qtdVencidas > 0 && <span style={{ color: '#DC2626', fontWeight: 700, marginLeft: '8px' }}>· {qtdVencidas} vencida(s)</span>}
            </p>
            <p style={{ fontSize: '14px', fontWeight: 800, color: '#1E293B' }}>
              Total: <span style={{ color: '#D97706', fontFamily: 'monospace' }}>{fmt(totalFiltrado)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Tabela */}
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94A3B8' }}>Carregando...</div>
        ) : (
          <TabelaContas
            contas={contasFiltradas}
            onPagar={abrirPagar}
            onEditar={abrirEditar}
            onCancelar={cancelar}
          />
        )}
      </div>
    </div>
  );
}
