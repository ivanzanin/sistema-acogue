import React, { useState } from 'react';
import axios from 'axios';

export default function LoginCliente({ onLogin }) {
  const [modo, setModo]             = useState('acougue');
  const [cnpj, setCnpj]             = useState('');
  const [senha, setSenha]           = useState('');
  const [usuario, setUsuario]       = useState('');
  const [senhaAdmin, setSenhaAdmin] = useState('');
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState(null);
  const [bloqueado, setBloqueado]   = useState(false);

  const formatCnpj = (v) =>
    v.replace(/\D/g,'').replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
     .replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2').slice(0,18);

  const handleAcougue = async () => {
    setErro(null); setBloqueado(false); setLoading(true);
    try {
      const { data } = await axios.post('/auth/login', { cnpj: cnpj.replace(/\D/g,''), senha });
      localStorage.setItem('token', data.token);
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('cliente', JSON.stringify({ ...data.cliente, isAdmin: false }));
      onLogin?.(data.token, { ...data.cliente, isAdmin: false });
    } catch (err) {
      if (err.response?.status === 403) setBloqueado(true);
      else setErro(err.response?.data?.erro || 'Erro ao autenticar.');
    } finally { setLoading(false); }
  };

  const handleAdmin = async () => {
    setErro(null); setLoading(true);
    try {
      const { data } = await axios.post('/auth/admin-login', { usuario, senha: senhaAdmin });
      localStorage.setItem('token', data.token);
      localStorage.setItem('cliente', JSON.stringify(data.cliente));
      onLogin?.(data.token, data.cliente);
    } catch (err) {
      setErro(err.response?.data?.erro || 'Credenciais invalidas.');
    } finally { setLoading(false); }
  };

  const inp = "w-full rounded-lg px-4 py-3 text-sm focus:outline-none transition-all border-2"
    + " bg-white border-stone-200 text-stone-800 focus:border-brand-600 placeholder-stone-300";

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #FDF8F3 0%, #F5EDE4 100%)' }}>

      {/* Modal bloqueado */}
      {bloqueado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
          <div className="w-full max-w-md mx-4 rounded-2xl p-10 text-center shadow-modal bg-white border border-red-200">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="font-bold text-xl mb-3 text-red-700">Acesso Suspenso</h2>
            <p className="text-sm leading-relaxed mb-6 text-stone-700">
              Regularize sua mensalidade com o<br/>
              <span className="font-semibold text-stone-900">Administrador do sistema.</span>
            </p>
            <div className="rounded-lg px-4 py-3 text-xs font-mono mb-6 bg-page text-stone-700 border border-stone-200">
              CNPJ: {cnpj}
            </div>
            <button onClick={() => setBloqueado(false)} className="text-xs text-stone-500 hover:text-stone-800 transition-colors">
              Tentar outro acesso
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-5 shadow-lift"
            style={{background:'linear-gradient(135deg,#3D1A0B,#5C2410)'}}>
            <span className="text-4xl">🥩</span>
          </div>
          <p className="text-xs uppercase tracking-[0.25em] mb-1 text-stone-500">Casa de Carne</p>
          <h1 className="text-3xl font-black tracking-wider text-stone-900" style={{fontFamily:'Georgia, serif'}}>
            REZENDE
          </h1>
          <p className="text-xs mt-1 text-stone-500">Sistema de Gestão</p>
        </div>

        {/* Toggle */}
        <div className="flex rounded-xl p-1 mb-5 bg-stone-100 border border-stone-200">
          <button onClick={() => { setModo('acougue'); setErro(null); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all"
            style={modo === 'acougue' ? {background:'#1F1410', color:'#FDF8F3'} : {color:'#9C7B68'}}>
            🥩 Açougue
          </button>
          <button onClick={() => { setModo('admin'); setErro(null); }}
            className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all"
            style={modo === 'admin' ? {background:'#1F1410', color:'#FDF8F3'} : {color:'#9C7B68'}}>
            👑 Admin
          </button>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 shadow-soft bg-white border border-stone-200">
          {modo === 'acougue' ? (
            <>
              <p className="text-xs font-semibold mb-6 text-stone-500">Login do açougue</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-stone-600">CNPJ</label>
                  <input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))}
                    placeholder="00.000.000/0001-00" className={inp}
                    onKeyDown={e => e.key === 'Enter' && handleAcougue()} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-stone-600">Senha</label>
                  <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                    placeholder="••••••••" className={inp}
                    onKeyDown={e => e.key === 'Enter' && handleAcougue()} />
                </div>
                {erro && <div className="text-xs text-center py-2.5 rounded-lg text-red-700 bg-red-50 border border-red-200">{erro}</div>}
                <button onClick={handleAcougue} disabled={loading || !cnpj || !senha}
                  className="w-full py-3.5 font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-40 text-white shadow-soft hover:shadow-lift"
                  style={{background: '#9A3412'}}>
                  {loading ? 'Autenticando...' : 'Entrar →'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold mb-6 text-stone-500">Login Administrativo</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-stone-600">Usuário</label>
                  <input value={usuario} onChange={e => setUsuario(e.target.value)}
                    placeholder="admin" className={inp} autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleAdmin()} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-stone-600">Senha</label>
                  <input type="password" value={senhaAdmin} onChange={e => setSenhaAdmin(e.target.value)}
                    placeholder="••••••••" className={inp}
                    onKeyDown={e => e.key === 'Enter' && handleAdmin()} />
                </div>
                {erro && <div className="text-xs text-center py-2.5 rounded-lg text-red-700 bg-red-50 border border-red-200">{erro}</div>}
                <button onClick={handleAdmin} disabled={loading || !usuario || !senhaAdmin}
                  className="w-full py-3.5 font-bold text-sm rounded-xl transition-all active:scale-95 disabled:opacity-40 text-white shadow-soft hover:shadow-lift"
                  style={{background: '#0F766E'}}>
                  {loading ? 'Autenticando...' : 'Entrar como Admin →'}
                </button>
              </div>
            </>
          )}
        </div>
        <p className="text-center text-xs mt-6 text-stone-500">
          Problemas? Contate o administrador.
        </p>
      </div>
    </div>
  );
}
