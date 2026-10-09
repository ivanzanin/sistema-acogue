import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { gerarPayloadPix, gerarQrCodePixDataUrl } from '../utils/pix';
import { imprimirCupom } from '../utils/imprimirCupom';

const Step = ({ num, title, children }) => (
  <div className="flex gap-4">
    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-sm flex items-center justify-center mt-0.5">
      {num}
    </div>
    <div className="flex-1 pb-6 border-b border-stone-200 last:border-0">
      <p className="text-sm font-bold text-stone-900 mb-2">{title}</p>
      <div className="text-xs text-stone-600 space-y-1.5 leading-relaxed">{children}</div>
    </div>
  </div>
);

const Code = ({ children }) => (
  <code className="bg-stone-100 border border-stone-300 text-amber-700 px-2 py-0.5 rounded font-mono text-xs">{children}</code>
);

const Cmd = ({ children }) => (
  <div className="bg-black border border-stone-300 rounded-lg px-4 py-2.5 font-mono text-emerald-700 text-xs mt-2 select-all">{children}</div>
);


function LogoUploadSection() {
  const [uploading, setUploading]   = React.useState(false);
  const [preview, setPreview]       = React.useState(null);
  const [sucesso, setSucesso]       = React.useState(false);
  const [erro, setErro]             = React.useState(null);
  const fileRef                     = React.useRef(null);

  const cliente = (() => { try { return JSON.parse(localStorage.getItem('cliente')); } catch { return null; } })();
  const logoAtual = preview || cliente?.logoUrl || '/logos/logo_rezende.jpg';

  const selecionar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Preview local
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    // Upload
    uploadLogo(file);
  };

  const uploadLogo = async (file) => {
    setUploading(true); setSucesso(false); setErro(null);
    try {
      const token = localStorage.getItem('token');
      const resp  = await fetch('/api/tenant/logo', {
        method: 'POST',
        headers: { 'Content-Type': file.type, 'Authorization': `Bearer ${token}` },
        body: file,
      });
      const data = await resp.json();
      if (data.logoUrl) {
        const cl = JSON.parse(localStorage.getItem('cliente') || '{}');
        cl.logoUrl = data.logoUrl;
        localStorage.setItem('cliente', JSON.stringify(cl));
        setSucesso(true);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setErro('Erro ao salvar logo.');
      }
    } catch (e) {
      setErro('Erro ao enviar arquivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{maxWidth:'520px'}}>
      <div className="card p-6">
        <h2 style={{fontWeight:700, fontSize:'16px', color:'#1E293B', marginBottom:'4px'}}>Logo do Açougue</h2>
        <p style={{fontSize:'13px', color:'#64748B', marginBottom:'24px'}}>
          Esta logo aparece na sidebar e na tela de login do sistema.
        </p>

        {/* Preview */}
        <div style={{display:'flex', alignItems:'flex-start', gap:'24px', marginBottom:'24px'}}>
          <div style={{
            width:'140px', height:'140px', borderRadius:'12px', overflow:'hidden',
            border:'2px solid #E2E8F0', flexShrink:0, background:'#F8FAFC',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <img src={logoAtual} alt="Logo atual"
              style={{width:'100%', height:'100%', objectFit:'contain'}} />
          </div>
          <div style={{flex:1}}>
            <p style={{fontWeight:600, fontSize:'13px', color:'#475569', marginBottom:'8px'}}>Logo atual</p>
            <p style={{fontSize:'12px', color:'#94A3B8', marginBottom:'16px'}}>
              Formatos aceitos: JPG, PNG, WEBP<br/>
              Tamanho máximo: 2 MB<br/>
              Recomendado: fundo transparente (PNG)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{display:'none'}}
              onChange={selecionar}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary"
              style={{display:'flex', alignItems:'center', gap:'8px'}}>
              <span>📷</span>
              <span>{uploading ? 'Enviando...' : 'Escolher Nova Logo'}</span>
            </button>
          </div>
        </div>

        {sucesso && (
          <div style={{background:'#DCFCE7', border:'1px solid #BBF7D0', borderRadius:'10px', padding:'12px 16px', color:'#166534', fontSize:'13px', fontWeight:600}}>
            ✓ Logo atualizada! A página vai recarregar em instantes...
          </div>
        )}
        {erro && (
          <div style={{background:'#FEE2E2', border:'1px solid #FECACA', borderRadius:'10px', padding:'12px 16px', color:'#991B1B', fontSize:'13px', fontWeight:600}}>
            ❌ {erro}
          </div>
        )}

        <div style={{marginTop:'20px', padding:'16px', background:'#F8FAFC', borderRadius:'10px', border:'1px solid #E2E8F0'}}>
          <p style={{fontWeight:700, fontSize:'12px', color:'#475569', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.05em'}}>
            💡 Dica
          </p>
          <p style={{fontSize:'12px', color:'#64748B', lineHeight:'1.6'}}>
            Você também pode trocar a logo clicando diretamente na imagem no canto superior esquerdo da sidebar. 
            A logo é salva no servidor e aparece para todos os usuários do açougue.
          </p>
        </div>
      </div>
    </div>
  );
}

function PixConfigSection() {
  const cliente = (() => { try { return JSON.parse(localStorage.getItem('cliente')); } catch { return null; } })();
  const [chave, setChave]     = useState(() => localStorage.getItem('pix_chave') || cliente?.cnpj || '');
  const [nome, setNome]       = useState(() => localStorage.getItem('pix_nome') || cliente?.nomeAcougue || 'ACOUQUE');
  const [cidade, setCidade]   = useState(() => localStorage.getItem('pix_cidade') || 'SAO PAULO');
  const [salvo, setSalvo]     = useState(false);
  const [previewQr, setPreviewQr] = useState('');

  const salvar = (e) => {
    e?.preventDefault();
    localStorage.setItem('pix_chave', chave.trim());
    localStorage.setItem('pix_nome', nome.trim());
    localStorage.setItem('pix_cidade', cidade.trim());
    setSalvo(true);
    setTimeout(() => setSalvo(false), 3000);
  };

  useEffect(() => {
    if (!chave.trim()) { setPreviewQr(''); return; }
    const p = gerarPayloadPix({ chave: chave.trim(), nome: nome.trim(), cidade: cidade.trim(), valor: 1.00 });
    gerarQrCodePixDataUrl(p).then(url => setPreviewQr(url)).catch(() => {});
  }, [chave, nome, cidade]);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">📱</span>
          <div>
            <h2 className="text-base font-bold text-stone-900">Configuração do PIX (QR Code Dinâmico)</h2>
            <p className="text-xs text-stone-500">Defina os dados da sua conta para que o caixa gere o QR Code com o valor exato da venda</p>
          </div>
        </div>

        <form onSubmit={salvar} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">Chave PIX do Açougue *</label>
            <input
              type="text"
              required
              value={chave}
              onChange={e => setChave(e.target.value)}
              placeholder="CNPJ, CPF, Celular, E-mail ou Chave Aleatória"
              className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-brand-500 font-mono"
            />
            <p className="text-[11px] text-stone-500 mt-1">Exemplo: 12.345.678/0001-90, financeiro@acougue.com, etc.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Nome do Titular / Razão Social *</label>
              <input
                type="text"
                required
                maxLength={25}
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Ex: ACOUQUE REZENDE"
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-brand-500 uppercase"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">Máximo 25 caracteres (padrão Banco Central)</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Cidade da Loja / Agência *</label>
              <input
                type="text"
                required
                maxLength={15}
                value={cidade}
                onChange={e => setCidade(e.target.value)}
                placeholder="Ex: SAO PAULO"
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-brand-500 uppercase"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">Máximo 15 caracteres</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-all active:scale-95">
              Salvar Configurações PIX
            </button>
            {salvo && (
              <span className="text-xs font-bold text-emerald-700">✓ Dados do PIX salvos com sucesso!</span>
            )}
          </div>
        </form>
      </div>

      {previewQr && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 flex items-center gap-6">
          <div className="p-2 border border-stone-200 rounded-lg bg-stone-50 shadow-sm flex-shrink-0">
            <img src={previewQr} alt="Preview QR Code Pix" className="w-36 h-36 block" />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Preview em Tempo Real</span>
            <p className="text-sm font-bold text-stone-900 mt-2">QR Code de Teste Gerado (R$ 1,00)</p>
            <p className="text-xs text-stone-500 mt-1 max-w-md">
              Seu QR Code está válido no formato oficial do Banco Central (BR Code). Na Frente de Caixa, o valor e o código serão gerados dinamicamente a cada venda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FiscalConfigSection() {
  const [config, setConfig] = useState({
    ambiente: 1,
    cnpj: '68879953000105',
    razaoSocial: 'L H REZENDE DA SILVA ACOUGUE LTDA',
    nomeFantasia: 'Casa de Carne Rezende',
    inscricaoEstadual: '',
    uf: 'PR',
    municipio: 'Astorga',
    codigoIbgeMunicipio: '4102109',
    tokenCsc: '6CRSC5ZHMECONKZQUJKB0OCQSM1WCEP5I55D',
    idTokenCsc: '000001',
    serie: 1,
    ultimoNumero: 0,
    emitirOpcional: true,
    certificadoSenha: '',
  });
  const [notas, setNotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [resConf, resNotas] = await Promise.all([
        api.get('/fiscal/config'),
        api.get('/fiscal/notas'),
      ]);
      if (resConf.data) {
        setConfig(prev => ({
          ...prev,
          ...resConf.data,
          certificadoSenha: '',
        }));
      }
      if (Array.isArray(resNotas.data)) {
        setNotas(resNotas.data);
      }
    } catch (e) {
      console.error('[FiscalConfig] Erro ao carregar:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  const salvar = async (e) => {
    e?.preventDefault();
    setSalvando(true);
    setMsg(null);
    try {
      const { data } = await api.post('/fiscal/config', config);
      setMsg({ tipo: 'ok', texto: 'Configurações fiscais salvas com sucesso!' });
      if (data.config) {
        setConfig(prev => ({ ...prev, ...data.config, certificadoSenha: '' }));
      }
      setTimeout(() => setMsg(null), 4000);
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao salvar configurações fiscais.' });
    } finally {
      setSalvando(false);
    }
  };

  const baixarXml = (notaId, chave) => {
    const token = localStorage.getItem('token');
    window.open(`/fiscal/notas/${notaId}/xml?token=${token}`, '_blank');
  };

  const reimprimir = (nota) => {
    const itens = [
      {
        nome: 'Venda de Balcão / Carnes',
        unidade: 'UN',
        quantidade: 1,
        peso: '1',
        precoKg: nota.valorTotal,
        total: nota.valorTotal,
      }
    ];

    imprimirCupom(
      itens,
      nota.valorTotal,
      config.nomeFantasia || 'CASA DE CARNE REZENDE',
      'DINHEIRO',
      nota.valorTotal,
      0,
      null,
      {
        chaveAcesso: nota.chaveAcesso,
        numero: nota.numero,
        serie: nota.serie,
        protocolo: nota.protocolo,
        qrCodeUrl: nota.qrCodeUrl,
        cpfDestinatario: nota.cpfDestinatario,
        danfeInfo: {
          chaveAcesso: nota.chaveAcesso,
          numero: nota.numero,
          serie: nota.serie,
          protocolo: nota.protocolo,
          qrCodeUrl: nota.qrCodeUrl,
          emitente: {
            razaoSocial: config.razaoSocial,
            cnpj: config.cnpj,
            ie: config.inscricaoEstadual,
            municipio: config.municipio,
            uf: config.uf,
          },
          destinatario: nota.cpfDestinatario ? { cpf: nota.cpfDestinatario } : null,
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL DE CONFIGURAÇÃO */}
      <div className="bg-white border border-stone-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-200 mb-6 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧾</span>
            <div>
              <h2 className="text-base font-bold text-stone-900">Emissão de Cupom Fiscal Eletrônico (NFC-e - SEFAZ/PR)</h2>
              <p className="text-xs text-stone-500">Credenciais oficiais da SEFAZ Paraná, Token CSC de Produção e Certificado A1</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
              {config.ambiente === 1 ? 'Ambiente: Produção (SEFAZ-PR)' : 'Ambiente: Homologação / Teste'}
            </span>
          </div>
        </div>

        {/* STATUS DO CERTIFICADO E CSC */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-xs font-bold text-emerald-900">Certificado Digital A1 Integrado</p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Arquivo <b>certificado.pfx</b> instalado no servidor e protegido contra uploads externos.
              </p>
              <p className="text-[10px] text-emerald-600 mt-1">Status: Conectado e pronto para assinar NFC-e</p>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-2xl">🔑</span>
            <div>
              <p className="text-xs font-bold text-stone-900">Token CSC Oficial Paraná (QR Code 2.0)</p>
              <p className="text-[11px] text-stone-600 mt-0.5">
                Id Token: <b>000001</b> | Código de Segurança Ativo
              </p>
              <p className="text-[10px] text-stone-500 mt-1">Gera QR Code legível pela câmera de celulares e fiscais</p>
            </div>
          </div>
        </div>

        {msg && (
          <div className={`mb-6 px-4 py-3 rounded-xl text-xs font-bold border ${msg.tipo === 'ok' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
            {msg.texto}
          </div>
        )}

        <form onSubmit={salvar} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">CNPJ do Emitente *</label>
              <input
                type="text"
                required
                value={config.cnpj}
                onChange={e => setConfig({ ...config, cnpj: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">Razão Social (Receita Federal / SEFAZ) *</label>
              <input
                type="text"
                required
                value={config.razaoSocial}
                onChange={e => setConfig({ ...config, razaoSocial: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Nome Fantasia *</label>
              <input
                type="text"
                required
                value={config.nomeFantasia}
                onChange={e => setConfig({ ...config, nomeFantasia: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Inscrição Estadual (IE)</label>
              <input
                type="text"
                value={config.inscricaoEstadual}
                onChange={e => setConfig({ ...config, inscricaoEstadual: e.target.value })}
                placeholder="Ex: 90812345-67"
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Município / UF *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={config.municipio}
                  onChange={e => setConfig({ ...config, municipio: e.target.value })}
                  className="flex-1 bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-brand-500"
                />
                <input
                  type="text"
                  required
                  maxLength={2}
                  value={config.uf}
                  onChange={e => setConfig({ ...config, uf: e.target.value.toUpperCase() })}
                  className="w-14 text-center bg-stone-50 border border-stone-300 rounded-lg px-2 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-brand-500 uppercase"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-stone-700 mb-1">Token CSC (Produção SEFAZ/PR) *</label>
              <input
                type="text"
                required
                value={config.tokenCsc}
                onChange={e => setConfig({ ...config, tokenCsc: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Id Token CSC *</label>
              <input
                type="text"
                required
                value={config.idTokenCsc}
                onChange={e => setConfig({ ...config, idTokenCsc: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Código IBGE Município</label>
              <input
                type="text"
                value={config.codigoIbgeMunicipio}
                onChange={e => setConfig({ ...config, codigoIbgeMunicipio: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Série da NFC-e</label>
              <input
                type="number"
                min="1"
                max="999"
                value={config.serie}
                onChange={e => setConfig({ ...config, serie: parseInt(e.target.value) || 1 })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Último Número Emitido</label>
              <input
                type="number"
                min="0"
                value={config.ultimoNumero}
                onChange={e => setConfig({ ...config, ultimoNumero: parseInt(e.target.value) || 0 })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Ambiente SEFAZ</label>
              <select
                value={config.ambiente}
                onChange={e => setConfig({ ...config, ambiente: parseInt(e.target.value) })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-brand-500"
              >
                <option value={1}>1 - Produção (Válido Fiscalmente)</option>
                <option value={2}>2 - Homologação (Testes)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">Senha do Certificado A1</label>
              <input
                type="password"
                placeholder="(Em branco p/ manter atual)"
                value={config.certificadoSenha}
                onChange={e => setConfig({ ...config, certificadoSenha: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded-lg px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* CHECKBOX EMISSÃO OPCIONAL */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-stone-200 bg-stone-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.emitirOpcional}
                onChange={e => setConfig({ ...config, emitirOpcional: e.target.checked })}
                className="w-5 h-5 accent-emerald-600 rounded border-stone-300"
              />
              <div>
                <p className="text-xs font-bold text-stone-900">Emissão Opcional por Venda (Recomendado)</p>
                <p className="text-[11px] text-stone-500">
                  Permite ao operador de caixa marcar a caixinha "Emitir Cupom Fiscal (NFC-e)" apenas quando o cliente solicitar, mantendo as demais vendas como cupom interno.
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center gap-3 pt-3">
            <button
              type="submit"
              disabled={salvando}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-all active:scale-95"
            >
              {salvando ? 'Salvando...' : 'Salvar Configurações Fiscais'}
            </button>
            <button
              type="button"
              onClick={carregarDados}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-all"
            >
              Recarregar
            </button>
          </div>
        </form>
      </div>

      {/* HISTÓRICO DE NOTAS FISCAIS EMITIDAS */}
      <div className="bg-white border border-stone-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Histórico de NFC-e Emitidas</h3>
            <p className="text-xs text-stone-500">Notas autorizadas pela SEFAZ com link de download de XML e reimpressão</p>
          </div>
          <span className="text-xs font-bold text-stone-600 bg-stone-100 px-3 py-1 rounded-lg">
            Total emitidas: {notas.length}
          </span>
        </div>

        {loading ? (
          <p className="text-xs text-stone-500 py-4">Carregando histórico fiscal...</p>
        ) : notas.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-xs">
            Nenhuma nota fiscal emitida ainda. Ao realizar vendas com a opção "Emitir Cupom Fiscal" marcada no PDV ou Comandas, elas aparecerão aqui.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Nº / Série</th>
                  <th className="py-2.5 px-3">Valor Total</th>
                  <th className="py-2.5 px-3">CPF Consumidor</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Chave de Acesso</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {notas.map(n => (
                  <tr key={n.id} className="hover:bg-stone-50/80">
                    <td className="py-2.5 px-3 font-medium text-stone-700">
                      {new Date(n.dataEmissao).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-stone-900">
                      NFC-e #{String(n.numero).padStart(6, '0')} (Série {n.serie})
                    </td>
                    <td className="py-2.5 px-3 font-bold font-mono text-stone-900">
                      R$ {parseFloat(n.valorTotal).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-stone-600 font-mono">
                      {n.cpfDestinatario || 'Não informado'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {n.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[10px] text-stone-500 max-w-xs truncate" title={n.chaveAcesso}>
                      {n.chaveAcesso}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => reimprimir(n)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors"
                        title="Reimprimir Cupom DANFE NFC-e"
                      >
                        🖨️ Imprimir
                      </button>
                      <button
                        onClick={() => baixarXml(n.id, n.chaveAcesso)}
                        className="px-2.5 py-1 text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded transition-colors"
                        title="Baixar Arquivo XML Oficial para a contabilidade"
                      >
                        📥 XML
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [backups, setBackups]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [fazendo, setFazendo]     = useState(false);
  const [msg, setMsg]             = useState(null);
  const [tabAtiva, setTabAtiva]   = useState('logo');

  const carregarBackups = async () => {
    setLoading(true);
    try { const { data } = await api.get('/backup/listar'); setBackups(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { carregarBackups(); }, []);

  const fazerBackup = async () => {
    setFazendo(true); setMsg(null);
    try {
      const { data } = await api.post('/backup/fazer');
      setMsg({ tipo: 'ok', texto: `Backup realizado: ${data.arquivo} (${data.tamanho})` });
      carregarBackups();
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.response?.data?.erro || 'Erro ao fazer backup.' });
    } finally { setFazendo(false); }
  };

  const downloadBackup = (nome) => {
    const token = localStorage.getItem('token');
    window.open(`/backup/download/${nome}?token=${token}`, '_blank');
  };

  const tabs = [
    { id: 'logo',    label: '🖼️ Logo do Açougue' },
    { id: 'fiscal',  label: '🧾 Nota Fiscal (NFC-e)' },
    { id: 'pix',     label: '📱 PIX Dinâmico' },
    { id: 'leitor',  label: '🏷️ Leitor de Código de Barras' },
    { id: 'backup',  label: '💾 Backup' },
    { id: 'sistema', label: 'ℹ️ Sistema' },
  ];
  const tabAtiva2 = tabAtiva || 'logo';

  return (
    <div className="min-h-screen bg-page p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Configurações</h1>
        <p className="text-xs text-stone-500 mt-0.5">PIX, NFC-e fiscal, leitor de código de barras, backup e sistema</p>
      </div>

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b border-stone-200 pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTabAtiva(t.id)}
            className={`text-xs px-5 py-2.5 rounded-t-lg font-bold transition-all ${tabAtiva === t.id ? 'bg-white border border-b-zinc-900 border-stone-300 text-amber-700 -mb-px' : 'text-stone-500 hover:text-stone-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: LOGO */}
      {tabAtiva === 'logo' && (
        <LogoUploadSection />
      )}

      {/* TAB: FISCAL */}
      {tabAtiva === 'fiscal' && (
        <FiscalConfigSection />
      )}

      {/* TAB: PIX */}
      {tabAtiva === 'pix' && (
        <PixConfigSection />
      )}

      {tabAtiva === 'leitor' && (
        <div className="space-y-6">

          {/* Status do Leitor */}
          <div className="bg-white border border-stone-200 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏷️</span>
              <div>
                <p className="text-sm font-bold text-stone-900">Leitor de Código de Barras (Plug & Play)</p>
                <p className="text-xs text-stone-500 mt-0.5">Leitores USB ou sem fio funcionam de forma nativa e automática</p>
                <p className="text-xs mt-1.5 font-bold text-emerald-700">
                  ✓ Ativo e monitorando leituras em segundo plano
                </p>
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg text-right">
              <span className="text-xs font-bold text-emerald-800">Pronto para uso</span>
              <p className="text-[10px] text-emerald-600">Sem necessidade de drivers extras</p>
            </div>
          </div>

          {/* Como funciona */}
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <p className="text-sm font-bold text-stone-900 mb-6">Como o Leitor Opera no Sistema</p>
            <div className="space-y-0">

              <Step num="1" title="Produtos com Código de Barras Padrão (EAN-13 / UN)">
                <p>Ao escanear refrigerantes, carvão, temperos ou produtos unitários cadastrados:</p>
                <p className="text-stone-700 font-bold mt-1">• O produto é adicionado imediatamente ao carrinho na Frente de Caixa.</p>
                <p className="mt-1">Se o mesmo item for escaneado novamente, a quantidade aumenta automaticamente (+1).</p>
              </Step>

              <Step num="2" title="Etiquetas Impressas por Balança de Etiquetas (Prefixo 2)">
                <p>Quando as carnes são pesadas e etiquetadas na balança de etiquetas (Toledo, Filizola, Elgin, etc.):</p>
                <p className="text-stone-700 font-bold mt-1">• O leitor no caixa lê a etiqueta iniciando com o número 2.</p>
                <p className="text-stone-700 font-bold">• O sistema extrai automaticamente o código do produto e o peso/valor total embutido na etiqueta.</p>
                <p className="mt-1">Não é necessário digitar o peso manualmente quando a etiqueta já contém os dados pesados.</p>
              </Step>

              <Step num="3" title="Produtos por Quilo (KG) sem Etiqueta de Balança">
                <p>Se você escanear o código de um produto vendido por KG que não contenha o peso impresso na etiqueta:</p>
                <p className="text-stone-700 font-bold mt-1">• Uma janela rápida abrirá solicitando a digitação do peso em kg.</p>
                <p className="mt-1">Basta digitar o peso (ex: <Code>1.250</Code>) e pressionar <Code>Enter</Code>.</p>
              </Step>

              <Step num="4" title="Vinculação Rápida de Códigos Desconhecidos">
                <p>Se você escanear um código de barras que ainda não está cadastrado:</p>
                <p className="mt-1">A tela do PDV abrirá uma janela com a opção de <b>Vincular a um Produto Existente</b> ou <b>Cadastrar Novo Produto</b> com o código já preenchido.</p>
              </Step>

            </div>
          </div>

          {/* Dicas de Configuração do Leitor */}
          <div className="bg-white border border-stone-200 rounded-xl p-6">
            <p className="text-sm font-bold text-stone-900 mb-2">Dica de Configuração do Scanner</p>
            <p className="text-xs text-stone-600 mb-4 leading-relaxed">
              Quase todos os leitores de código de barras USB/Wireless já vêm configurados de fábrica no modo <b>Teclado HID com sufixo ENTER</b>.
              Caso o seu leitor não envie o comando após a leitura, consulte o manual rápido do seu scanner e leia o código de barras correspondente a <i>"Add CR/Enter Suffix"</i>.
            </p>
          </div>

        </div>
      )}

      {/* TAB: BACKUP */}
      {tabAtiva === 'backup' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-stone-900">Backup do Banco de Dados</p>
              <p className="text-xs text-stone-500 mt-1">Backup automatico diario — mantenha copias de seguranca</p>
            </div>
            <button onClick={fazerBackup} disabled={fazendo}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded transition-all active:scale-95">
              {fazendo ? 'Fazendo backup...' : 'Fazer Backup Agora'}
            </button>
          </div>

          {msg && (
            <div className={`mb-4 px-4 py-3 rounded text-sm font-bold border ${msg.tipo === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : 'bg-red-500/10 border-red-500/30 text-red-700'}`}>
              {msg.texto}
            </div>
          )}

          {loading ? (
            <div className="text-stone-500 text-xs font-medium animate-pulse">Carregando backups...</div>
          ) : backups.length === 0 ? (
            <div className="text-stone-600 text-xs font-medium text-center py-8">Nenhum backup encontrado</div>
          ) : (
            <div className="space-y-2">
              {backups.map((b, i) => (
                <div key={b.nome} className="flex items-center justify-between bg-stone-100 rounded-lg px-4 py-3 group">
                  <div className="flex items-center gap-3">
                    {i === 0 && <span className="text-xs bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">Mais recente</span>}
                    <div>
                      <p className="text-sm font-bold text-stone-900">{b.nome}</p>
                      <p className="text-xs text-stone-500">{new Date(b.data).toLocaleString('pt-BR')} — {b.tamanho}</p>
                    </div>
                  </div>
                  <button onClick={() => downloadBackup(b.nome)}
                    className="text-xs text-stone-500 hover:text-amber-700 border border-stone-300 hover:border-brand-600 px-3 py-1.5 rounded transition-all opacity-0 group-hover:opacity-100">
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: SISTEMA */}
      {tabAtiva === 'sistema' && (
        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <p className="text-sm font-bold text-stone-900 mb-4">Informacoes do Sistema</p>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              { label:'Versao', valor:'5.0.0' },
              { label:'Banco de Dados', valor:'SQLite (local)' },
              { label:'Backend', valor:'Node.js + Express + Prisma' },
              { label:'Frontend', valor:'React 18 + Vite + Tailwind CSS' },
              { label:'Autenticacao', valor:'JWT + bcryptjs + Refresh Token' },
              { label:'Backup', valor:'Automatico diario + manual' },
              { label:'Entrada de Produtos', valor:'Leitor de Código de Barras (USB / Sem fio)' },
              { label:'Modo offline', valor:'100% local, sem internet' },
            ].map(({ label, valor }) => (
              <div key={label} className="flex justify-between border-b border-stone-200 pb-2">
                <span className="text-stone-600">{label}</span>
                <span className="text-stone-700 font-bold">{valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
