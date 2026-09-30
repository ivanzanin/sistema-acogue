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

function GestaoMenu({ itens, recolhido }) {
  const { pathname } = useLocation();
  const temAtivo = itens.some(n => pathname === n.to || (n.to !== '/' && pathname.startsWith(n.to)));
  const [aberto, setAberto] = useState(temAtivo);

  if (recolhido) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px', padding: '6px 4px' }}>
        {itens.map(n => <NavItem key={n.to} {...n} recolhido small />)}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px 8px 12px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#71717A', textTransform: 'uppercase' }}>
          Gestão
        </span>
        <span style={{ fontSize: '10px', color: '#71717A', transition: 'transform 0.2s', display: 'inline-block', transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>
      {aberto && (
        <div style={{ padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {itens.map(n => <NavItem key={n.to} {...n} small />)}
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon, label, badge, destaque, small, recolhido }) {
  const { pathname } = useLocation();
  const active = pathname === to || (to !== '/' && pathname.startsWith(to));

  const baseStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: recolhido ? '0' : '10px',
    justifyContent: recolhido ? 'center' : 'flex-start',
    borderRadius: '10px',
    textDecoration: 'none',
    transition: 'all 0.15s',
    position: 'relative',
    fontWeight: destaque ? 700 : 500,
    letterSpacing: '0.01em',
    fontSize: destaque ? '13px' : small ? '11px' : '12px',
    padding: recolhido ? '10px 0' : (destaque ? '11px 12px' : '8px 12px'),
    color: active ? '#F59E0B' : destaque ? '#E4E4E7' : '#A1A1AA',
    background: active ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
    borderLeft: active ? '3px solid #F59E0B' : '3px solid transparent',
  };

  return (
    <Link
      to={to}
      style={baseStyle}
      title={recolhido ? label : undefined}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.color = '#FFFFFF';
          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.color = destaque ? '#E4E4E7' : '#A1A1AA';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span style={{ fontSize: destaque ? '18px' : '15px', width: recolhido ? 'auto' : '22px', textAlign: 'center' }}>
        {icon}
      </span>
      {!recolhido && <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      {badge > 0 && (
        <span
          style={{
            background: '#DC2626',
            color: 'white',
            borderRadius: '99px',
            padding: recolhido ? '1px 5px' : '1px 6px',
            fontSize: '10px',
            fontWeight: 800,
            position: recolhido ? 'absolute' : 'static',
            top: recolhido ? '3px' : 'auto',
            right: recolhido ? '6px' : 'auto',
          }}
        >
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
  const location = useLocation();

  // Preferência de barra recolhida salva no localStorage
  const [recolhida, setRecolhida] = useState(() => {
    const salvo = localStorage.getItem('sidebar_recolhida');
    if (salvo !== null) return salvo === 'true';
    return location.pathname === '/pdv';
  });
  const [hovered, setHovered] = useState(false);

  const expandida = !recolhida || hovered;

  const toggleRecolhida = () => {
    setRecolhida(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_recolhida', String(next));
      return next;
    });
  };

  const navPrincipal = [
    { to:'/pdv',      icon:'🛒', label:'Frente de Caixa', destaque: true },
    { to:'/comandas', icon:'🍽️', label:'Comandas',        destaque: true },
    { to:'/caixa',    icon:'💰', label:'Caixa' },
  ];

  const navGestao = [
    { to:'/dashboard',    icon:'📊', label:'Dashboard' },
    { to:'/desossa',      icon:'🦴', label:'Desossa' },
    { to:'/gestao',       icon:'🥩', label:'Vendas & Cortes' },
    { to:'/historico',    icon:'📋', label:'Histórico' },
    { to:'/produtos',     icon:'🏷️',  label:'Produtos' },
    { to:'/fornecedores', icon:'🏭', label:'Fornecedores' },
    { to:'/contas-pagar', icon:'💳', label:'Contas a Pagar' },
    ...(isAdmin ? [
      { to:'/config',     icon:'⚙️', label:'Configurações' },
      { to:'/superadmin', icon:'👑', label:'Super Admin' },
    ] : []),
  ];

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
    } catch {
      alert('Erro ao enviar imagem. Verifique se o arquivo tem menos de 2MB.');
    } finally {
      setUploading(false);
    }
  };

  const logoSrc = cliente?.logoUrl || '/logos/logo-rezende.png';

  return (
    <div
      style={{
        width: recolhida ? '64px' : '220px',
        flexShrink: 0,
        position: 'relative',
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 50,
      }}
    >
      <aside
        onMouseEnter={() => recolhida && setHovered(true)}
        onMouseLeave={() => recolhida && setHovered(false)}
        style={{
          width: expandida ? '220px' : '64px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#18181B', // Dark charcoal/zinc elegante e moderno
          borderRight: '1px solid #27272A',
          position: recolhida && hovered ? 'absolute' : 'relative',
          top: 0,
          left: 0,
          bottom: 0,
          boxShadow: recolhida && hovered ? '8px 0 28px rgba(0,0,0,0.6)' : 'none',
          transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
          overflowX: 'hidden',
          overflowY: 'auto',
          userSelect: 'none',
        }}
      >
        {/* CABEÇALHO / LOGO DO AÇOUGUE */}
        <div style={{
          padding: expandida ? '16px 12px 14px' : '14px 8px',
          borderBottom: '1px solid #27272A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          {expandida ? (
            <>
              <div
                style={{
                  position: 'relative',
                  width: '190px',
                  height: '84px',
                  borderRadius: '10px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1.5px solid rgba(245, 158, 11, 0.3)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                }}
                onClick={() => fileRef.current?.click()}
                title="Clique para alterar a logo"
              >
                <img
                  src={logoSrc}
                  alt="Casa de Carne Rezende"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.65)',
                    opacity: 0,
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                >
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 700 }}>
                    {uploading ? 'Enviando...' : '📷 Trocar Logo'}
                  </span>
                </div>
              </div>

              {/* Botão de upload explícito */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '6px',
                  color: '#D4D4D8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.2)'; e.currentTarget.style.color = '#F59E0B'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#D4D4D8'; }}
              >
                <span>📷</span>
                <span>{uploading ? 'Enviando...' : 'Personalizar Logo'}</span>
              </button>
            </>
          ) : (
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1.5px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
              onClick={() => fileRef.current?.click()}
              title="Casa de Carne Rezende (Clique para trocar logo)"
            >
              <img
                src={logoSrc}
                alt="Logo"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadLogo} />
        </div>

        {/* NAVEGAÇÃO PRINCIPAL */}
        <nav style={{ padding: expandida ? '10px 8px' : '10px 4px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navPrincipal.map(n => <NavItem key={n.to} {...n} recolhido={!expandida} />)}
        </nav>

        {/* DIVISOR */}
        <div style={{ margin: expandida ? '4px 12px' : '4px 8px', borderTop: '1px solid #27272A' }} />

        {/* NAVEGAÇÃO DE GESTÃO */}
        <GestaoMenu itens={navGestao} recolhido={!expandida} />

        {/* RODAPÉ: BOTÃO FIXAR/RECOLHER + SAIR */}
        <div style={{ padding: '8px', borderTop: '1px solid #27272A', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {/* BOTÃO FIXAR / RECOLHER BARRA */}
          <button
            type="button"
            onClick={toggleRecolhida}
            title={recolhida ? 'Fixar menu aberto' : 'Recolher menu (expandir ao passar o mouse)'}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expandida ? 'space-between' : 'center',
              padding: expandida ? '8px 10px' : '8px 0',
              borderRadius: '8px',
              border: '1px solid #27272A',
              background: 'rgba(255,255,255,0.03)',
              color: '#A1A1AA',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#A1A1AA'; }}
          >
            {expandida ? (
              <>
                <span>{recolhida ? '📌 Fixar aberto' : '◀ Recolher menu'}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{recolhida ? 'AUTO' : 'FIXO'}</span>
              </>
            ) : (
              <span style={{ fontSize: '13px' }} title="Expandir menu">▶</span>
            )}
          </button>

          {/* LOGOUT */}
          <button
            onClick={onLogout}
            title={!expandida ? 'Sair do sistema' : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: expandida ? 'flex-start' : 'center',
              gap: '10px',
              padding: expandida ? '8px 10px' : '8px 0',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#71717A',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
            onMouseLeave={e => e.currentTarget.style.color = '#71717A'}
          >
            <span style={{ fontSize: '16px' }}>🚪</span>
            {expandida && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </div>
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
