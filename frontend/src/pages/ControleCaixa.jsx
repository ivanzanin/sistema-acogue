import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { imprimirFechamentoCaixa } from '../utils/imprimirCupom';

const fmt = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const FORMA_ICON = { DINHEIRO:'💵', PIX:'📱', DEBITO:'💳', CREDITO:'💳', MULTIPLO:'👥' };
const FORMA_COR  = { DINHEIRO:'text-emerald-700', PIX:'text-blue-700', DEBITO:'text-purple-700', CREDITO:'text-orange-700', MULTIPLO:'text-indigo-700' };

export default function ControleCaixa() {
  const navigate = useNavigate();
  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(null);
  const [valor, setValor]           = useState('');
  const [obs, setObs]               = useState('');
  const [salvando, setSalvando]     = useState(false);
  const [erro, setErro]             = useState(null);
  const [fechamento, setFechamento] = useState(null);
  const [reabrindo, setReabrindo]   = useState(false);
  const [cancelando, setCancelando] = useState(null); // id da venda sendo cancelada

  const cliente = (() => { try { return JSON.parse(localStorage.getItem('cliente')); } catch { return null; } })();

  const carregar = async () => {
    setLoading(true);
    try { const { data } = await api.get('/caixa/status'); setStatus(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregar(); }, []);

  const reabrirCaixa = async () => {
    if (!confirm('Reabrir o caixa? O registro de fechamento sera removido.')) return;
    setReabrindo(true);
    try {
      await api.post('/caixa/reabrir');
      carregar();
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao reabrir caixa.');
    } finally { setReabrindo(false); }
  };

  const cancelarVenda = async (venda, refazer = false) => {
    const itens = venda.itens?.map(i => {
      const qtd = i.unidade === 'UN' ? `${parseFloat(i.peso)} un` : `${parseFloat(i.peso).toFixed(3)} kg`;
      return `• ${i.nome} (${qtd})`;
    }).join('\n') || '';
    const msg = refazer
      ? `Cancelar esta venda de ${fmt(venda.total)} e refazer?\n\n${itens}\n\nO estoque sera devolvido e voce sera levado a frente de caixa para refazer.`
      : `Cancelar esta venda de ${fmt(venda.total)}?\n\n${itens}\n\nO estoque sera devolvido aos produtos.`;
    if (!confirm(msg)) return;
    setCancelando(venda.id);
    try {
      await api.patch(`/gestao/venda/${venda.id}/cancelar`);
      if (refazer) {
        // Salva os itens da venda no localStorage para o PDV recarregar
        try { localStorage.setItem('refazer_venda', JSON.stringify(venda)); } catch {}
        navigate('/frente-caixa');
      } else {
        await carregar();
      }
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao cancelar venda.');
    } finally { setCancelando(null); }
  };

  const confirmar = async () => {
    if (!valor && modal !== 'fechar') return setErro('Informe o valor.');
    setSalvando(true); setErro(null);
    try {
      if (modal === 'abrir') {
        await api.post('/caixa/abrir', { valorInicial: parseFloat(valor) });
      } else if (modal === 'fechar') {
        const { data } = await api.post('/caixa/fechar', { valorFinal: parseFloat(valor || 0) });
        setFechamento(data.resumo);
      } else {
        await api.post('/caixa/movimento', { tipo: modal.toUpperCase(), valor: parseFloat(valor), observacao: obs });
      }
      setModal(null); setValor(''); setObs('');
      carregar();
    } catch (e) {
      setErro(e.response?.data?.erro || 'Erro ao processar.');
    } finally { setSalvando(false); }
  };

  const inp = "w-full bg-stone-100 border border-stone-300 rounded px-3 py-2 text-stone-900 text-sm focus:outline-none focus:border-brand-500 font-mono";
  const titulosModal = { abrir:'Abrir Caixa', saida:'Registrar Saida', entrada:'Registrar Entrada', fechar:'Fechar Caixa' };
  const coresModal   = { abrir:'border-emerald-500', saida:'border-red-500', entrada:'border-blue-500', fechar:'border-brand-600' };

  return (
    <div className="min-h-screen bg-page p-6">

      {/* MODAL OPERACAO */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm">
          <div className={`bg-white border-2 ${coresModal[modal]} rounded-xl p-6 w-full max-w-sm shadow-2xl`}>
            <p className="text-sm font-bold text-stone-900 mb-5">{titulosModal[modal]}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-stone-500 font-medium mb-1">
                  {modal === 'fechar' ? 'Valor Contado no Caixa (R$)' : 'Valor (R$)'}
                </label>
                <input type="number" value={valor} onChange={e => setValor(e.target.value)}
                  className={inp} placeholder="0.00" autoFocus
                  onKeyDown={e => e.key === 'Enter' && confirmar()} />
              </div>
              {modal === 'fechar' && status && (
                <div className="bg-stone-100 rounded-lg p-3 text-xs space-y-1">
                  <p className="text-stone-600 font-bold mb-2">Resumo do dia</p>
                  <div className="flex justify-between"><span className="text-stone-600">Abertura</span><span className="text-stone-900">{fmt(status.abertura)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">Vendas Dinheiro</span><span className="text-emerald-700">{fmt(status.porForma?.DINHEIRO || 0)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">Entradas</span><span className="text-blue-700">{fmt(status.entradas)}</span></div>
                  <div className="flex justify-between"><span className="text-stone-600">Saidas</span><span className="text-red-700">- {fmt(status.saidas)}</span></div>
                  <div className="flex justify-between border-t border-stone-300 pt-1 mt-1 font-bold"><span className="text-stone-700">Esperado</span><span className="text-amber-700">{fmt((status.abertura + (status.porForma?.DINHEIRO || 0) + status.entradas - status.saidas))}</span></div>
                </div>
              )}
              {(modal === 'saida' || modal === 'entrada') && (
                <div>
                  <label className="block text-xs text-stone-500 font-medium mb-1">Observacao</label>
                  <input value={obs} onChange={e => setObs(e.target.value)} className={inp} placeholder="Motivo..." />
                </div>
              )}
              {erro && <p className="text-red-700 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{erro}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={confirmar} disabled={salvando}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs font-medium rounded">
                {salvando ? 'Processando...' : 'Confirmar'}
              </button>
              <button onClick={() => { setModal(null); setErro(null); setValor(''); setObs(''); }}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESULTADO FECHAMENTO */}
      {fechamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 backdrop-blur-sm">
          <div className="bg-white border-2 border-brand-600 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <p className="text-sm font-bold text-brand-700 font-semibold mb-5 text-center">Resumo de Fechamento</p>

            {/* Por forma de pagamento */}
            <div className="bg-stone-100 rounded-lg p-3 mb-4">
              <p className="text-xs text-stone-500 font-medium mb-2">Vendas por Forma de Pagamento</p>
              {Object.entries(fechamento.porForma || {}).map(([forma, val]) => val > 0 && (
                <div key={forma} className="flex justify-between text-sm py-1">
                  <span className={`flex items-center gap-1 ${FORMA_COR[forma]}`}>
                    <span>{FORMA_ICON[forma]}</span> {forma}
                  </span>
                  <span className={`font-bold ${FORMA_COR[forma]}`}>{fmt(val)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {[
                { label:'Abertura', valor: fmt(fechamento.abertura), cor:'text-stone-900' },
                { label:'Entradas', valor: fmt(fechamento.entradas), cor:'text-blue-700' },
                { label:'Saidas', valor: `- ${fmt(fechamento.saidas)}`, cor:'text-red-700' },
                { label:'Saldo Esperado (dinheiro)', valor: fmt(fechamento.saldoEsperado), cor:'text-stone-900 font-bold' },
                { label:'Valor Contado', valor: fmt(fechamento.valorInformado), cor:'text-stone-900 font-bold' },
              ].map(({ label, valor, cor }) => (
                <div key={label} className="flex justify-between text-sm border-b border-stone-200 pb-1">
                  <span className="text-stone-600">{label}</span>
                  <span className={`font-bold ${cor}`}>{valor}</span>
                </div>
              ))}
              <div className={`flex justify-between text-base font-bold pt-2 ${fechamento.status === 'CONFERIDO' ? 'text-emerald-700' : fechamento.diferenca > 0 ? 'text-blue-700' : 'text-red-700'}`}>
                <span>{fechamento.status === 'CONFERIDO' ? '✓ CONFERIDO' : fechamento.status === 'SOBRA' ? '↑ SOBRA' : '↓ FALTA'}</span>
                <span>{fmt(Math.abs(fechamento.diferenca))}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => imprimirFechamentoCaixa(fechamento, cliente?.nomeAcougue)}
                className="flex-1 py-2.5 bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold text-xs font-medium rounded">
                🖨️ Imprimir
              </button>
              <button onClick={() => setFechamento(null)}
                className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs font-medium rounded">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Controle de Caixa</h1>
          <p className="text-xs text-stone-500 mt-0.5">Abertura, saida, entrada e fechamento</p>
        </div>
        <button onClick={carregar} className="text-xs text-stone-600 hover:text-stone-900 border border-stone-300 px-4 py-2 rounded transition-all">Atualizar</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-stone-500"><span className="animate-pulse text-sm">Carregando...</span></div>
      ) : !status ? null : (
        <>
          {/* CARDS STATUS */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className={`bg-white border rounded-xl p-5 ${status.aberto && !status.fechado ? 'border-emerald-500/30' : 'border-stone-200'}`}>
              <p className="text-xs text-stone-500 font-medium mb-2">Status</p>
              <p className={`text-2xl font-bold ${status.fechado ? 'text-stone-500' : status.aberto ? 'text-emerald-700' : 'text-red-700'}`}>
                {status.fechado ? 'FECHADO' : status.aberto ? 'ABERTO' : 'NAO ABERTO'}
              </p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              <p className="text-xs text-stone-500 font-medium mb-2">Abertura</p>
              <p className="text-2xl font-bold text-stone-900">{fmt(status.abertura)}</p>
            </div>
            <div className="bg-white border border-emerald-500/20 rounded-xl p-5">
              <p className="text-xs text-stone-500 font-medium mb-2">Vendas ({status.qtdVendas})</p>
              <p className="text-2xl font-bold text-emerald-700">{fmt(status.totalVendas)}</p>
            </div>
            <div className="bg-white border border-brand-600/20 rounded-xl p-5">
              <p className="text-xs text-stone-500 font-medium mb-2">Saldo Atual</p>
              <p className="text-2xl font-bold text-amber-700">{fmt(status.saldoAtual)}</p>
            </div>
          </div>

          {/* BREAKDOWN POR FORMA */}
          {status.porForma && Object.values(status.porForma).some(v => v > 0) && (
            <div className="grid grid-cols-4 gap-3 mb-4">
              {Object.entries(status.porForma).map(([forma, val]) => (
                <div key={forma} className="bg-white border border-stone-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{FORMA_ICON[forma]}</span>
                    <span className="text-xs text-stone-500 font-medium">{forma}</span>
                  </div>
                  <p className={`text-xl font-bold ${val > 0 ? FORMA_COR[forma] : 'text-stone-600'}`}>{fmt(val)}</p>
                </div>
              ))}
            </div>
          )}

          {/* BOTOES */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {status.fechado ? (
              <button onClick={reabrirCaixa} disabled={reabrindo}
                className="py-4 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs font-medium rounded-xl transition-all active:scale-95 ">
                {reabrindo ? 'Reabrindo...' : '🔓 Reabrir Caixa'}
              </button>
            ) : (
              <button onClick={() => setModal('abrir')} disabled={status.aberto}
                className="py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-stone-900 font-bold text-xs font-medium rounded-xl transition-all">
                Abrir Caixa
              </button>
            )}
            <button onClick={() => setModal('entrada')} disabled={!status.aberto || status.fechado}
              className="py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-stone-900 font-bold text-xs font-medium rounded-xl transition-all">
              Entrada
            </button>
            <button onClick={() => setModal('saida')} disabled={!status.aberto || status.fechado}
              className="py-4 bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-stone-900 font-bold text-xs font-medium rounded-xl transition-all">
              Saida
            </button>
            <button onClick={() => setModal('fechar')} disabled={!status.aberto || status.fechado}
              className="py-4 bg-amber-600 hover:bg-brand-600 disabled:opacity-30 disabled:cursor-not-allowed text-stone-900 font-bold text-xs font-medium rounded-xl transition-all">
              Fechar Caixa
            </button>
          </div>

          {/* MOVIMENTOS */}
          {(status.operacoes?.length > 0 || status.vendas?.length > 0) && (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <p className="text-xs text-stone-500 font-medium font-bold">Movimentos do Dia</p>
                <p className="text-xs text-stone-500">{(status.operacoes?.length || 0) + (status.vendas?.length || 0)} registro(s)</p>
              </div>
              <table className="w-full">
                <tbody>
                  {/* Operacoes de caixa */}
                  {status.operacoes?.map((op) => {
                    const cores = { ABERTURA:'text-emerald-700', SAIDA:'text-red-700', ENTRADA:'text-blue-700', FECHAMENTO:'text-amber-700' };
                    return (
                      <tr key={`op-${op.id}`} className="border-b border-stone-200/50 hover:bg-stone-100/20">
                        <td className="py-3 px-5 text-xs text-stone-500 w-16">{new Date(op.data).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="py-3 px-5 w-32"><span className={`text-xs font-bold ${cores[op.tipo]}`}>{op.tipo}</span></td>
                        <td className="py-3 px-5 text-xs text-stone-600">
                          {op.tipo === 'FECHAMENTO' ? 'Fechamento do caixa' :
                           op.tipo === 'ABERTURA'   ? 'Abertura do caixa'   :
                           op.observacao}
                        </td>
                        <td className={`py-3 px-5 text-sm font-bold text-right ${cores[op.tipo]}`}>{fmt(op.valor)}</td>
                      </tr>
                    );
                  })}
                  {/* Vendas do dia */}
                  {status.vendas?.map((v) => {
                    const podecancelar = !v.cancelado && new Date(v.horario).toDateString() === new Date().toDateString();
                    const ocupado = cancelando === v.id;
                    const ehMultiplo = v.formaPagamento === 'MULTIPLO' || (v.pagamentos && v.pagamentos.length > 1);
                    const detalhesPags = v.pagamentos ? v.pagamentos.map(p => `${p.nome || 'Pessoa'}: R$ ${Number(p.valor || 0).toFixed(2)} (${p.forma})`).join(' | ') : v.formaPagamento;
                    return (
                      <tr key={`v-${v.id}`} className={`group border-b border-stone-200/50 hover:bg-stone-100/20 ${v.cancelado ? 'opacity-40' : ''}`}>
                        <td className="py-3 px-5 text-xs text-stone-500 w-16">{new Date(v.horario).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</td>
                        <td className="py-3 px-5 w-36">
                          <span className="text-xs font-bold text-stone-700 flex items-center gap-1" title={detalhesPags}>
                            {FORMA_ICON[v.formaPagamento] || '👥'} {ehMultiplo ? 'DIVIDIDA' : 'VENDA'}
                          </span>
                          {v.pagamentos && v.pagamentos.length > 1 && (
                            <p className="text-[10px] text-stone-600 truncate max-w-[130px] font-mono" title={detalhesPags}>
                              {v.pagamentos.map(p => p.forma).join('+')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-5 text-xs text-stone-500 truncate max-w-xs">
                          {v.cancelado ? <span className="text-red-700">CANCELADA</span> : v.itens?.map(i => {
                            const isUN = i.unidade === 'UN';
                            const qtd = isUN ? `${parseFloat(i.peso)} un` : `${parseFloat(i.peso).toFixed(3)} kg`;
                            return `${i.nome} (${qtd})`;
                          }).join(', ')}
                        </td>
                        <td className={`py-3 px-5 text-sm font-bold text-right ${v.cancelado ? 'line-through text-stone-500' : 'text-emerald-700'}`}>{fmt(v.total)}</td>
                        <td className="py-3 px-3 w-24 text-right">
                          {podecancelar && (
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => cancelarVenda(v, true)}
                                disabled={ocupado}
                                title="Cancelar e refazer no PDV"
                                className="px-2 py-1 text-[10px] font-bold rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200 transition-colors">
                                ↻ Refazer
                              </button>
                              <button
                                onClick={() => cancelarVenda(v, false)}
                                disabled={ocupado}
                                title="Cancelar venda (devolve estoque)"
                                className="px-2 py-1 text-[10px] font-bold rounded bg-red-100 hover:bg-red-200 text-red-800 border border-red-200 transition-colors">
                                {ocupado ? '...' : '× Cancelar'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
