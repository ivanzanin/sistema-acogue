import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMA_ICON = { DINHEIRO: '💵', PIX: '📱', DEBITO: '💳', CREDITO: '💳', VOUCHER: '🎫', MULTIPLO: '👥' };

const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7',    label: '7 Dias' },
  { id: '30',   label: '30 Dias' },
  { id: '90',   label: '90 Dias' },
  { id: '180',  label: '180 Dias' },
  { id: 'todas', label: 'Todas' },
];

export default function PainelGestao() {
  const [caixa, setCaixa]             = useState({ totalDia: 0, ultimasVendas: [], porForma: {}, totalCanceladas: 0 });
  const [estoque, setEstoque]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [cancelando, setCancelando]   = useState(null);

  // Aba ativa: 'vendas' (padrão) ou 'estoque'
  const [tabAtiva, setTabAtiva]       = useState('vendas');

  // Estado das Vendas por Corte
  const [periodo, setPeriodo]         = useState('30');
  const [vendasData, setVendasData]   = useState({ totalVendas: 0, totalFaturamento: 0, totalKg: 0, totalUn: 0, produtos: [] });
  const [loadingVendas, setLoadingVendas] = useState(false);
  const [buscaVendas, setBuscaVendas] = useState('');
  const [ordenacao, setOrdenacao]     = useState('faturamento'); // 'faturamento', 'volume', 'frequencia'

  // Busca do estoque antigo
  const [buscaEstoque, setBuscaEstoque] = useState('');

  const carregarCaixaEstoque = async () => {
    try {
      const [resCaixa, resEstoque] = await Promise.all([
        api.get('/gestao/caixa/hoje'),
        api.get('/gestao/estoque'),
      ]);
      setCaixa(resCaixa.data);
      setEstoque(resEstoque.data);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('Erro ao carregar caixa/estoque:', e);
    }
  };

  const carregarVendasProdutos = async (p = periodo) => {
    setLoadingVendas(true);
    try {
      const { data } = await api.get('/gestao/vendas-produtos', { params: { dias: p } });
      setVendasData(data);
    } catch (e) {
      console.error('Erro ao carregar vendas por produto:', e);
    } finally {
      setLoadingVendas(false);
    }
  };

  const carregarTudo = async () => {
    setLoading(true);
    await Promise.all([carregarCaixaEstoque(), carregarVendasProdutos(periodo)]);
    setLoading(false);
  };

  useEffect(() => {
    carregarTudo();
    const i = setInterval(carregarCaixaEstoque, 30000);
    return () => clearInterval(i);
  }, []);

  const trocarPeriodo = (novoPeriodo) => {
    setPeriodo(novoPeriodo);
    carregarVendasProdutos(novoPeriodo);
  };

  const removerEstoque = async (item) => {
    const nome = item.nomeCorte;
    if (!confirm(`Remover "${nome}" do estoque? Esta ação não pode ser desfeita.`)) return;
    try {
      await api.delete(`/gestao/estoque/${item.id}`);
      carregarCaixaEstoque();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao remover.');
    }
  };

  const cancelarVenda = async (id, total) => {
    if (!confirm(`Cancelar venda de ${fmt(total)}? O estoque será estornado.`)) return;
    setCancelando(id);
    try {
      await api.patch(`/gestao/venda/${id}/cancelar`);
      carregarCaixaEstoque();
      carregarVendasProdutos(periodo);
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar.');
    } finally {
      setCancelando(null);
    }
  };

  // Alertas de validade (apenas para a aba de estoque)
  const vencidos   = estoque.filter(e => e.statusValidade === 'VENCIDO');
  const vencendo   = estoque.filter(e => e.statusValidade === 'VENCENDO');
  const estoqueBaixo = estoque.filter(e => e.pesoKg < 3 && e.pesoKg > 0);
  const estoqueFiltrado = buscaEstoque.trim()
    ? estoque.filter(e => e.nomeCorte.toLowerCase().includes(buscaEstoque.toLowerCase()))
    : estoque;

  // Filtragem e ordenação dos produtos vendidos
  const produtosFiltrados = (vendasData.produtos || []).filter(p =>
    !buscaVendas.trim() || p.nome.toLowerCase().includes(buscaVendas.toLowerCase())
  );

  produtosFiltrados.sort((a, b) => {
    if (ordenacao === 'volume') {
      return (b.volume || 0) - (a.volume || 0);
    }
    if (ordenacao === 'frequencia') {
      return (b.qtdTransacoes || 0) - (a.qtdTransacoes || 0);
    }
    return (b.faturamento || 0) - (a.faturamento || 0);
  });

  const getRankBadge = (index) => {
    if (index === 0) return <span className="text-base" title="1º Lugar">🥇</span>;
    if (index === 1) return <span className="text-base" title="2º Lugar">🥈</span>;
    if (index === 2) return <span className="text-base" title="3º Lugar">🥉</span>;
    return <span className="text-xs font-mono font-bold text-stone-600">#{index + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-page p-4 md:p-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥩</span>
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Painel de Gestão</h1>
          </div>
          <p className="text-xs text-stone-700 font-medium mt-0.5">
            Movimento do caixa e relatório de cortes vendidos
            {lastUpdate && ` • Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR')}`}
          </p>
        </div>
        <button
          onClick={carregarTudo}
          className="text-xs text-stone-800 hover:text-stone-900 bg-white border border-stone-300 hover:border-stone-400 px-4 py-2 rounded-lg font-bold shadow-sm transition-all flex items-center gap-1.5"
        >
          <span>🔄</span> Atualizar Dados
        </button>
      </div>

      {/* ALERTA DE VALIDADE (Apenas se estiver na aba de Estoque) */}
      {tabAtiva === 'estoque' && (vencidos.length > 0 || vencendo.length > 0) && (
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
        <div className="flex flex-col items-center justify-center py-32 text-stone-600 gap-3">
          <span className="text-3xl animate-spin">⏳</span>
          <span className="text-sm font-semibold">Carregando dados da gestão...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUNA ESQUERDA: CAIXA DO DIA E ÚLTIMAS VENDAS */}
          <div className="flex flex-col gap-5">
            {/* Card Faturamento Hoje */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-stone-700 uppercase tracking-wider font-bold">Faturamento de Hoje</p>
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                  {caixa.ultimasVendas.filter(v => !v.cancelado).length} vendas
                </span>
              </div>
              <p
                className="text-5xl font-bold text-emerald-700 tracking-tight"
                style={{ fontFamily: '"Share Tech Mono", monospace', textShadow: '0 0 20px rgba(52,211,153,0.25)' }}
              >
                {fmt(caixa.totalDia)}
              </p>
              <p className="text-xs text-stone-700 font-medium mt-2">
                {caixa.ultimasVendas.filter(v => !v.cancelado).length} venda(s) ativas • {caixa.totalCanceladas || 0} cancelada(s)
              </p>

              {/* Mix por forma de pagamento */}
              {caixa.porForma && Object.values(caixa.porForma).some(v => v > 0) && (
                <div className="flex gap-2 mt-4 flex-wrap pt-3 border-t border-stone-100">
                  {Object.entries(caixa.porForma).map(([f, v]) => v > 0 && (
                    <span key={f} className="text-xs bg-stone-50 border border-stone-200 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-stone-800 font-medium">
                      <span>{FORMA_ICON[f] || '💳'}</span>
                      <span className="font-bold">{fmt(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Card Últimas Vendas do Dia */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm flex flex-col flex-1">
              <div className="px-5 py-4 border-b border-stone-200 bg-stone-50/50 flex justify-between items-center">
                <p className="text-xs text-stone-800 font-bold uppercase tracking-wider">Últimas Vendas no Caixa</p>
                <span className="text-xs text-stone-600 font-medium">Tempo real</span>
              </div>
              <div className="overflow-y-auto max-h-[460px] divide-y divide-stone-100">
                {caixa.ultimasVendas.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-stone-600 gap-2">
                    <span className="text-4xl">🧾</span>
                    <p className="text-xs font-semibold">Nenhuma venda realizada hoje ainda</p>
                  </div>
                ) : caixa.ultimasVendas.map((v, i) => (
                  <div
                    key={v.id ?? i}
                    className={`px-5 py-3 hover:bg-stone-50 transition-colors group ${v.cancelado ? 'opacity-40 bg-stone-50/60' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-stone-600">
                            {new Date(v.horario).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <span className="text-xs">{FORMA_ICON[v.formaPagamento] || '💳'}</span>
                          <span className="text-[11px] font-bold text-stone-700">{v.formaPagamento}</span>
                          {v.cancelado && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold uppercase">
                              cancelada
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-stone-800 mt-1 line-clamp-1 font-medium">
                          {v.itens.map(it => `${it.nome} (${it.unidade === 'UN' ? `${it.quantidade || 1} un` : `${Number(it.peso || 0).toFixed(3)} kg`})`).join(' • ')}
                        </p>
                        {v.troco > 0 && <p className="text-[11px] text-stone-600 mt-0.5">Troco devolvido: {fmt(v.troco)}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-base font-bold font-mono ${v.cancelado ? 'line-through text-stone-500' : 'text-emerald-700'}`}>
                          {fmt(v.total)}
                        </span>
                        {!v.cancelado && (
                          <button
                            onClick={() => cancelarVenda(v.id, v.total)}
                            disabled={cancelando === v.id}
                            title="Estornar / Cancelar venda"
                            className="text-xs text-stone-600 hover:text-red-700 bg-stone-100 hover:bg-red-50 p-1.5 rounded border border-stone-200 hover:border-red-200 transition-all opacity-0 group-hover:opacity-100"
                          >
                            {cancelando === v.id ? '...' : '↩ Cancelar'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* COLUNA DIREITA: VENDAS POR CORTE (PRINCIPAL) OU SALDO DE ESTOQUE */}
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {/* CABEÇALHO DA COLUNA: Abas Alternáveis */}
            <div className="p-4 border-b border-stone-200 bg-stone-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 bg-stone-200/80 p-1 rounded-lg self-start">
                <button
                  onClick={() => setTabAtiva('vendas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    tabAtiva === 'vendas'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  <span>🔥</span> Vendas por Corte
                </button>
                <button
                  onClick={() => setTabAtiva('estoque')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                    tabAtiva === 'estoque'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-700 hover:text-stone-900'
                  }`}
                >
                  <span>📦</span> Saldo de Estoque
                </button>
              </div>

              {/* Botões de Período (apenas na aba de vendas) */}
              {tabAtiva === 'vendas' && (
                <div className="flex items-center gap-1 flex-wrap">
                  {PERIODOS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => trocarPeriodo(p.id)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                        periodo === p.id
                          ? 'bg-brand-600 text-white shadow-sm'
                          : 'bg-white text-stone-700 hover:text-stone-900 border border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* CONTEÚDO DA ABA VENDAS POR CORTE */}
            {tabAtiva === 'vendas' && (
              <div className="p-4 flex-1 flex flex-col">
                {/* Faixa de Métricas Resumo do Período */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <div className="bg-stone-50 border border-stone-200/80 rounded-lg p-2.5">
                    <p className="text-[11px] text-stone-700 font-bold uppercase">Volume Carne (KG)</p>
                    <p className="text-lg font-bold text-stone-900 font-mono mt-0.5">
                      {vendasData.totalKg.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} <span className="text-xs font-normal text-stone-600">kg</span>
                    </p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200/80 rounded-lg p-2.5">
                    <p className="text-[11px] text-stone-700 font-bold uppercase">Itens Vendidos (UN)</p>
                    <p className="text-lg font-bold text-stone-900 font-mono mt-0.5">
                      {vendasData.totalUn} <span className="text-xs font-normal text-stone-600">un</span>
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200/70 rounded-lg p-2.5">
                    <p className="text-[11px] text-emerald-800 font-bold uppercase">Faturamento Cortes</p>
                    <p className="text-lg font-bold text-emerald-800 font-mono mt-0.5">
                      {fmt(vendasData.totalFaturamento)}
                    </p>
                  </div>
                  <div className="bg-stone-50 border border-stone-200/80 rounded-lg p-2.5">
                    <p className="text-[11px] text-stone-700 font-bold uppercase">Vendas no Período</p>
                    <p className="text-lg font-bold text-stone-900 font-mono mt-0.5">
                      {vendasData.totalVendas} <span className="text-xs font-normal text-stone-600">tickets</span>
                    </p>
                  </div>
                </div>

                {/* Filtro de Busca e Ordenação */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">🔍</span>
                    <input
                      type="text"
                      value={buscaVendas}
                      onChange={e => setBuscaVendas(e.target.value)}
                      placeholder="Buscar corte ou produto..."
                      className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 transition-colors"
                    />
                    {buscaVendas && (
                      <button
                        onClick={() => setBuscaVendas('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-sm font-bold"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto">
                    <span className="text-[11px] text-stone-600 font-bold mr-1">Ordenar:</span>
                    <button
                      onClick={() => setOrdenacao('faturamento')}
                      className={`text-[11px] px-2 py-1 rounded font-bold transition-all ${ordenacao === 'faturamento' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                      💰 Faturamento
                    </button>
                    <button
                      onClick={() => setOrdenacao('volume')}
                      className={`text-[11px] px-2 py-1 rounded font-bold transition-all ${ordenacao === 'volume' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                      ⚖️ Volume
                    </button>
                    <button
                      onClick={() => setOrdenacao('frequencia')}
                      className={`text-[11px] px-2 py-1 rounded font-bold transition-all ${ordenacao === 'frequencia' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`}
                    >
                      🧾 Frequência
                    </button>
                  </div>
                </div>

                {/* Tabela de Vendas por Produto */}
                <div className="overflow-x-auto overflow-y-auto max-h-[420px] border border-stone-200 rounded-lg flex-1">
                  {loadingVendas ? (
                    <div className="flex flex-col items-center justify-center py-20 text-stone-500 gap-2">
                      <span className="text-2xl animate-spin">⏳</span>
                      <p className="text-xs">Calculando vendas do período...</p>
                    </div>
                  ) : produtosFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-stone-500 gap-2">
                      <span className="text-3xl">🥩</span>
                      <p className="text-xs font-semibold">
                        {buscaVendas ? `Nenhum corte encontrado para "${buscaVendas}"` : 'Nenhuma venda registrada neste período.'}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        {buscaVendas ? 'Tente buscar por outro termo.' : 'Alterne para outro período no topo ou registre novas vendas no caixa.'}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100/80 sticky top-0 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Corte / Produto</th>
                          <th className="py-2.5 px-2 text-center">Tipo</th>
                          <th className="py-2.5 px-3 text-right">Volume Vendido</th>
                          <th className="py-2.5 px-3 text-right">Preço Médio</th>
                          <th className="py-2.5 px-3 text-right">Faturamento</th>
                          <th className="py-2.5 px-3 text-right w-24">% Mix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {produtosFiltrados.map((item, index) => {
                          const isTop = index < 3;
                          return (
                            <tr
                              key={item.nome}
                              className={`hover:bg-amber-50/40 transition-colors ${isTop ? 'bg-amber-50/15' : ''}`}
                            >
                              <td className="py-2.5 px-3 text-center">
                                {getRankBadge(index)}
                              </td>
                              <td className="py-2.5 px-3">
                                <p className="font-bold text-stone-900 text-sm">{item.nome}</p>
                                <p className="text-[10px] text-stone-500">
                                  Presente em <span className="font-semibold text-stone-700">{item.qtdTransacoes}</span> venda(s)
                                </p>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                  item.unidade === 'UN'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`}>
                                  {item.unidade === 'UN' ? '🍢 UN' : '⚖️ KG'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-900">
                                {item.unidade === 'UN' ? (
                                  <>{Math.round(item.volume)} <span className="text-[10px] font-normal text-stone-500">un</span></>
                                ) : (
                                  <>{Number(item.volume || 0).toFixed(3)} <span className="text-[10px] font-normal text-stone-500">kg</span></>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-stone-600">
                                {fmt(item.precoMedio)}
                                <span className="text-[10px] text-stone-400">/{item.unidade === 'UN' ? 'un' : 'kg'}</span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 text-sm">
                                {fmt(item.faturamento)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="font-bold font-mono text-stone-700 text-[11px]">
                                    {item.percentualReceita}%
                                  </span>
                                  <div className="w-16 bg-stone-200 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-brand-600 h-1.5 rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(2, item.percentualReceita))}%` }}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-stone-50 border-t-2 border-stone-200 font-bold">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 text-stone-700">
                            Total Geral ({produtosFiltrados.length} cortes)
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-stone-900">
                            {produtosFiltrados.filter(i => i.unidade !== 'UN').reduce((s, i) => s + (i.volume || 0), 0).toFixed(3)} kg
                          </td>
                          <td className="py-2.5 px-3 text-right text-stone-500">—</td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 text-sm">
                            {fmt(produtosFiltrados.reduce((s, i) => s + (i.faturamento || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3 text-right text-stone-700">100%</td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* CONTEÚDO DA ABA SALDO DE ESTOQUE (OPCIONAL) */}
            {tabAtiva === 'estoque' && (
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-stone-700 font-bold uppercase">Saldo Cadastrado de Estoque</p>
                    <p className="text-[11px] text-stone-500">Gerenciado manualmente pela Desossa ou Cadastro</p>
                  </div>
                  <div className="flex gap-2">
                    {vencidos.length > 0 && <span className="text-xs bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 rounded font-bold">{vencidos.length} vencido(s)</span>}
                    {estoqueBaixo.length > 0 && <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-bold">{estoqueBaixo.length} baixo</span>}
                  </div>
                </div>

                <div className="relative mb-3">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={buscaEstoque}
                    onChange={e => setBuscaEstoque(e.target.value)}
                    placeholder="Buscar corte no estoque..."
                    className="w-full bg-stone-50 border border-stone-300 rounded-lg pl-8 pr-7 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-brand-500 transition-colors"
                  />
                  {buscaEstoque && (
                    <button onClick={() => setBuscaEstoque('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-sm font-bold">×</button>
                  )}
                </div>

                {estoque.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-stone-500 gap-2">
                    <span className="text-3xl">📦</span>
                    <p className="text-xs font-semibold">Nenhum estoque registrado</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[420px] border border-stone-200 rounded-lg flex-1">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-100/80 sticky top-0 border-b border-stone-200 text-stone-600 font-bold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3">Corte</th>
                          <th className="py-2.5 px-2 text-center">Tipo</th>
                          <th className="py-2.5 px-3 text-right">Saldo</th>
                          <th className="py-2.5 px-3 text-right">Validade</th>
                          <th className="py-2.5 px-3 text-right">Status</th>
                          <th className="py-2.5 px-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {estoqueFiltrado.length === 0 ? (
                          <tr><td colSpan={6} className="py-10 text-center text-stone-400 text-xs">Nenhum produto encontrado para "{buscaEstoque}"</td></tr>
                        ) : estoqueFiltrado.map((item) => {
                          const isDiversos = item.nomeCorte?.toLowerCase() === 'diversos' || item.codigoBarras === '999';
                          const baixo = isDiversos ? false : (item.tipo === 'UN' ? item.pesoKg <= 5 : item.pesoKg < 3);
                          const zerado = isDiversos ? false : item.pesoKg <= 0;
                          const val = item.statusValidade;
                          const rowBg = val === 'VENCIDO' ? 'bg-red-50/50' : val === 'VENCENDO' ? 'bg-amber-50/50' : baixo ? 'bg-orange-50/50' : '';
                          return (
                            <tr key={item.id} className={`hover:bg-stone-50 transition-colors group ${rowBg}`}>
                              <td className="py-2.5 px-3 font-bold text-stone-900">{item.nomeCorte}</td>
                              <td className="py-2.5 px-2 text-center">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${item.tipo === 'UN' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                                  {item.tipo === 'UN' ? '🍢 UN' : '⚖️ KG'}
                                </span>
                              </td>
                              <td className={`py-2.5 px-3 text-right font-bold font-mono text-sm ${zerado ? 'text-red-700' : baixo ? 'text-amber-700' : 'text-stone-900'}`}>
                                {item.tipo === 'UN'
                                  ? <>{isDiversos ? '∞' : Math.floor(Number(item.pesoKg) || 0)}<span className="text-[10px] text-stone-500 font-normal ml-0.5">un</span></>
                                  : <>{(Number(item.pesoKg) || 0).toFixed(3)}<span className="text-[10px] text-stone-500 font-normal ml-0.5">kg</span></>
                                }
                              </td>
                              <td className="py-2.5 px-3 text-right text-stone-500 font-mono text-[11px]">
                                {item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {val === 'VENCIDO'   ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200">VENCIDO</span>
                                : val === 'VENCENDO' ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">VENCENDO</span>
                                : zerado             ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold border border-red-200">ESGOTADO</span>
                                : baixo              ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 font-bold border border-orange-200">BAIXO</span>
                                :                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">OK</span>}
                              </td>
                              <td className="py-2.5 px-2 text-right">
                                <button
                                  onClick={() => removerEstoque(item)}
                                  title="Remover corte"
                                  className="text-stone-400 hover:text-red-700 p-1 text-base opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-stone-50 border-t-2 border-stone-200 font-bold">
                        <tr>
                          <td className="py-2.5 px-3 text-stone-700">Total KG</td>
                          <td colSpan={2} className="py-2.5 px-3 text-right font-mono text-stone-900">
                            {estoqueFiltrado.filter(i => i.tipo !== 'UN').reduce((s, i) => s + (Number(i.pesoKg) || 0), 0).toFixed(3)} kg
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
