import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });

const dataHoje = () => new Date().toISOString().split('T')[0];
const dataInicioMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
};

export default function HistoricoVendas() {
  const [vendas, setVendas]       = useState([]);
  const [resumo, setResumo]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [pagina, setPagina]       = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [filtros, setFiltros]     = useState({ de: '', ate: '' });
  const [filtrosAtivos, setFiltrosAtivos] = useState({ de: '', ate: '' });
  const [expandido, setExpandido] = useState(null);

  const carregar = useCallback(async (pag = 1, filtrosSalvos = filtrosAtivos) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pagina: pag, limite: 30 });
      if (filtrosSalvos.de)  params.append('de', filtrosSalvos.de);
      if (filtrosSalvos.ate) params.append('ate', filtrosSalvos.ate);

      const [resVendas, resRelatorio] = await Promise.all([
        api.get(`/historico/vendas?${params}`),
        api.get(`/historico/relatorio?${params}`)
      ]);

      setVendas(resVendas.data.vendas);
      setTotalPaginas(resVendas.data.paginas);
      setPagina(pag);
      setResumo(resRelatorio.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filtrosAtivos]);

  useEffect(() => { carregar(1, { de: '', ate: '' }); }, []);

  const cancelarVenda = async (id) => {
    if (!confirm('Cancelar esta venda? O estoque sera estornado. Apenas vendas do dia podem ser canceladas.')) return;
    try {
      await api.patch(`/gestao/venda/${id}/cancelar`);
      carregar(pagina, filtrosAtivos);
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar venda.');
    }
  };

  const aplicarFiltro = () => {
    setFiltrosAtivos({ ...filtros });
    carregar(1, filtros);
  };

  const aplicarHoje = () => {
    const f = { de: dataHoje(), ate: dataHoje() };
    setFiltros(f); setFiltrosAtivos(f);
    carregar(1, f);
  };

  const aplicarMes = () => {
    const f = { de: dataInicioMes(), ate: dataHoje() };
    setFiltros(f); setFiltrosAtivos(f);
    carregar(1, f);
  };

  const limpar = () => {
    const f = { de: '', ate: '' };
    setFiltros(f); setFiltrosAtivos(f);
    carregar(1, f);
  };

  return (
    <div className="min-h-screen bg-page p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Historico de Vendas</h1>
          <p className="text-xs text-stone-500 mt-0.5">Consulte vendas por periodo com detalhes</p>
        </div>
      </div>

      {/* FILTROS */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">De</label>
          <input type="date" value={filtros.de} onChange={e => setFiltros(f => ({...f, de: e.target.value}))}
            className="bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500 font-mono" />
        </div>
        <div>
          <label className="block text-xs text-stone-500 font-medium mb-1">Ate</label>
          <input type="date" value={filtros.ate} onChange={e => setFiltros(f => ({...f, ate: e.target.value}))}
            className="bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500 font-mono" />
        </div>
        <button onClick={aplicarFiltro} className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-5 py-2 rounded transition-all">Filtrar</button>
        <button onClick={aplicarHoje} className="bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs px-4 py-2 rounded transition-all">Hoje</button>
        <button onClick={aplicarMes} className="bg-stone-200 hover:bg-stone-300 text-stone-900 text-xs px-4 py-2 rounded transition-all">Este Mes</button>
        <button onClick={limpar} className="text-xs text-stone-500 hover:text-stone-700 transition-all px-2 py-2">Limpar</button>
      </div>

      {/* CARDS RESUMO */}
      {resumo && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label:'Total de Vendas', valor: resumo.totalVendas, cor:'border-stone-200', icon:'🧾' },
            { label:'Faturamento', valor: fmt(resumo.faturamentoTotal), cor:'border-emerald-500/20', icon:'💰' },
            { label:'Ticket Medio', valor: fmt(resumo.ticketMedio), cor:'border-brand-600/20', icon:'📊' },
            { label:'Top Corte', valor: resumo.topCortes?.[0]?.nome || 'Sem dados', cor:'border-stone-200', icon:'🥩' },
          ].map(({label,valor,cor,icon}) => (
            <div key={label} className={`bg-white border rounded-xl p-4 ${cor}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-stone-500 font-medium mb-1">{label}</p>
                  <p className="text-xl font-bold text-stone-900 truncate">{valor}</p>
                </div>
                <span className="text-2xl ml-2">{icon}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TABELA */}
      {loading ? (
        <div className="flex justify-center py-16 text-stone-500">
          <span className="animate-pulse text-sm">Carregando...</span>
        </div>
      ) : vendas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-stone-600 gap-2">
          <span className="text-4xl">🧾</span>
          <p className="text-xs font-medium">Nenhuma venda no periodo</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-stone-200">
              {['Data/Hora','Itens','Total',''].map((h,i) => (
                <th key={i} className={`text-xs text-stone-500 font-medium py-3 px-5 font-normal ${i===2?'text-right':'text-left'}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {vendas.map((v) => (
                <React.Fragment key={v.id}>
                  <tr
                    className="border-b border-stone-200/50 hover:bg-stone-100/30 transition-colors cursor-pointer"
                    onClick={() => setExpandido(expandido === v.id ? null : v.id)}>
                    <td className="py-3 px-5 text-sm text-stone-700">{fmtData(v.data)}</td>
                    <td className="py-3 px-5 text-xs text-stone-600 max-w-xs truncate">{v.itens.map(i => i.nome).join(', ')}</td>
                    <td className="py-3 px-5 text-sm font-bold text-emerald-700 text-right">{fmt(v.total)}</td>
                    <td className="py-3 px-5 text-xs text-stone-500 text-right">{expandido === v.id ? '▲' : '▼'}</td>
                  </tr>
                  {expandido === v.id && (
                    <tr className="border-b border-stone-200/30 bg-stone-100/20">
                      <td colSpan={4} className="px-8 py-4">
                        <div className="grid grid-cols-3 gap-2">
                          {v.itens.map((item, i) => (
                            <div key={i} className="bg-stone-100 rounded-lg px-3 py-2.5 text-xs">
                              <p className="font-bold text-stone-900">{item.nome}</p>
                              {item.unidade === 'UN'
                                ? <p className="text-stone-600 mt-0.5">{parseFloat(item.peso)} un × R$ {parseFloat(item.precoKg).toFixed(2)}/un</p>
                                : <p className="text-stone-600 mt-0.5">{parseFloat(item.peso).toFixed(3)} kg × R$ {parseFloat(item.precoKg).toFixed(2)}/kg</p>
                              }
                              <p className="text-emerald-700 font-bold mt-1">{fmt(item.total)}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-right text-xs text-stone-500 mt-2">Venda #{v.id}</p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* PAGINACAO */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-stone-200">
              <p className="text-xs text-stone-500">Pagina {pagina} de {totalPaginas}</p>
              <div className="flex gap-2">
                <button onClick={() => carregar(pagina - 1)} disabled={pagina === 1}
                  className="text-xs px-4 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all">← Anterior</button>
                <button onClick={() => carregar(pagina + 1)} disabled={pagina === totalPaginas}
                  className="text-xs px-4 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-all">Proxima →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
