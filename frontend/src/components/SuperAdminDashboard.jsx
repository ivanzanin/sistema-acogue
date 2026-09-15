import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const SECRET  = import.meta.env.VITE_SUPER_ADMIN_SECRET || '';
const cfg     = () => ({ headers: { 'x-super-admin': SECRET } });
const fmtCnpj = v => v.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2').slice(0,18);
const fmt     = v => Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const VAZIO   = { nomeAcougue:'', cnpj:'', nomeResponsavel:'', telefone:'', diaVencimento:'10', valorMensal:'' };

// ── MODAL EDITAR / CRIAR CLIENTE ───────────────────────────────
function ModalCliente({ cliente, onSalvar, onFechar }) {
  const isEdit  = !!cliente;
  const [form, setForm]           = useState(isEdit ? {
    nomeAcougue: cliente.nomeAcougue, cnpj: fmtCnpj(cliente.cnpj),
    nomeResponsavel: cliente.nomeResponsavel, telefone: cliente.telefone,
    diaVencimento: String(cliente.diaVencimento), valorMensal: String(cliente.valorMensal),
  } : VAZIO);
  const [logoPreview, setLogoPreview] = useState(cliente?.logoUrl || null);
  const [logoFile, setLogoFile]       = useState(null);
  const [uploading, setUploading]     = useState(false);
  const [salvando, setSalvando]       = useState(false);
  const [erro, setErro]               = useState(null);
  const fileRef = useRef(null);

  const selecionarLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const salvar = async () => {
    if (!form.nomeAcougue||!form.cnpj||!form.nomeResponsavel||!form.telefone||!form.valorMensal)
      return setErro('Preencha todos os campos.');
    setSalvando(true); setErro(null);
    try {
      let savedId = cliente?.id;
      if (isEdit) {
        await axios.patch(`/superadmin/${cliente.id}`, form, cfg());
      } else {
        const { data } = await axios.post('/superadmin', form, cfg());
        savedId = data.id;
      }
      // Upload logo se selecionou
      if (logoFile && savedId) {
        setUploading(true);
        const token = localStorage.getItem('token');
        await fetch(`/api/superadmin/logo/${savedId}`, {
          method: 'POST',
          headers: { 'Content-Type': logoFile.type, 'x-super-admin': SECRET },
          body: logoFile,
        });
        setUploading(false);
      }
      onSalvar();
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao salvar.');
    } finally { setSalvando(false); }
  };

  const inp = { width:'100%', background:'white', border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'9px 12px', fontSize:'14px', color:'#1E293B', outline:'none', fontFamily:'inherit' };
  const lbl = { display:'block', fontSize:'11px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'5px' };

  return (
    <div style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.35)'}}>
      <div style={{background:'white',borderRadius:'16px',width:'100%',maxWidth:'580px',boxShadow:'0 25px 60px rgba(0,0,0,0.15)',border:'1px solid #E2E8F0',overflow:'hidden',maxHeight:'90vh',overflowY:'auto'}}>

        {/* Header */}
        <div style={{padding:'20px 24px',borderBottom:'1px solid #E2E8F0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <p style={{fontWeight:800,fontSize:'16px',color:'#1E293B'}}>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</p>
          <button onClick={onFechar} style={{background:'none',border:'none',cursor:'pointer',fontSize:'22px',color:'#94A3B8',lineHeight:1}}>×</button>
        </div>

        <div style={{padding:'24px'}}>
          {/* LOGO */}
          <div style={{marginBottom:'24px'}}>
            <label style={lbl}>Logo do Açougue</label>
            <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
              <div style={{width:'90px',height:'90px',borderRadius:'10px',overflow:'hidden',border:'2px solid #E2E8F0',background:'#F8FAFC',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" style={{width:'100%',height:'100%',objectFit:'contain'}} />
                  : <span style={{fontSize:'32px'}}>🥩</span>
                }
              </div>
              <div>
                <button onClick={() => fileRef.current?.click()}
                  style={{display:'flex',alignItems:'center',gap:'8px',background:'#D97706',color:'white',border:'none',borderRadius:'8px',padding:'9px 16px',fontWeight:700,fontSize:'12px',textTransform:'uppercase',letterSpacing:'0.05em',cursor:'pointer',marginBottom:'8px'}}>
                  📷 {logoPreview ? 'Trocar Logo' : 'Adicionar Logo'}
                </button>
                <p style={{fontSize:'12px',color:'#94A3B8'}}>JPG, PNG ou WEBP · Máx 2MB</p>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={selecionarLogo} />
              </div>
            </div>
          </div>

          {/* DADOS */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
            <div style={{gridColumn:'1/-1'}}>
              <label style={lbl}>Nome do Açougue</label>
              <input style={inp} value={form.nomeAcougue} onChange={e=>setForm({...form,nomeAcougue:e.target.value})} placeholder="Casa de Carne Rezende" />
            </div>
            <div>
              <label style={lbl}>CNPJ</label>
              <input style={inp} value={form.cnpj} onChange={e=>setForm({...form,cnpj:fmtCnpj(e.target.value)})} placeholder="00.000.000/0001-00" disabled={isEdit} />
            </div>
            <div>
              <label style={lbl}>Responsável</label>
              <input style={inp} value={form.nomeResponsavel} onChange={e=>setForm({...form,nomeResponsavel:e.target.value})} placeholder="João Silva" />
            </div>
            <div>
              <label style={lbl}>Telefone</label>
              <input style={inp} value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})} placeholder="(44) 99999-0000" />
            </div>
            <div>
              <label style={lbl}>Dia Vencimento</label>
              <input style={inp} type="number" min="1" max="31" value={form.diaVencimento} onChange={e=>setForm({...form,diaVencimento:e.target.value})} />
            </div>
            <div>
              <label style={lbl}>Mensalidade (R$)</label>
              <input style={inp} type="number" step="0.01" value={form.valorMensal} onChange={e=>setForm({...form,valorMensal:e.target.value})} placeholder="299.90" />
            </div>
          </div>

          {erro && <div style={{marginTop:'14px',padding:'10px 14px',background:'#FEE2E2',border:'1px solid #FECACA',borderRadius:'8px',color:'#991B1B',fontSize:'13px',fontWeight:600}}>❌ {erro}</div>}
        </div>

        {/* Footer */}
        <div style={{padding:'16px 24px',borderTop:'1px solid #E2E8F0',display:'flex',gap:'10px',justifyContent:'flex-end'}}>
          <button onClick={onFechar} style={{padding:'10px 20px',background:'white',border:'1.5px solid #E2E8F0',borderRadius:'8px',fontSize:'13px',fontWeight:600,cursor:'pointer',color:'#475569'}}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando||uploading} style={{padding:'10px 24px',background:'#D97706',border:'none',borderRadius:'8px',fontSize:'13px',fontWeight:700,cursor:'pointer',color:'white',opacity:(salvando||uploading)?0.6:1}}>
            {salvando ? 'Salvando...' : uploading ? 'Enviando logo...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD PRINCIPAL ────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [clientes, setClientes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(false);
  const [clienteEdit, setClienteEdit] = useState(null);
  const [toggling, setToggling]   = useState(null);
  const [semAcesso, setSemAcesso] = useState(false);
  const [erro, setErro]           = useState(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/superadmin', cfg());
      setClientes(data);
    } catch (e) {
      if (e.response?.status === 403) setSemAcesso(true);
      else setErro('Erro ao carregar.');
    } finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const toggleStatus = async (c) => {
    const novo = c.statusPagamento === 'ATIVO' ? 'BLOQUEADO' : 'ATIVO';
    setToggling(c.id);
    try {
      await axios.patch(`/superadmin/${c.id}`, { statusPagamento: novo }, cfg());
      setClientes(prev => prev.map(x => x.id === c.id ? { ...x, statusPagamento: novo } : x));
    } catch { alert('Erro ao alterar status.'); }
    finally { setToggling(null); }
  };

  const abrirNovo   = ()  => { setClienteEdit(null); setModal(true); };
  const abrirEditar = (c) => { setClienteEdit(c);    setModal(true); };
  const aoSalvar    = ()  => { setModal(false); carregar(); };

  const totalAtivos   = clientes.filter(c => c.statusPagamento === 'ATIVO').length;
  const receitaMensal = clientes.filter(c => c.statusPagamento === 'ATIVO').reduce((s,c) => s + c.valorMensal, 0);
  const bloqueados    = clientes.filter(c => c.statusPagamento === 'BLOQUEADO').length;

  if (semAcesso) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#F8FAFC'}}>
      <div style={{textAlign:'center'}}>
        <p style={{fontSize:'48px',marginBottom:'12px'}}>🔒</p>
        <p style={{fontWeight:800,color:'#EF4444',fontSize:'16px'}}>Acesso Negado</p>
        <p style={{color:'#94A3B8',fontSize:'13px',marginTop:'4px'}}>Configure VITE_SUPER_ADMIN_SECRET</p>
      </div>
    </div>
  );

  return (
    <div style={{padding:'24px',background:'#F8FAFC',minHeight:'100vh'}}>
      {modal && <ModalCliente cliente={clienteEdit} onSalvar={aoSalvar} onFechar={() => setModal(false)} />}

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:800,color:'#1E293B',letterSpacing:'-0.5px'}}>Super Admin</h1>
          <p style={{fontSize:'13px',color:'#64748B',marginTop:'2px'}}>Gestão de Tenants</p>
        </div>
        <button onClick={abrirNovo} style={{display:'flex',alignItems:'center',gap:'8px',background:'#D97706',color:'white',border:'none',borderRadius:'10px',padding:'10px 20px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
          + Novo Cliente
        </button>
      </div>

      {/* Cards resumo */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginBottom:'24px'}}>
        {[
          { label:'Total de Clientes', valor: clientes.length, sub:`${totalAtivos} ativos`, icon:'👥' },
          { label:'Receita Mensal',    valor: fmt(receitaMensal), sub:'Clientes ativos', icon:'💰' },
          { label:'Bloqueados',        valor: bloqueados, sub:'Acesso suspenso', icon:'🔒' },
        ].map(({ label, valor, sub, icon }) => (
          <div key={label} style={{background:'white',borderRadius:'12px',padding:'20px',border:'1px solid #E2E8F0',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
              <p style={{fontSize:'11px',fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.07em'}}>{label}</p>
              <span style={{fontSize:'24px'}}>{icon}</span>
            </div>
            <p style={{fontSize:'28px',fontWeight:900,color:'#1E293B'}}>{valor}</p>
            <p style={{fontSize:'12px',color:'#94A3B8',marginTop:'2px'}}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{background:'white',borderRadius:'12px',border:'1px solid #E2E8F0',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{background:'#F8FAFC',borderBottom:'1px solid #E2E8F0'}}>
              {['Logo','Açougue','CNPJ','Responsável','Vencimento','Mensalidade','Status','Ações'].map(h => (
                <th key={h} style={{padding:'12px 16px',textAlign:'left',fontSize:'11px',fontWeight:700,color:'#94A3B8',textTransform:'uppercase',letterSpacing:'0.07em'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94A3B8',fontSize:'13px'}}>Carregando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={8} style={{textAlign:'center',padding:'40px',color:'#94A3B8',fontSize:'13px'}}>Nenhum cliente cadastrado</td></tr>
            ) : clientes.map((c, i) => (
              <tr key={c.id} style={{borderBottom: i < clientes.length-1 ? '1px solid #F1F5F9' : 'none'}}>
                {/* Logo */}
                <td style={{padding:'12px 16px'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'8px',overflow:'hidden',border:'1px solid #E2E8F0',background:'#F8FAFC',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {c.logoUrl
                      ? <img src={c.logoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}} />
                      : <span style={{fontSize:'18px'}}>🥩</span>
                    }
                  </div>
                </td>
                <td style={{padding:'12px 16px',fontWeight:700,color:'#1E293B',fontSize:'14px'}}>{c.nomeAcougue}</td>
                <td style={{padding:'12px 16px',color:'#475569',fontSize:'13px',fontFamily:'monospace'}}>{fmtCnpj(c.cnpj)}</td>
                <td style={{padding:'12px 16px',color:'#475569',fontSize:'13px'}}>{c.nomeResponsavel}</td>
                <td style={{padding:'12px 16px',color:'#475569',fontSize:'13px'}}>Dia {c.diaVencimento}</td>
                <td style={{padding:'12px 16px',fontWeight:700,color:'#D97706',fontSize:'13px'}}>{fmt(c.valorMensal)}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{
                    display:'inline-block',padding:'3px 10px',borderRadius:'99px',fontSize:'11px',fontWeight:700,
                    background: c.statusPagamento==='ATIVO' ? '#DCFCE7' : '#FEE2E2',
                    color: c.statusPagamento==='ATIVO' ? '#166534' : '#991B1B',
                  }}>
                    {c.statusPagamento}
                  </span>
                </td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    {/* Editar */}
                    <button onClick={() => abrirEditar(c)} style={{padding:'6px 12px',background:'white',border:'1.5px solid #E2E8F0',borderRadius:'7px',fontSize:'12px',fontWeight:600,cursor:'pointer',color:'#475569',transition:'all 0.15s'}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor='#D97706';e.currentTarget.style.color='#D97706';}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor='#E2E8F0';e.currentTarget.style.color='#475569';}}>
                      ✏️ Editar
                    </button>
                    {/* Kill switch */}
                    <button onClick={() => toggleStatus(c)} disabled={toggling===c.id}
                      style={{
                        position:'relative',width:'44px',height:'24px',borderRadius:'99px',border:'none',cursor:'pointer',transition:'background 0.2s',
                        background: c.statusPagamento==='ATIVO' ? '#22C55E' : '#E2E8F0',
                        opacity: toggling===c.id ? 0.5 : 1,
                      }}>
                      <span style={{
                        position:'absolute',top:'3px',width:'18px',height:'18px',borderRadius:'50%',background:'white',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left 0.2s',
                        left: c.statusPagamento==='ATIVO' ? '23px' : '3px',
                      }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
