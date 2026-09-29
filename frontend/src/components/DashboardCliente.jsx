import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtQtd = (val, unidade = 'kg') => {
  const n = Number(val);
  if (!isFinite(n) || isNaN(n) || n < 0) return `0 ${unidade}`;
  if (n > 999999) return `> 999k ${unidade}`;
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: unidade === 'kg' ? 1 : 0, maximumFractionDigits: 1 })} ${unidade}`;
};

const TooltipCustom = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-xs shadow-lift">
      <p className="text-stone-500 mb-1">{label}</p>
      <p className="text-emerald-700 font-bold">{fmt(payload[0].value)}</p>
    </div>
  );
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
      <span className="text-stone-500 text-sm animate-pulse">Carregando dashboard...</span>
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
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
          {saudacao}, <span className="text-amber-700">{cliente?.nomeAcougue ?? 'Acougue'}</span>
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          Dashboard — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-3 gap-4 mb-7">
        {[
          { label:'Faturamento do Mes', valor: fmt(dados.faturamentoMes), sub:`${dados.totalVendas} venda(s)`, cor:'border-emerald-500/20', icon:'💰' },
          { label:'Ticket Medio', valor: fmt(dados.ticketMedio), sub:'Por venda no mes', cor:'border-brand-600/20', icon:'🧾' },
          {
            label:'Estoque',
            valor:`${fmtQtd(dados.estoque?.totalKg, 'kg')}${dados.estoque?.totalUn ? ` + ${fmtQtd(dados.estoque.totalUn, 'un')}` : ''}`,
            sub: dados.estoque?.alertasBaixo > 0 ? `⚠ ${dados.estoque.alertasBaixo} item(s) baixo` : `${dados.estoque?.itens || 0} produto(s)`,
            cor: dados.estoque?.alertasBaixo > 0 ? 'border-red-500/30' : 'border-stone-200', icon:'📦'
          },
        ].map(({ label, valor, sub, cor, icon }) => (
          <div key={label} className={`bg-white border rounded-xl p-5 ${cor}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-stone-500 font-medium mb-2">{label}</p>
                <p className="text-3xl font-bold text-stone-900">{valor}</p>
                {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
              </div>
              <span className="text-3xl">{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* GRAFICO + TOP 3 */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2 bg-white border border-stone-200 rounded-xl p-5 shadow-soft">
          <p className="text-xs text-stone-500 font-semibold mb-5">Faturamento — últimos 7 dias</p>
          {dados.faturamentoDiario.every(d => d.total === 0) ? (
            <div className="flex flex-col items-center justify-center h-48 text-stone-600 gap-2">
              <span className="text-3xl">📊</span>
              <p className="text-xs font-medium">Sem vendas na semana</p>
              <p className="text-xs text-stone-500">Registre vendas no PDV para ver o gráfico</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dados.faturamentoDiario} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D5" vertical={false} />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6B6055' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#6B6055' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '' : `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<TooltipCustom />} cursor={{ fill: 'rgba(154,52,18,0.05)' }} />
                <Bar dataKey="total" radius={[6,6,0,0]}>
                  {dados.faturamentoDiario.map((entry, i) => (
                    <Cell key={i} fill={entry.total === maxBar && maxBar > 0 ? '#9A3412' : '#15803D'} fillOpacity={entry.total === 0 ? 0.2 : 1} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs text-stone-500 font-medium font-bold mb-5">Top Cortes do Mes</p>
          {dados.top3.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-stone-600 gap-2">
              <span className="text-3xl">🏆</span>
              <p className="text-xs font-medium">Sem dados ainda</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dados.top3.map((corte, i) => {
                const medalhas = ['🥇','🥈','🥉'];
                const pct = dados.top3[0].receita > 0 ? (corte.receita / dados.top3[0].receita) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{medalhas[i]}</span>
                        <div>
                          <p className="text-sm font-bold text-stone-900 leading-none">{corte.nome}</p>
                          <p className="text-xs text-stone-500 mt-0.5">{corte.peso.toFixed(2)} kg</p>
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

      <div className="flex justify-end">
        <button onClick={carregar} className="text-xs text-stone-500 hover:text-stone-600 transition-colors">
          Atualizar dados
        </button>
      </div>
    </div>
  );
}
