import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const TooltipCustom = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lift">
      <p className="text-stone-500 mb-1">{label}</p>
      <p className="text-emerald-700 font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
};

const FORMA_INFO = {
  DINHEIRO: { label: 'Dinheiro', icon: '💵', barCor: 'bg-emerald-500' },
  PIX:      { label: 'PIX',      icon: '📱', barCor: 'bg-teal-500' },
  DEBITO:   { label: 'Débito',   icon: '💳', barCor: 'bg-blue-500' },
  CREDITO:  { label: 'Crédito',  icon: '💳', barCor: 'bg-indigo-500' },
  VOUCHER:  { label: 'Voucher',  icon: '🎫', barCor: 'bg-amber-500' },
};

export default function DashboardCliente() {
  const [dados, setDados]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState(null);

  const cliente = (() => { try { return JSON.parse(localStorage.getItem('cliente')); } catch { return null; } })();

  const carregar = async () => {
    setLoading(true); setErro(null);
    try {
      const { data } = await api.get('/dashboard/resumo');
      setDados(data);
    } catch { setErro('Erro ao carregar dashboard.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  if (loading) return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <span className="text-stone-500 text-sm animate-pulse">Carregando indicadores...</span>
    </div>
  );

  if (erro || !dados) return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center space-y-3">
        <span className="text-4xl">📊</span>
        <p className="text-red-700 text-sm">{erro || 'Erro desconhecido'}</p>
        <button onClick={carregar} className="text-xs text-stone-500 hover:text-stone-900 border border-stone-300 px-4 py-2 rounded">Tentar novamente</button>
      </div>
    </div>
  );

  const maxBar = Math.max(...(dados.faturamentoDiario?.map(d => d.total) ?? [1]), 1);

  return (
    <div className="min-h-screen bg-page p-6">
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
            {saudacao}, <span className="text-amber-700">{cliente?.nomeAcougue ?? 'Açougue'}</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Painel Executivo — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </p>
        </div>
        <button onClick={carregar} className="self-start sm:self-auto text-xs font-medium text-stone-600 hover:text-stone-900 bg-white border border-stone-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-stone-50 transition-colors flex items-center gap-1.5">
          <span>🔄</span> Atualizar indicadores
        </button>
      </div>

      {/* 4 CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {[
          {
            label: 'Vendas Hoje',
            valor: fmt(dados.faturamentoHoje),
            sub: `${dados.totalVendasHoje || 0} venda(s) realizada(s)`,
            cor: 'border-amber-500/20',
            icon: '⚡',
          },
          {
            label: 'Faturamento do Mês',
            valor: fmt(dados.faturamentoMes),
            sub: `${dados.totalVendas || 0} venda(s) no mês`,
            cor: 'border-emerald-500/20',
            icon: '💰',
          },
          {
            label: 'Ticket Médio',
            valor: fmt(dados.ticketMedio),
            sub: 'Média por venda no mês',
            cor: 'border-blue-500/20',
            icon: '🧾',
          },
          {
            label: 'Volume de Carne Vendido',
            valor: `${(dados.volumeVendido?.totalKg || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`,
            sub: `Média ~${(dados.volumeVendido?.mediaKgDia || 0).toFixed(1)} kg / dia`,
            cor: 'border-rose-500/20',
            icon: '🥩',
          },
        ].map(({ label, valor, sub, cor, icon }) => (
          <div key={label} className={`bg-white border rounded-xl p-5 shadow-sm ${cor}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 font-medium mb-1.5">{label}</p>
                <p className="text-2xl font-bold text-stone-900">{valor}</p>
                {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
              </div>
              <span className="text-3xl">{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* GRAFICO + TOP 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-7">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-stone-500 font-semibold mb-5">Faturamento — últimos 7 dias</p>
          {dados.faturamentoDiario?.every(d => d.total === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-600 gap-2">
              <span className="text-3xl">📊</span>
              <p className="text-xs font-medium">Sem vendas na semana</p>
              <p className="text-xs text-stone-500">Registre vendas no PDV para ver o gráfico</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={dados.faturamentoDiario} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6B6055' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6055' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '' : `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<TooltipCustom />} cursor={{ fill: 'rgba(154,52,18,0.05)' }} />
                <Bar dataKey="total" radius={[6,6,0,0]}>
                  {dados.faturamentoDiario?.map((entry, i) => (
                    <Cell key={i} fill={entry.total === maxBar && maxBar > 0 ? '#9A3412' : '#15803D'} fillOpacity={entry.total === 0 ? 0.2 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-stone-500 font-bold mb-5">Top Cortes do Mês</p>
          {!dados.top3?.length ? (
            <div className="flex flex-col items-center justify-center h-40 text-stone-600 gap-2">
              <span className="text-3xl">🏆</span>
              <p className="text-xs font-medium">Sem vendas registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dados.top3.map((corte, i) => {
                const medalhas = ['🥇','🥈','🥉'];
                const pct = dados.top3[0]?.receita > 0 ? (corte.receita / dados.top3[0].receita) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{medalhas[i]}</span>
                        <div>
                          <p className="text-sm font-bold text-stone-900 leading-none">{corte.nome}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{corte.peso ? `${corte.peso.toFixed(2)} kg` : 'Venda avulsa'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-700">{fmt(corte.receita)}</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ANÁLISE E INDICADORES COMERCIAIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
        {/* MIX DE FORMAS DE PAGAMENTO */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-stone-500 font-bold">💳 Formas de Pagamento</p>
            <span className="text-xs text-stone-600">Mês atual</span>
          </div>

          {!dados.formasPagamento?.length ? (
            <div className="flex flex-col items-center justify-center h-32 text-stone-600 text-xs">
              Nenhum pagamento registrado
            </div>
          ) : (
            <div className="space-y-3">
              {dados.formasPagamento.map((p) => {
                const info = FORMA_INFO[p.forma] || { label: p.forma, icon: '💰', barCor: 'bg-stone-500' };
                return (
                  <div key={p.forma}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-stone-700 flex items-center gap-1.5">
                        <span>{info.icon}</span> {info.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-stone-500">{fmt(p.valor)}</span>
                        <span className="font-bold text-stone-900 w-9 text-right">{p.percentual}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full ${info.barCor} transition-all duration-500`} style={{ width: `${p.percentual}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DIA DE MAIOR MOVIMENTO */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-stone-500 font-bold">📅 Dia de Maior Movimento</p>
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-800 border border-amber-500/20">
                Pico Semanal
              </span>
            </div>
            <div className="my-2">
              <p className="text-2xl font-bold text-stone-900">{dados.diaMaisForte?.nome || '—'}</p>
              <p className="text-xs font-semibold text-stone-600 mt-1">
                {fmt(dados.diaMaisForte?.total)} acumulados ({dados.diaMaisForte?.vendas || 0} vendas)
              </p>
            </div>
          </div>
          <div className="bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5 mt-3 text-[11px] text-amber-900 leading-snug">
            💡 Representa <strong>{dados.diaMaisForte?.percentual || 0}%</strong> do faturamento mensal. Ideal para reforçar a equipe e o estoque de cortes especiais.
          </div>
        </div>

        {/* HORÁRIO DE PICO */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-stone-500 font-bold">⏰ Horário de Pico no Balcão</p>
              <span className="text-xs px-2 py-0.5 rounded font-bold bg-blue-500/10 text-blue-800 border border-blue-500/20">
                Fluxo de Clientes
              </span>
            </div>
            <div className="my-2">
              <p className="text-2xl font-bold text-stone-900">{dados.horarioPico?.faixa || '—'}</p>
              <p className="text-xs font-semibold text-stone-600 mt-1">
                {dados.horarioPico?.totalVendas || 0} atendimentos realizados neste turno
              </p>
            </div>
          </div>
          <div className="bg-blue-50/60 border border-blue-200/60 rounded-lg p-2.5 mt-3 text-[11px] text-blue-900 leading-snug">
            ⚡ Concentra <strong>{dados.horarioPico?.percentual || 0}%</strong> das vendas. Mantenha balcão e caixas ágeis nesse período para evitar filas.
          </div>
        </div>
      </div>
    </div>
  );
}
