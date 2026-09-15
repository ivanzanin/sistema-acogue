import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

const fmtKg  = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' kg';
const fmtKg2 = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtR$  = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : null;

// ── Tutorial ──────────────────────────────────────────────────
function Tutorial({ onFechar }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.35)' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'560px', boxShadow:'0 25px 60px rgba(0,0,0,0.2)', overflow:'hidden' }}>
        <div style={{ padding:'20px 28px', background:'#1C0D07', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontWeight:800, fontSize:'17px', color:'white' }}>Como funciona a Desossa?</p>
            <p style={{ fontSize:'12px', color:'#A0856A' }}>Guia rápido em 3 passos</p>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'white', fontSize:'24px', cursor:'pointer', opacity:0.6 }}>×</button>
        </div>
        <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
          {[
            { n:1, t:'Escolha ou crie uma desossa', d:'Cada tipo de peça (Dianteiro, Traseiro, etc.) é um template. Na próxima vez que fizer, os cortes e valores já vêm preenchidos.' },
            { n:2, t:'Ajuste os valores', d:'Edite peso e preço de cada corte conforme o dia. O sistema mostra a margem em tempo real. Use o leitor de código de barras para preencher automaticamente.' },
            { n:3, t:'Calcular + Registrar', d:'Salva os valores como template, atualiza o estoque e cria/atualiza os produtos para venda na Frente de Caixa.' },
          ].map(({ n, t, d }) => (
            <div key={n} style={{ display:'flex', gap:'16px' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'#D97706', color:'white', fontWeight:800, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{n}</div>
              <div>
                <p style={{ fontWeight:700, color:'#1E293B' }}>{t}</p>
                <p style={{ fontSize:'13px', color:'#64748B', marginTop:'4px' }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:'0 28px 24px' }}>
          <button onClick={onFechar} style={{ width:'100%', padding:'12px', background:'#D97706', color:'white', border:'none', borderRadius:'10px', fontWeight:700, fontSize:'15px', cursor:'pointer' }}>Entendi!</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: nova desossa ───────────────────────────────────────
function ModalNova({ onCriar, onFechar, criando }) {
  const [nome, setNome] = useState('');
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.4)' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'400px', padding:'28px', boxShadow:'0 25px 60px rgba(0,0,0,0.2)' }}>
        <p style={{ fontWeight:800, fontSize:'18px', color:'#1E293B', marginBottom:'6px' }}>Nova Desossa</p>
        <p style={{ fontSize:'13px', color:'#64748B', marginBottom:'20px' }}>Dê um nome para identificar esse tipo de peça.</p>
        <input
          autoFocus
          value={nome}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && nome.trim() && onCriar(nome)}
          placeholder="Ex: Dianteiro Bovino, Traseiro, Porco..."
          style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #E2E8F0', borderRadius:'10px', fontSize:'15px', outline:'none', boxSizing:'border-box', marginBottom:'16px' }}
        />
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onFechar} style={{ flex:1, padding:'11px', background:'#F1F5F9', border:'none', borderRadius:'10px', fontWeight:600, cursor:'pointer', color:'#475569' }}>Cancelar</button>
          <button onClick={() => nome.trim() && onCriar(nome)} disabled={!nome.trim() || criando}
            style={{ flex:2, padding:'11px', background:'#D97706', border:'none', borderRadius:'10px', fontWeight:700, cursor:'pointer', color:'white', opacity: !nome.trim() ? 0.5 : 1 }}>
            {criando ? 'Criando...' : '+ Criar Desossa'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Relatório de Quebra e Lucratividade ────────────────
function ModalRelatorioLucratividade({ templateNome, pesoEntrada, custoKg, cortes, onFechar }) {
  const pesoTotal = parseFloat(pesoEntrada) || 0;
  const custo = parseFloat(custoKg) || 0;
  const custoTotalPeca = pesoTotal * custo;

  const pesoDesossado = cortes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);
  const quebraKg = Math.max(0, pesoTotal - pesoDesossado);
  const pctRendimento = pesoTotal > 0 ? (pesoDesossado / pesoTotal * 100) : 0;
  const pctQuebra = pesoTotal > 0 ? (quebraKg / pesoTotal * 100) : 0;

  const custoPerdidoQuebra = quebraKg * custo;
  const custoRealKgLimpo = pesoDesossado > 0 ? (custoTotalPeca / pesoDesossado) : 0;

  const vendaTotal = cortes.reduce((s, c) => s + (parseFloat(c.peso) || 0) * (parseFloat(c.precoVenda) || 0), 0);
  const lucroBruto = vendaTotal - custoTotalPeca;
  const margemLucro = vendaTotal > 0 ? (lucroBruto / vendaTotal * 100) : 0;
  const markup = custoTotalPeca > 0 ? (lucroBruto / custoTotalPeca * 100) : 0;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)', padding:'16px' }}>
      <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'840px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 25px 60px rgba(0,0,0,0.25)', overflow:'hidden' }}>
        {/* Header */}
        <div style={{ padding:'18px 24px', background:'#1C0D07', display:'flex', justifyContent:'space-between', alignItems:'center', color:'white' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'24px' }}>📊</span>
            <div>
              <p style={{ fontWeight:800, fontSize:'16px' }}>Relatório de Quebra e Lucratividade — {templateNome}</p>
              <p style={{ fontSize:'12px', color:'#A0856A' }}>Análise financeira detalhada de rendimento da carcaça</p>
            </div>
          </div>
          <button onClick={onFechar} style={{ background:'none', border:'none', color:'white', fontSize:'24px', cursor:'pointer', opacity:0.7 }}>×</button>
        </div>

        {/* Content */}
        <div style={{ padding:'24px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'20px' }}>
          {/* Métricas Principais */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'12px' }}>
            <div style={{ background:'#F8FAFC', padding:'14px', borderRadius:'12px', border:'1px solid #E2E8F0' }}>
              <p style={{ fontSize:'11px', fontWeight:600, color:'#64748B' }}>Investimento Total</p>
              <p style={{ fontSize:'18px', fontWeight:800, color:'#1E293B', marginTop:'4px' }}>{fmtR$(custoTotalPeca)}</p>
              <p style={{ fontSize:'11px', color:'#94A3B8', marginTop:'2px' }}>{fmtKg2(pesoTotal)} kg a {fmtR$(custo)}/kg</p>
            </div>

            <div style={{ background:'#FEF2F2', padding:'14px', borderRadius:'12px', border:'1px solid #FEE2E2' }}>
              <p style={{ fontSize:'11px', fontWeight:600, color:'#991B1B' }}>Perda na Quebra (Ossos/Gordura)</p>
              <p style={{ fontSize:'18px', fontWeight:800, color:'#DC2626', marginTop:'4px' }}>{fmtKg2(quebraKg)} kg</p>
              <p style={{ fontSize:'11px', color:'#B91C1C', marginTop:'2px' }}>{pctQuebra.toFixed(1)}% ({fmtR$(custoPerdidoQuebra)} perdidos)</p>
            </div>

            <div style={{ background:'#EFF6FF', padding:'14px', borderRadius:'12px', border:'1px solid #DBEAFE' }}>
              <p style={{ fontSize:'11px', fontWeight:600, color:'#1E40AF' }}>Custo Real do Kg Limpo</p>
              <p style={{ fontSize:'18px', fontWeight:800, color:'#2563EB', marginTop:'4px' }}>{fmtR$(custoRealKgLimpo)}/kg</p>
              <p style={{ fontSize:'11px', color:'#3B82F6', marginTop:'2px' }}>Custo após descontar a quebra</p>
            </div>

            <div style={{ background: margemLucro >= 35 ? '#F0FDF4' : '#FFFBEB', padding:'14px', borderRadius:'12px', border: `1px solid ${margemLucro >= 35 ? '#DCFCE7' : '#FEF3C7'}` }}>
              <p style={{ fontSize:'11px', fontWeight:600, color: margemLucro >= 35 ? '#166534' : '#92400E' }}>Lucro Projetado</p>
              <p style={{ fontSize:'18px', fontWeight:800, color: margemLucro >= 35 ? '#16A34A' : '#D97706', marginTop:'4px' }}>{fmtR$(lucroBruto)}</p>
              <p style={{ fontSize:'11px', fontWeight:700, color: margemLucro >= 35 ? '#15803D' : '#B45309', marginTop:'2px' }}>Margem: {margemLucro.toFixed(1)}% (Markup {markup.toFixed(1)}%)</p>
            </div>
          </div>

          {/* Barra de Aproveitamento */}
          <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:'12px', padding:'16px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', fontWeight:700, marginBottom:'8px' }}>
              <span style={{ color:'#16A34A' }}>🥩 Carne Aproveitada: {fmtKg2(pesoDesossado)} kg ({pctRendimento.toFixed(1)}%)</span>
              <span style={{ color:'#DC2626' }}>🦴 Quebra e Descarte: {fmtKg2(quebraKg)} kg ({pctQuebra.toFixed(1)}%)</span>
            </div>
            <div style={{ height:'10px', background:'#FEE2E2', borderRadius:'99px', overflow:'hidden', display:'flex' }}>
              <div style={{ width:`${Math.min(100, pctRendimento)}%`, background:'#16A34A', height:'100%' }} />
              <div style={{ width:`${Math.min(100, pctQuebra)}%`, background:'#DC2626', height:'100%' }} />
            </div>
          </div>

          {/* Tabela dos Cortes */}
          <div>
            <p style={{ fontSize:'13px', fontWeight:700, color:'#1E293B', marginBottom:'10px' }}>Detalhamento e Lucro por Corte</p>
            <div style={{ border:'1px solid #E2E8F0', borderRadius:'10px', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ background:'#F8FAFC', borderBottom:'1px solid #E2E8F0', textAlign:'left', color:'#64748B' }}>
                    <th style={{ padding:'10px 14px' }}>Corte</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>Peso (kg)</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>% Carcaça</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>Preço Venda</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>Faturamento</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>% Receita</th>
                    <th style={{ padding:'10px 14px', textAlign:'right' }}>Margem Indiv.</th>
                  </tr>
                </thead>
                <tbody>
                  {cortes.map((c, i) => {
                    const pKg = parseFloat(c.peso) || 0;
                    const prVenda = parseFloat(c.precoVenda) || 0;
                    const receita = pKg * prVenda;
                    const pctPeca = pesoTotal > 0 ? (pKg / pesoTotal * 100) : 0;
                    const pctReceita = vendaTotal > 0 ? (receita / vendaTotal * 100) : 0;
                    const custoCorte = pKg * custo;
                    const margemCorte = receita > 0 ? ((receita - custoCorte) / receita * 100) : 0;

                    return (
                      <tr key={i} style={{ borderBottom:'1px solid #F1F5F9' }}>
                        <td style={{ padding:'9px 14px', fontWeight:700, color:'#1E293B' }}>{c.nome}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontFamily:'monospace' }}>{fmtKg2(pKg)}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#64748B' }}>{pctPeca.toFixed(1)}%</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontFamily:'monospace' }}>{fmtR$(prVenda)}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontFamily:'monospace', fontWeight:700, color:'#16A34A' }}>{fmtR$(receita)}</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', color:'#64748B' }}>{pctReceita.toFixed(1)}%</td>
                        <td style={{ padding:'9px 14px', textAlign:'right', fontWeight:700, color: margemCorte >= 30 ? '#16A34A' : '#D97706' }}>
                          {margemCorte.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px', background:'#F8FAFC', borderTop:'1px solid #E2E8F0', display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onFechar} style={{ padding:'9px 20px', background:'#D97706', color:'white', border:'none', borderRadius:'8px', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
            Fechar Relatório
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lista de templates ────────────────────────────────────────
function ListaDesossas({ templates, carregando, onAbrir, onNova, onDeletar }) {
  return (
    <div style={{ padding:'24px', background:'#F8FAFC', minHeight:'100vh' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div>
          <h1 style={{ fontSize:'22px', fontWeight:800, color:'#1E293B', letterSpacing:'-0.5px' }}>Painel de Desossa</h1>
          <p style={{ fontSize:'13px', color:'#64748B', marginTop:'2px' }}>Selecione um tipo ou crie uma nova desossa</p>
        </div>
        <button onClick={onNova}
          style={{ padding:'10px 20px', background:'#D97706', color:'white', border:'none', borderRadius:'10px', fontWeight:700, fontSize:'14px', cursor:'pointer' }}>
          + Nova Desossa
        </button>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94A3B8' }}>Carregando...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px 0', color:'#94A3B8' }}>
          <div style={{ fontSize:'56px', marginBottom:'12px' }}>🦴</div>
          <p style={{ fontWeight:700, fontSize:'16px', color:'#475569', marginBottom:'6px' }}>Nenhuma desossa cadastrada</p>
          <p style={{ fontSize:'13px', marginBottom:'20px' }}>Crie sua primeira desossa para começar</p>
          <button onClick={onNova}
            style={{ padding:'10px 24px', background:'#D97706', color:'white', border:'none', borderRadius:'10px', fontWeight:700, cursor:'pointer' }}>
            + Criar primeira desossa
          </button>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'16px' }}>
          {templates.map(t => (
            <div key={t.id} onClick={() => onAbrir(t)}
              style={{ background:'white', borderRadius:'14px', padding:'20px', boxShadow:'0 1px 4px rgba(0,0,0,0.08)', border:'1px solid #E2E8F0', cursor:'pointer', transition:'box-shadow 0.15s', position:'relative' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.12)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,0.08)'}>
              <button onClick={e => { e.stopPropagation(); onDeletar(t); }}
                style={{ position:'absolute', top:'12px', right:'12px', background:'none', border:'none', color:'#CBD5E1', fontSize:'18px', cursor:'pointer', lineHeight:1 }}
                title="Excluir">×</button>
              <p style={{ fontWeight:800, fontSize:'16px', color:'#1E293B', marginBottom:'6px' }}>🥩 {t.nome}</p>
              <p style={{ fontSize:'12px', color:'#64748B', marginBottom:'12px' }}>
                {t.cortes.length} corte{t.cortes.length !== 1 ? 's' : ''}
                {t.vezes > 0 && ` · feita ${t.vezes}× `}
                {t.ultimaVez && ` · última vez ${fmtData(t.ultimaVez)}`}
              </p>
              {t.cortes.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'4px', marginBottom:'14px' }}>
                  {t.cortes.slice(0, 5).map(c => (
                    <span key={c.id} style={{ fontSize:'11px', padding:'2px 8px', background:'#F1F5F9', borderRadius:'99px', color:'#475569', fontWeight:600 }}>{c.nomeCorte}</span>
                  ))}
                  {t.cortes.length > 5 && <span style={{ fontSize:'11px', padding:'2px 8px', background:'#F1F5F9', borderRadius:'99px', color:'#94A3B8' }}>+{t.cortes.length - 5}</span>}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'12px', borderTop:'1px solid #F1F5F9', fontSize:'12px', color:'#64748B' }}>
                {t.pesoEntrada > 0 && <span>Peso típico: <strong>{fmtKg2(t.pesoEntrada)} kg</strong></span>}
                {t.custoKg > 0 && <span>Custo: <strong>{fmtR$(t.custoKg)}/kg</strong></span>}
              </div>
              <div style={{ marginTop:'12px', padding:'8px 14px', background:'#FFFBEB', borderRadius:'8px', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#D97706', border:'1px solid #FDE68A' }}>
                Abrir →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor de desossa ─────────────────────────────────────────
function EditorDesossa({ template, onVoltar, onRegistrado }) {
  const [pesoEntrada, setPesoEntrada] = useState(String(template.pesoEntrada || ''));
  const [custoKg, setCustoKg]         = useState(String(template.custoKg || ''));
  const [cortes, setCortes]           = useState(
    template.cortes.map(c => ({ nome: c.nomeCorte, peso: String(c.pesoKg), precoVenda: String(c.precoVendaKg), validade: c.validade ? c.validade.slice(0,10) : '' }))
  );
  const [novoCorte, setNovoCorte]     = useState({ nome: '', peso: '', precoVenda: '', validade: '' });
  const [resumo, setResumo]           = useState(null);
  const [salvando, setSalvando]       = useState(false);
  const [registrado, setRegistrado]   = useState(false);
  const [erro, setErro]               = useState(null);
  const [sucesso, setSucesso]         = useState(null);
  const [tutorial, setTutorial]       = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [flashScan, setFlashScan]     = useState(null);
  const barcodeBuffer = useRef('');
  const barcodeTimer  = useRef(null);

  const pesoTotal     = parseFloat(pesoEntrada) || 0;
  const pesoDesossado = cortes.reduce((s, c) => s + (parseFloat(c.peso) || 0), 0);
  const quebraPeso    = pesoTotal - pesoDesossado;
  const pct           = pesoTotal > 0 ? (pesoDesossado / pesoTotal * 100) : 0;
  const custo         = parseFloat(custoKg) || 0;

  const processarCodigoDesossa = useCallback(async (codigo) => {
    try {
      const { data } = await api.get(`/produtos/barcode/${codigo}`);
      if (data.balancaInfo?.pesoCalculado) {
        setNovoCorte(prev => ({ ...prev, nome: data.nome, precoVenda: String(data.precoVenda), peso: String(data.balancaInfo.pesoCalculado) }));
        setFlashScan({ msg: `✓ ${data.nome} — ${data.balancaInfo.pesoCalculado.toFixed(3)} kg`, tipo: 'ok' });
      } else {
        setNovoCorte(prev => ({ ...prev, nome: data.nome, precoVenda: String(data.precoVenda) }));
        setFlashScan({ msg: `✓ ${data.nome} — digite o peso`, tipo: 'info' });
      }
    } catch {
      if (/^2\d{12}$/.test(codigo)) {
        setFlashScan({ msg: 'Produto não cadastrado. Preencha o nome manualmente.', tipo: 'aviso' });
      } else {
        setFlashScan({ msg: 'Código não reconhecido.', tipo: 'erro' });
      }
    }
    setTimeout(() => setFlashScan(null), 3000);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      const tag = document.activeElement?.tagName;
      const isNomeCorte = document.activeElement?.placeholder?.includes('Picanha');
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && !isNomeCorte) return;
      if (e.key === 'Enter') {
        const cod = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        clearTimeout(barcodeTimer.current);
        if (cod.length >= 3) processarCodigoDesossa(cod);
        return;
      }
      if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 80);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => { window.removeEventListener('keydown', handleKey); clearTimeout(barcodeTimer.current); };
  }, [processarCodigoDesossa]);

  const adicionarCorte = () => {
    if (!novoCorte.nome.trim() || !novoCorte.peso || !novoCorte.precoVenda) { setErro('Preencha nome, peso e preço do corte.'); return; }
    if (cortes.some(c => c.nome.toLowerCase() === novoCorte.nome.trim().toLowerCase())) { setErro(`"${novoCorte.nome}" já está na lista.`); return; }
    setCortes(p => [...p, { ...novoCorte, nome: novoCorte.nome.trim() }]);
    setNovoCorte({ nome: '', peso: '', precoVenda: '', validade: '' });
    setErro(null);
  };

  const calcularERegistrar = async () => {
    setErro(null); setSucesso(null);
    const pesoNum  = parseFloat(pesoEntrada);
    const custoNum = parseFloat(custoKg);
    if (!pesoNum  || pesoNum  <= 0) { setErro('Informe o peso total da peça.'); return; }
    if (!custoNum || custoNum <= 0) { setErro('Informe o custo por kg.'); return; }
    if (cortes.length === 0)        { setErro('Adicione pelo menos um corte.'); return; }
    setSalvando(true);
    try {
      const payload = {
        pesoEntrada: pesoNum,
        custoKg:     custoNum,
        cortes:      cortes.map(c => ({ nome: c.nome, pesoKg: parseFloat(c.peso), precoVendaKg: parseFloat(c.precoVenda), validade: c.validade || null })),
      };
      const { data } = await api.post(`/desossa/${template.id}/registrar`, payload);
      setResumo({ custoTotal: data.resultado.custoTotalInicial, vendaTotal: data.resultado.vendaEsperada, margem: data.resultado.margemGeral });
      setSucesso(`Desossa "${template.nome}" registrada! Estoque e produtos atualizados.`);
      setRegistrado(true);
      onRegistrado();
    } catch (e) {
      setErro('Erro: ' + (e.response?.data?.erro || e.message));
    } finally { setSalvando(false); }
  };

  const inp = { width:'100%', padding:'9px 12px', border:'1.5px solid #E2E8F0', borderRadius:'8px', fontSize:'14px', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ padding:'24px', background:'#F8FAFC', minHeight:'100vh' }}>
      {tutorial && <Tutorial onFechar={() => setTutorial(false)} />}
      {relatorioAberto && (
        <ModalRelatorioLucratividade
          templateNome={template.nome}
          pesoEntrada={pesoEntrada}
          custoKg={custoKg}
          cortes={cortes}
          onFechar={() => setRelatorioAberto(false)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <button onClick={onVoltar} style={{ background:'none', border:'1.5px solid #E2E8F0', borderRadius:'8px', padding:'7px 14px', cursor:'pointer', fontWeight:600, color:'#475569', fontSize:'13px' }}>
            ← Voltar
          </button>
          <div>
            <h1 style={{ fontSize:'20px', fontWeight:800, color:'#1E293B', letterSpacing:'-0.5px' }}>🥩 {template.nome}</h1>
            <p style={{ fontSize:'12px', color:'#64748B' }}>
              {template.vezes > 0 ? `Feita ${template.vezes}× · última vez ${fmtData(template.ultimaVez)}` : 'Nova desossa'}
            </p>
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={() => setRelatorioAberto(true)} style={{ padding:'9px 16px', background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:'10px', fontWeight:700, fontSize:'13px', cursor:'pointer', color:'#1D4ED8', display:'flex', alignItems:'center', gap:'6px' }}>
            <span>📊</span> Relatório de Quebra & Lucro
          </button>
          <button onClick={() => setTutorial(true)} style={{ padding:'9px 16px', background:'white', border:'1.5px solid #E2E8F0', borderRadius:'10px', fontWeight:600, fontSize:'13px', cursor:'pointer', color:'#475569' }}>
            📖 Como funciona?
          </button>
          <button onClick={calcularERegistrar} disabled={cortes.length === 0 || salvando || registrado}
            style={{ padding:'9px 20px', background: registrado ? '#22C55E' : cortes.length === 0 ? '#94A3B8' : '#D97706', color:'white', border:'none', borderRadius:'10px', fontWeight:700, fontSize:'14px', cursor: registrado || cortes.length === 0 ? 'default' : 'pointer' }}>
            {salvando ? 'Calculando...' : registrado ? '✓ Registrado' : '⚡ Calcular + Registrar'}
          </button>
        </div>
      </div>

      {erro    && <div style={{ marginBottom:'12px', padding:'10px 16px', borderRadius:'10px', background:'#FEE2E2', color:'#991B1B', border:'1px solid #FECACA', fontWeight:600, fontSize:'13px' }}>❌ {erro}</div>}
      {sucesso && <div style={{ marginBottom:'12px', padding:'10px 16px', borderRadius:'10px', background:'#DCFCE7', color:'#166534', border:'1px solid #BBF7D0', fontWeight:600, fontSize:'13px' }}>✓ {sucesso}</div>}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:'20px' }}>
        {/* COLUNA ESQUERDA */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Peça de entrada */}
          <div style={{ background:'white', borderRadius:'14px', padding:'20px', border:'1px solid #E2E8F0' }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'14px' }}>1. Peça de Entrada</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Peso total (kg)</label>
                <input style={inp} type="number" step="0.001" value={pesoEntrada}
                  onChange={e => setPesoEntrada(e.target.value)} placeholder="0.000" disabled={registrado} />
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Custo por kg (R$)</label>
                <input style={inp} type="number" step="0.01" value={custoKg}
                  onChange={e => setCustoKg(e.target.value)} placeholder="0.00" disabled={registrado} />
              </div>
            </div>
          </div>

          {/* Balanço */}
          {pesoTotal > 0 && (
            <div style={{ background:'white', borderRadius:'14px', padding:'20px', border:'1px solid #E2E8F0' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'12px' }}>Balanço de Peso</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'8px', fontSize:'13px' }}>
                {[
                  { label:'Entrada', val:pesoTotal, color:'#1E293B' },
                  { label:'Desossado', val:pesoDesossado, color:'#22C55E' },
                  { label:'Quebra/Osso', val:quebraPeso, color:'#F59E0B' },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ color:'#64748B' }}>{label}</span>
                    <span style={{ fontWeight:700, fontFamily:'monospace', color }}>{fmtKg(val)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:'10px', height:'6px', background:'#E2E8F0', borderRadius:'99px', overflow:'hidden' }}>
                <div style={{ width:`${Math.min(100, pct)}%`, height:'100%', background:'#22C55E', transition:'width 0.3s' }} />
              </div>
              <p style={{ fontSize:'11px', textAlign:'right', color:'#64748B', marginTop:'4px' }}>{pct.toFixed(1)}% aproveitado</p>
            </div>
          )}

          {/* Adicionar corte */}
          <div style={{ background:'white', borderRadius:'14px', padding:'20px', border:'1px solid #E2E8F0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em' }}>2. Adicionar Corte</p>
              <span style={{ fontSize:'11px', color:'#94A3B8' }}>📷 Leia o código da balança</span>
            </div>

            {flashScan && (
              <div style={{ marginBottom:'10px', padding:'8px 12px', borderRadius:'8px', fontSize:'12px', fontWeight:600,
                background: flashScan.tipo==='ok' ? '#DCFCE7' : flashScan.tipo==='info' ? '#DBEAFE' : flashScan.tipo==='aviso' ? '#FEF3C7' : '#FEE2E2',
                color: flashScan.tipo==='ok' ? '#166534' : flashScan.tipo==='info' ? '#1E40AF' : flashScan.tipo==='aviso' ? '#92400E' : '#991B1B',
              }}>{flashScan.msg}</div>
            )}

            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Nome do corte</label>
                <input style={inp} value={novoCorte.nome}
                  onChange={e => setNovoCorte({ ...novoCorte, nome: e.target.value })}
                  placeholder="Ex: Picanha" disabled={registrado}
                  onKeyDown={e => e.key === 'Enter' && adicionarCorte()} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Peso (kg)</label>
                  <input style={inp} type="number" step="0.001" value={novoCorte.peso}
                    onChange={e => setNovoCorte({ ...novoCorte, peso: e.target.value })}
                    placeholder="0.000" disabled={registrado} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Preço/kg (R$)</label>
                  <input style={inp} type="number" step="0.01" value={novoCorte.precoVenda}
                    onChange={e => setNovoCorte({ ...novoCorte, precoVenda: e.target.value })}
                    placeholder="0.00" disabled={registrado} />
                </div>
              </div>
              <div>
                <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'#475569', marginBottom:'5px' }}>Validade <span style={{ fontWeight:400, color:'#94A3B8' }}>(opcional)</span></label>
                <input style={inp} type="date" value={novoCorte.validade}
                  onChange={e => setNovoCorte({ ...novoCorte, validade: e.target.value })}
                  disabled={registrado} />
              </div>
              <button onClick={adicionarCorte} disabled={registrado}
                style={{ padding:'10px', background:'#D97706', color:'white', border:'none', borderRadius:'10px', fontWeight:700, cursor:'pointer', opacity: registrado ? 0.5 : 1 }}>
                + Adicionar Corte
              </button>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA — tabela */}
        <div style={{ background:'white', borderRadius:'14px', border:'1px solid #E2E8F0', overflow:'hidden', alignSelf:'start' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.06em' }}>3. Tabela de Rendimento</p>
            <span style={{ fontSize:'11px', padding:'2px 10px', background:'#F1F5F9', borderRadius:'99px', color:'#64748B', fontWeight:600 }}>{cortes.length} corte(s)</span>
          </div>

          {cortes.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#94A3B8' }}>
              <div style={{ fontSize:'48px', marginBottom:'10px' }}>🦴</div>
              <p style={{ fontSize:'13px', fontWeight:500 }}>Adicione os cortes ao lado</p>
              <button onClick={() => setTutorial(true)} style={{ background:'none', border:'none', color:'#D97706', cursor:'pointer', fontSize:'12px', marginTop:'6px' }}>Ver tutorial</button>
            </div>
          ) : (
            <>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#F8FAFC' }}>
                      {['Corte', 'Peso', 'Preço/kg', 'Custo', 'Venda Proj.', 'Margem', ''].map((h, i) => (
                        <th key={i} style={{ padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'#64748B', textAlign: i === 0 ? 'left' : 'right', borderBottom:'1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cortes.map((c, i) => {
                      const peso  = parseFloat(c.peso) || 0;
                      const preco = parseFloat(c.precoVenda) || 0;
                      const custoCorte = peso * custo;
                      const venda = peso * preco;
                      const margem = venda > 0 ? (((venda - custoCorte) / venda) * 100) : 0;
                      const badgeColor = margem >= 40 ? { bg:'#DCFCE7', color:'#166534' } : margem >= 20 ? { bg:'#FEF3C7', color:'#92400E' } : { bg:'#FEE2E2', color:'#991B1B' };
                      return (
                        <tr key={i} style={{ borderBottom:'1px solid #F1F5F9' }}>
                          <td style={{ padding:'10px 14px', fontWeight:600, fontSize:'13px', color:'#1E293B' }}>{c.nome}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontSize:'12px', color:'#475569' }}>{fmtKg2(peso)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontSize:'12px', color:'#475569' }}>{fmtR$(preco)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontSize:'12px', color:'#DC2626' }}>{fmtR$(custoCorte)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontSize:'12px', fontWeight:700, color:'#16A34A' }}>{fmtR$(venda)}</td>
                          <td style={{ padding:'10px 14px', textAlign:'right' }}>
                            <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'99px', fontWeight:700, background:badgeColor.bg, color:badgeColor.color }}>{margem.toFixed(1)}%</span>
                          </td>
                          <td style={{ padding:'10px 14px', textAlign:'right' }}>
                            {!registrado && (
                              <button onClick={() => setCortes(p => p.filter((_, j) => j !== i))}
                                style={{ background:'none', border:'none', color:'#CBD5E1', fontSize:'18px', cursor:'pointer', lineHeight:1 }}>×</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop:'2px solid #E2E8F0', background:'#F8FAFC' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, fontSize:'12px', color:'#64748B' }}>Total</td>
                      <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:'12px' }}>{fmtKg2(pesoDesossado)}</td>
                      <td colSpan={2} />
                      <td style={{ padding:'10px 14px', textAlign:'right', fontFamily:'monospace', fontWeight:700, fontSize:'13px', color:'#16A34A' }}>
                        {fmtR$(cortes.reduce((s, c) => s + (parseFloat(c.peso)||0) * (parseFloat(c.precoVenda)||0), 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Resumo pós-registro */}
              {resumo && (
                <div style={{ borderTop:'1px solid #E2E8F0', padding:'16px' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', marginBottom:'14px' }}>
                    {[
                      { label:'Custo Total', value:`R$ ${resumo.custoTotal.toFixed(2)}`, color:'#DC2626' },
                      { label:'Venda Projetada', value:`R$ ${resumo.vendaTotal.toFixed(2)}`, color:'#16A34A' },
                      { label:'Margem Geral', value:`${resumo.margem}%`, color: parseFloat(resumo.margem) >= 40 ? '#16A34A' : '#F59E0B' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign:'center' }}>
                        <p style={{ fontSize:'11px', color:'#64748B', fontWeight:600, marginBottom:'4px' }}>{label}</p>
                        <p style={{ fontWeight:800, fontSize:'16px', color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setRelatorioAberto(true)}
                    style={{ width:'100%', padding:'10px', background:'#EFF6FF', border:'1px solid #BFDBFE', borderRadius:'8px', color:'#1D4ED8', fontWeight:700, fontSize:'13px', cursor:'pointer' }}>
                    📊 Ver Relatório Completo de Quebra & Lucratividade da Peça
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function PainelDesossa() {
  const [templates, setTemplates]     = useState([]);
  const [carregando, setCarregando]   = useState(true);
  const [templateAtivo, setTemplateAtivo] = useState(null);
  const [modalNova, setModalNova]     = useState(false);
  const [criando, setCriando]         = useState(false);
  const [confirmDeletar, setConfirmDeletar] = useState(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/desossa');
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const criarTemplate = async (nome) => {
    setCriando(true);
    try {
      const { data } = await api.post('/desossa', { nome });
      setModalNova(false);
      setTemplates(p => [data, ...p]);
      setTemplateAtivo(data);
    } catch (e) {
      alert(e.response?.data?.erro || 'Erro ao criar.');
    } finally { setCriando(false); }
  };

  const deletarTemplate = async (t) => {
    if (!window.confirm(`Excluir "${t.nome}"? Os dados de estoque registrados não serão afetados.`)) return;
    try {
      await api.delete(`/desossa/${t.id}`);
      setTemplates(p => p.filter(x => x.id !== t.id));
    } catch (e) {
      alert('Erro ao excluir.');
    }
  };

  const abrirTemplate = async (t) => {
    // Recarrega para ter dados mais recentes
    try {
      const { data } = await api.get('/desossa');
      const atualizado = data.find(x => x.id === t.id) || t;
      setTemplates(data);
      setTemplateAtivo(atualizado);
    } catch {
      setTemplateAtivo(t);
    }
  };

  if (templateAtivo) {
    return (
      <EditorDesossa
        template={templateAtivo}
        onVoltar={() => { setTemplateAtivo(null); carregar(); }}
        onRegistrado={() => carregar()}
      />
    );
  }

  return (
    <>
      {modalNova && <ModalNova onCriar={criarTemplate} onFechar={() => setModalNova(false)} criando={criando} />}
      <ListaDesossas
        templates={templates}
        carregando={carregando}
        onAbrir={abrirTemplate}
        onNova={() => setModalNova(true)}
        onDeletar={deletarTemplate}
      />
    </>
  );
}
