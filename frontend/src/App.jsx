import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import api from './utils/api';

import LoginCliente        from './pages/LoginCliente';
import DashboardCliente    from './components/DashboardCliente';
import PdvBalanca          from './components/PdvBalanca';
import GestaoComandas      from './components/GestaoComandas';
import ControleCaixa       from './pages/ControleCaixa';
import PainelDesossa       from './components/PainelDesossa';
import PainelGestao        from './pages/PainelGestao';
import HistoricoVendas     from './pages/HistoricoVendas';
import GestaoProdutos      from './components/GestaoProdutos';
import Configuracoes       from './pages/Configuracoes';
import Fornecedores        from './pages/Fornecedores';
import ContasPagar         from './pages/ContasPagar';
import ModuloAssados       from './pages/ModuloAssados';
import SuperAdminDashboard from './components/SuperAdminDashboard';

const getCliente = () => {
  try { return JSON.parse(localStorage.getItem('cliente')); }
  catch { return null; }
};

function useAlertaEstoque() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const fn = async () => {
      try {
        const { data } = await api.get('/gestao/estoque');
        setN(data.filter(e => e.statusValidade !== 'OK' || ((e.tipo==='UN'?e.pesoKg<=5:e.pesoKg<3)&&e.pesoKg>0)).length);
      } catch {}
    };
    fn();
    const t = setInterval(fn, 60000);
    return () => clearInterval(t);
  }, []);
  return n;
}

function GestaoMenu({ itens }) {
  const { pathname } = useLocation();
  const temAtivo = itens.some(n => pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to)));
  const [aberto, setAberto] = useState(temAtivo);

  return (
    <div style={{flex:1, overflowY:'auto'}}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 20px 8px 12px', border:'none', background:'transparent',
          cursor:'pointer', transition:'all 0.15s',
        }}>
        <span style={{fontSize:'11px', fontWeight:600, letterSpacing:'0.04em', color:'#8C7468'}}>
          Gestão
        </span>
        <span style={{fontSize:'10px', color:'#8C7468', transition:'transform 0.2s', display:'inline-block', transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)'}}>▾</span>
      </button>
      {aberto && (
        <div style={{padding:'0 8px 12px', display:'flex', flexDirection:'column', gap:'2px'}}>
          {itens.map(n => <NavItem key={n.to} {...n} small />)}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, badge, destaque, small }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));

  const baseStyle = {
    display:'flex', alignItems:'center', gap:'10px',
    borderRadius:'8px', textDecoration:'none', transition:'all 0.15s', position:'relative',
    fontWeight: destaque ? 600 : 500,
    letterSpacing: '0.01em',
    fontSize: destaque ? '13px' : small ? '11px' : '12px',
    padding: destaque ? '11px 12px' : '8px 12px',
    color: active ? '#F6916B' : destaque ? '#D4B5A0' : '#A89488',
    background: active ? 'rgba(246,145,107,0.12)' : 'transparent',
    borderLeft: active && destaque ? '3px solid #F6916B' : '3px solid transparent',
  };

  return (
    <Link to={to} style={baseStyle}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color='#E8D3C4'; e.currentTarget.style.background='rgba(246,145,107,0.06)'; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color=destaque?'#D4B5A0':'#A89488'; e.currentTarget.style.background='transparent'; }}}>
      <span style={{fontSize: destaque ? '18px' : '14px', width:'20px', textAlign:'center'}}>{icon}</span>
      <span style={{flex:1}}>{label}</span>
      {badge > 0 && (
        <span style={{background:'#DC2626',color:'white',borderRadius:'99px',padding:'1px 6px',fontSize:'10px',fontWeight:700}}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ onLogout }) {
  const alertas = useAlertaEstoque();
  const cliente = getCliente();
  const isAdmin = cliente?.isAdmin === true;
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const navPrincipal = [
    { to:'/pdv',      icon:'🛒', label:'Frente de Caixa', destaque: true },
    { to:'/comandas', icon:'🍽️', label:'Comandas',        destaque: true },
    { to:'/caixa',    icon:'💰', label:'Caixa' },
  ];

  const navGestao = [
    { to:'/dashboard',    icon:'📊', label:'Dashboard' },
    { to:'/desossa',      icon:'🦴', label:'Desossa' },
    { to:'/gestao',       icon:'📦', label:'Estoque', badge: alertas },
    { to:'/historico',    icon:'📋', label:'Histórico' },
    { to:'/produtos',     icon:'🏷️',  label:'Produtos' },
    { to:'/fornecedores', icon:'🏭', label:'Fornecedores' },
    { to:'/contas-pagar', icon:'💳', label:'Contas a Pagar' },
    ...(isAdmin ? [
      { to:'/config',     icon:'⚙️', label:'Configurações' },
      { to:'/superadmin', icon:'👑', label:'Super Admin' },
    ] : []),
  ];

  const LogoImg = ({ src }) => {
    const [erro, setErro] = React.useState(false);
    const imgSrc = (!erro && src) ? src : null;
    return imgSrc ? (
      <img src={imgSrc} alt="Logo"
        style={{width:'160px',height:'80px',objectFit:'contain',borderRadius:'10px',background:'rgba(255,255,255,0.05)'}}
        onError={() => setErro(true)} />
    ) : (
      <div style={{width:'160px',height:'60px',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'28px',background:'rgba(217,119,6,0.1)',border:'1.5px dashed rgba(217,119,6,0.3)'}}>🥩</div>
    );
  };

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const resp  = await fetch('/api/tenant/logo', { method:'POST', headers:{'Content-Type':file.type,'Authorization':`Bearer ${token}`}, body:file });
      const data  = await resp.json();
      if (data.logoUrl) {
        const cl = JSON.parse(localStorage.getItem('cliente')||'{}');
        cl.logoUrl = data.logoUrl;
        localStorage.setItem('cliente', JSON.stringify(cl));
        window.location.reload();
      }
    } catch {}
    finally { setUploading(false); }
  };

  return (
    <aside style={{
      width:'200px', minHeight:'100vh', display:'flex', flexDirection:'column',
      background:'#1F1410', borderRight:'1px solid #2D1F18', flexShrink:0,
    }}>
      {/* Logo */}
      <div style={{padding:'20px 16px', borderBottom:'1px solid #2D1F18', display:'flex', flexDirection:'column', alignItems:'center', gap:'10px'}}>
        <div style={{position:'relative', cursor: isAdmin ? 'default' : 'pointer'}}
          onClick={() => !isAdmin && fileRef.current?.click()}>
          <LogoImg src={cliente?.logoUrl} />
          {!isAdmin && (
            <div style={{position:'absolute', inset:0, borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.55)', opacity:0, transition:'opacity 0.2s'}}
              onMouseEnter={e => e.currentTarget.style.opacity='1'}
              onMouseLeave={e => e.currentTarget.style.opacity='0'}>
              <span style={{color:'white', fontSize:'11px', fontWeight:600}}>{uploading ? '...' : '📷 Trocar logo'}</span>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={uploadLogo} />
        </div>
        <div style={{textAlign:'center'}}>
          <p style={{fontSize:'10px', fontWeight:600, letterSpacing:'0.06em', color:'#A89488', marginBottom:'2px'}}>
            {isAdmin ? 'Administrador' : 'Casa de Carne'}
          </p>
          <p style={{fontSize:'14px', fontWeight:700, letterSpacing:'0.02em', color:'#F6916B', fontFamily:'Georgia, serif'}}>
            {isAdmin ? 'ADMIN' : (cliente?.nomeAcougue || 'REZENDE')}
          </p>
        </div>
      </div>

      {/* Nav principal */}
      <nav style={{padding:'12px 8px', display:'flex', flexDirection:'column', gap:'2px'}}>
        {navPrincipal.map(n => <NavItem key={n.to} {...n} />)}
      </nav>

      {/* Divisor */}
      <div style={{margin:'0 12px', borderTop:'1px solid #2D1F18'}} />

      {/* Nav gestão — colapsável */}
      <GestaoMenu itens={navGestao} />

      {/* Logout */}
      <div style={{padding:'8px', borderTop:'1px solid #2D1F18'}}>
        <button onClick={onLogout} style={{
          width:'100%', display:'flex', alignItems:'center', gap:'10px',
          padding:'9px 12px', borderRadius:'8px', border:'none',
          background:'transparent', cursor:'pointer', color:'#8C7468',
          fontSize:'12px', fontWeight:500, letterSpacing:'0.01em',
          transition:'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color='#EF4444'}
        onMouseLeave={e => e.currentTarget.style.color='#8C7468'}>
          <span>🚪</span><span>Sair</span>
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const [logado, setLogado] = useState(!!localStorage.getItem('token'));

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('cliente');
    setLogado(false);
  };

  return (
    <BrowserRouter>
      {!logado ? (
        <LoginCliente onLogin={() => setLogado(true)} />
      ) : (
        <div style={{display:'flex', height:'100vh', overflow:'hidden', background:'#FAF7F2'}}>
          <Sidebar onLogout={logout} />
          <main style={{flex:1, minWidth:0, height:'100vh', overflowY:'auto', display:'flex', flexDirection:'column'}}>
            <Routes>
              <Route path="/"            element={<Navigate to="/dashboard" />} />
              <Route path="/login"       element={<Navigate to="/dashboard" />} />
              <Route path="/dashboard"   element={<DashboardCliente />} />
              <Route path="/pdv"         element={<PdvBalanca />} />
              <Route path="/comandas"    element={<GestaoComandas />} />
              <Route path="/caixa"       element={<ControleCaixa />} />
              <Route path="/desossa"     element={<PainelDesossa />} />
              <Route path="/gestao"      element={<PainelGestao />} />
              <Route path="/historico"   element={<HistoricoVendas />} />
              <Route path="/fornecedores"element={<Fornecedores />} />
              <Route path="/contas-pagar"element={<ContasPagar />} />
              <Route path="/assados"       element={<ModuloAssados />} />
              <Route path="/produtos"    element={<GestaoProdutos />} />
              <Route path="/config"      element={<Configuracoes />} />
              <Route path="/superadmin"  element={<SuperAdminDashboard />} />
              <Route path="*"            element={<Navigate to="/dashboard" />} />
            </Routes>
          </main>
        </div>
      )}
    </BrowserRouter>
  );
}
