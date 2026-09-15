import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMA_ICON = { DINHEIRO:'💵', PIX:'📱', DEBITO:'💳', CREDITO:'💳', VOUCHER:'🎫', MULTIPLO:'👥' };

export default function PainelGestao() {
  const [caixa, setCaixa]       = useState({ totalDia: 0, ultimasVendas: [], porForma: {}, totalCanceladas: 0 });
  const [estoque, setEstoque]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [cancelando, setCancelando] = useState(null);
  const [buscaEstoque, setBuscaEstoque] = useState('');

  const carregar = async () => {
    try {
      const [resCaixa, resEstoque] = await Promise.all([
        api.get('/gestao/caixa/hoje'),
        api.get('/gestao/estoque'),
      ]);
      setCaixa(resCaixa.data);
      setEstoque(resEstoque.data);
      setLastUpdate(new Date());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); const i = setInterval(carregar, 30000); return () => clearInterval(i); }, []);

  const removerEstoque = async (item) => {
    const nome = item.nomeCorte;
    const tipo = item.tipo === 'UN' ? 'unidades' : 'kg';
    if (!confirm(`Remover "${nome}" do estoque? Esta acao nao pode ser desfeita.`)) return;
    try {
      await api.delete(`/gestao/estoque/${item.id}`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao remover.');
    }
  };

  const cancelarVenda = async (id, total) => {
    if (!confirm(`Cancelar venda de ${fmt(total)}? O estoque sera estornado.`)) return;
    setCancelando(id);
    try {
      await api.patch(`/gestao/venda/${id}/cancelar`);
      carregar();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar.');
    } finally { setCancelando(null); }
  };

  // Alertas de validade
  const vencidos   = estoque.filter(e => e.statusValidade === 'VENCIDO');
  const vencendo   = estoque.filter(e => e.statusValidade === 'VENCENDO');
  const estoqueBaixo = estoque.filter(e => e.pesoKg < 3 && e.pesoKg > 0);
  const estoqueFiltrado = buscaEstoque.trim()
    ? estoque.filter(e => e.nomeCorte.toLowerCase().includes(buscaEstoque.toLowerCase()))
    : estoque;

  return (
    <div className="min-h-screen bg-page p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Painel de Gestao</h1>
          <p className="text-xs text-stone-500 mt-0.5">{lastUpdate && `Atualizado ${lastUpdate.toLocaleTimeString('pt-BR')}`}</p>
        </div>
        <button onClick={carregar} className="text-xs text-stone-600 hover:text-stone-900 border border-stone-300 hover:border-stone-400 px-4 py-2 rounded transition-all">Atualizar</button>
      </div>

      {/* ALERTAS */}
      {(vencidos.length > 0 || vencendo.length > 0) && (
        <div className="space-y-2 mb-5">
          {vencidos.length > 0 && (
            <div className="bg-red-50 border border-red-500/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">🚨</span>
              <div>
                <p className="text-red-700 font-bold text-sm uppercase tracking-wide">Produto(s) VENCIDO(S)</p>
                <p className="text-red-700/70 text-xs mt-0.5">{vencidos.map(e => e.nomeCorte).join(', ')}</p>
              </div>
            </div>
          )}
          {vencendo.length > 0 && (
            <div className="bg-amber-50 border border-brand-600/40 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-700 font-bold text-sm uppercase tracking-wide">Vencendo em breve</p>
                <p className="text-amber-700/70 text-xs mt-0.5">{vencendo.map(e => e.nomeCorte).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32 text-stone-500">
          <span className="text-sm animate-pulse">Carregando...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* CAIXA */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-stone-200 rounded-xl p-6">
              <p className="text-xs text-stone-500 font-medium font-bold mb-3">Faturamento de Hoje</p>
              <p className="text-6xl font-bold text-emerald-700" style={{ fontFamily:'"Share Tech Mono",monospace', textShadow:'0 0 20px rgba(52,211,153,0.3)' }}>
                {fmt(caixa.totalDia)}
              </p>
              <p className="text-xs text-stone-500 mt-2">{caixa.ultimasVendas.filter(v=>!v.cancelado).length} venda(s) • {caixa.totalCanceladas || 0} cancelada(s)</p>
              {/* Por forma */}
              {caixa.porForma && Object.values(caixa.porForma).some(v=>v>0) && (
                <div className="flex gap-3 mt-3 flex-wrap">
                  {Object.entries(caixa.porForma).map(([f,v]) => v > 0 && (
                    <span key={f} className="text-xs bg-stone-100 px-2 py-1 rounded flex items-center gap-1 text-stone-700">
                      {FORMA_ICON[f]} {fmt(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ULTIMAS VENDAS */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden flex-1">
              <div className="px-5 py-4 border-b border-stone-200">
                <p className="text-xs text-stone-500 font-medium font-bold">Ultimas Vendas</p>
              </div>
              <div className="overflow-y-auto max-h-80">
                {caixa.ultimasVendas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-stone-600 gap-2">
                    <span className="text-3xl">🧾</span>
                    <p className="text-xs font-medium">Nenhuma venda hoje</p>
                  </div>
                ) : caixa.ultimasVendas.map((v, i) => (
                  <div key={v.id ?? i} className={`px-5 py-3 border-b border-stone-200/50 hover:bg-stone-100/30 transition-colors group ${v.cancelado ? 'opacity-40' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-stone-500">{new Date(v.horario).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</p>
                          <span className="text-xs">{FORMA_ICON[v.formaPagamento]}</span>
                          {v.cancelado && <span className="text-xs text-red-700 font-bold uppercase">cancelado</span>}
                        </div>
                        <p className="text-xs text-stone-600 mt-0.5">{v.itens.map(i=>i.nome).join(', ')}</p>
                        {v.troco > 0 && <p className="text-xs text-stone-500">troco: {fmt(v.troco)}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${v.cancelado ? 'line-through text-stone-500' : 'text-emerald-700'}`}>{fmt(v.total)}</span>
                        {!v.cancelado && (
                          <button onClick={() => cancelarVenda(v.id, v.total)} disabled={cancelando === v.id}
                            className="text-xs text-stone-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-200 px-2 py-0.5 rounded">
                            {cancelando === v.id ? '...' : '↩'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ESTOQUE */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-stone-500 font-medium font-bold">Saldo de Estoque</p>
                <div className="flex gap-2">
                  {vencidos.length > 0 && <span className="text-xs bg-red-500/20 text-red-700 border border-red-500/30 px-2 py-0.5 rounded font-bold">{vencidos.length} vencido(s)</span>}
                  {estoqueBaixo.length > 0 && <span className="text-xs bg-brand-600/20 text-amber-700 border border-brand-600/30 px-2 py-0.5 rounded font-bold">{estoqueBaixo.length} baixo</span>}
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">🔍</span>
                <input
                  type="text"
                  value={buscaEstoque}
                  onChange={e => setBuscaEstoque(e.target.value)}
                  placeholder="Buscar por nome..."
                  className="w-full bg-stone-100 border border-stone-300 rounded-lg pl-9 pr-8 py-2 text-sm text-stone-900 focus:outline-none focus:border-brand-500 transition-colors"
                />
                {buscaEstoque && (
                  <button onClick={() => setBuscaEstoque('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-lg font-bold">×</button>
                )}
              </div>
            </div>
            {estoque.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-stone-600 gap-2">
                <span className="text-3xl">📦</span>
                <p className="text-xs font-medium">Estoque vazio</p>
              </div>
            ) : (
              <table className="w-full">
                <thead><tr className="border-b border-stone-200">
                  {['Corte','Tipo','Saldo','Validade','Status'].map((h,i) => (
                    <th key={h} className={`text-xs text-stone-500 font-medium py-3 px-4 font-normal ${i===0?'text-left':'text-right'}`}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {estoqueFiltrado.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-stone-400 text-sm">Nenhum produto encontrado para "{buscaEstoque}"</td></tr>
                  ) : estoqueFiltrado.map((item) => {
                    const baixo = item.tipo === 'UN' ? item.pesoKg <= 5 : item.pesoKg < 3; const zerado=item.pesoKg<=0;
                    const val = item.statusValidade;
                    const rowBg = val === 'VENCIDO' ? 'bg-red-50 hover:bg-red-100' : val === 'VENCENDO' ? 'bg-amber-50 hover:bg-amber-100' : baixo ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-stone-100';
                    return (
                      <tr key={item.id} className={`border-b border-stone-200/50 transition-colors group ${rowBg}`}>
                        <td className="py-3 px-4 text-sm font-bold text-stone-900">{item.nomeCorte}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold border ${item.tipo === 'UN' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' : 'bg-brand-600/10 text-amber-700 border-brand-600/20'}`}>
                        {item.tipo === 'UN' ? '🍢 UN' : '⚖️ KG'}
                      </span>
                    </td>
                        <td className={`py-3 px-4 text-right font-bold font-mono text-lg ${zerado?'text-red-700':baixo?'text-red-700':'text-stone-900'}`}>
                          {item.tipo === 'UN'
                            ? <>{Math.floor(item.pesoKg)}<span className="text-xs text-stone-500 font-normal ml-1">un</span></>
                            : <>{item.pesoKg.toFixed(3)}<span className="text-xs text-stone-500 font-normal ml-1">kg</span></>
                          }
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-stone-500">
                          {item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {val === 'VENCIDO'   ? <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-700 border border-red-500/30 font-bold">VENCIDO</span>
                          : val === 'VENCENDO' ? <span className="text-xs px-2 py-1 rounded bg-brand-600/20 text-amber-700 border border-brand-600/30 font-bold">VENCENDO</span>
                          : zerado ? <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-700 border border-red-500/30 font-bold">ESGOTADO</span>
                          : baixo  ? <span className="text-xs px-2 py-1 rounded bg-red-400/10 text-red-700 border border-red-400/30 font-bold">BAIXO</span>
                          :          <span className="text-xs px-2 py-1 rounded bg-emerald-400/10 text-emerald-700 border border-emerald-400/30 font-bold">OK</span>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button onClick={() => removerEstoque(item)}
                            className="text-stone-600 hover:text-red-700 transition-colors text-lg opacity-0 group-hover:opacity-100">×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot><tr className="border-t-2 border-stone-300 bg-stone-100/50">
                  <td className="py-3 px-4 text-xs text-stone-600 font-bold">Total</td>
                  <td className="py-3 px-4 text-right font-bold font-mono text-stone-900 text-sm">
                    {estoqueFiltrado.filter(i=>i.tipo!=='UN').reduce((s,i)=>s+i.pesoKg,0).toFixed(3)} kg
                    {estoqueFiltrado.some(i=>i.tipo==='UN') && <span className="ml-2 text-blue-700">{estoqueFiltrado.filter(i=>i.tipo==='UN').reduce((s,i)=>s+i.pesoKg,0)} un</span>}
                  </td>
                  <td colSpan={2} />
                </tr></tfoot>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
