import React, { useState } from 'react';
import axios from 'axios';

const CORTES_PADRAO = [
  { nome: 'Picanha',    pesoKg: 0, precoVendaKg: 69.90 },
  { nome: 'Alcatra',   pesoKg: 0, precoVendaKg: 45.90 },
  { nome: 'Coxão Mole',pesoKg: 0, precoVendaKg: 38.90 },
];

export default function Desossa() {
  const [pesoEntrada, setPesoEntrada] = useState('');
  const [custoKg, setCustoKg]         = useState('');
  const [cortes, setCortes]           = useState(CORTES_PADRAO);
  const [resultado, setResultado]     = useState(null);
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState(null);

  const updateCorte = (i, field, val) => {
    const novo = [...cortes];
    novo[i] = { ...novo[i], [field]: field === 'nome' ? val : parseFloat(val) || 0 };
    setCortes(novo);
  };

  const addCorte = () => setCortes([...cortes, { nome: '', pesoKg: 0, precoVendaKg: 0 }]);
  const rmCorte  = (i) => setCortes(cortes.filter((_, idx) => idx !== i));

  const calcular = async () => {
    setLoading(true); setErro(null); setResultado(null);
    try {
      const { data } = await axios.post('/desossa/calcular', {
        pesoEntrada: parseFloat(pesoEntrada),
        custoKg: parseFloat(custoKg),
        cortes,
      });
      setResultado(data);
    } catch {
      setErro('Erro ao calcular. Verifique os dados e o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-page text-stone-900 p-8 font-mono">
      <h1 className="text-2xl font-bold text-amber-700 tracking-widest uppercase mb-8">Módulo de Desossa</h1>

      <div className="grid grid-cols-2 gap-8 max-w-5xl">
        {/* FORM */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Peso Entrada (kg)</label>
              <input type="number" value={pesoEntrada} onChange={e => setPesoEntrada(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500" placeholder="Ex: 50" />
            </div>
            <div>
              <label className="text-xs text-stone-500 font-medium block mb-1">Custo/kg (R$)</label>
              <input type="number" value={custoKg} onChange={e => setCustoKg(e.target.value)}
                className="w-full bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500" placeholder="Ex: 22.50" />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-stone-500 font-medium">Cortes</span>
              <button onClick={addCorte} className="text-xs text-emerald-700 hover:text-emerald-800 transition-colors">+ Adicionar</button>
            </div>
            <div className="space-y-2">
              {cortes.map((c, i) => (
                <div key={i} className="grid grid-cols-3 gap-2 items-center">
                  <input value={c.nome} onChange={e => updateCorte(i, 'nome', e.target.value)}
                    className="bg-stone-100 border border-stone-300 rounded px-2 py-1.5 text-stone-900 text-xs focus:outline-none focus:border-brand-500" placeholder="Nome" />
                  <input type="number" value={c.pesoKg || ''} onChange={e => updateCorte(i, 'pesoKg', e.target.value)}
                    className="bg-stone-100 border border-stone-300 rounded px-2 py-1.5 text-stone-900 text-xs focus:outline-none focus:border-brand-500" placeholder="Peso kg" />
                  <div className="flex gap-1">
                    <input type="number" value={c.precoVendaKg || ''} onChange={e => updateCorte(i, 'precoVendaKg', e.target.value)}
                      className="flex-1 bg-stone-100 border border-stone-300 rounded px-2 py-1.5 text-stone-900 text-xs focus:outline-none focus:border-brand-500" placeholder="R$/kg" />
                    <button onClick={() => rmCorte(i)} className="text-stone-500 hover:text-red-700 transition-colors px-1">×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={calcular} disabled={loading}
            className="w-full py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm uppercase tracking-wide rounded transition-all active:scale-95 disabled:opacity-50">
            {loading ? 'Calculando...' : 'Calcular Rendimento'}
          </button>
          {erro && <p className="text-red-700 text-xs text-center">{erro}</p>}
        </div>

        {/* RESULTADO */}
        <div className="bg-white rounded-xl border border-stone-200 p-6">
          {!resultado && (
            <div className="flex flex-col items-center justify-center h-full text-stone-600 gap-2">
              <span className="text-4xl">🦴</span>
              <p className="text-xs font-medium">Aguardando cálculo</p>
            </div>
          )}
          {resultado && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Custo Total', val: `R$ ${resultado.custoTotalInicial.toFixed(2)}`, color: 'text-red-700' },
                  { label: 'Venda Esperada', val: `R$ ${resultado.vendaEsperada.toFixed(2)}`, color: 'text-emerald-700' },
                  { label: 'Margem Geral', val: `${resultado.margemGeral}%`, color: 'text-amber-700' },
                  { label: 'Quebra de Peso', val: `${resultado.quebraPesoKg} kg`, color: 'text-stone-600' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="bg-stone-100 rounded-lg p-3">
                    <p className="text-xs text-stone-500 font-medium mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color}`}>{val}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs text-stone-500 font-medium mb-2">Cortes</p>
                <div className="space-y-2">
                  {resultado.cortes.map((c, i) => (
                    <div key={i} className="bg-stone-100 rounded-lg px-4 py-2 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-bold text-stone-900">{c.nome}</p>
                        <p className="text-xs text-stone-500">{c.peso} kg</p>
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-700 font-bold text-sm">R$ {c.vendaProjetada.toFixed(2)}</p>
                        <p className="text-xs text-stone-500">Margem: {c.margemPercentual}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
