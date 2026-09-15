const fs   = require('fs');
const path = require('path');

const DB_PATH     = path.join(__dirname, '../../prisma/acougue_admin.db');
const BACKUP_DIR  = path.join(__dirname, '../../backups');

function garantirDiretorio() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function nomeArquivo() {
  const d = new Date();
  const data = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const hora = `${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
  return `backup_${data}_${hora}.db`;
}

function limparBackupsAntigos() {
  try {
    const arquivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => ({ nome: f, tempo: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.tempo - a.tempo);
    // Manter apenas os ultimos 30 backups
    arquivos.slice(30).forEach(f => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f.nome)); } catch {}
    });
  } catch {}
}

exports.fazerBackup = (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH))
      return res.status(404).json({ erro: 'Banco de dados nao encontrado.' });
    garantirDiretorio();
    const destino = path.join(BACKUP_DIR, nomeArquivo());
    fs.copyFileSync(DB_PATH, destino);
    limparBackupsAntigos();
    const tamanho = fs.statSync(destino).size;
    res.json({
      mensagem: 'Backup realizado com sucesso.',
      arquivo: path.basename(destino),
      tamanho: `${(tamanho / 1024).toFixed(1)} KB`,
      timestamp: new Date()
    });
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao fazer backup.', detalhe: e.message });
  }
};

exports.listarBackups = (req, res) => {
  try {
    garantirDiretorio();
    const arquivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { nome: f, tamanho: `${(stat.size/1024).toFixed(1)} KB`, data: stat.mtime };
      })
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    res.json(arquivos);
  } catch (e) {
    res.status(500).json({ erro: 'Erro ao listar backups.' });
  }
};

exports.downloadBackup = (req, res) => {
  const { nome } = req.params;
  if (!nome.startsWith('backup_') || !nome.endsWith('.db'))
    return res.status(400).json({ erro: 'Arquivo invalido.' });
  const filePath = path.join(BACKUP_DIR, nome);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ erro: 'Backup nao encontrado.' });
  res.download(filePath);
};

// Backup automatico - chame no startup
exports.backupAutomatico = () => {
  if (!fs.existsSync(DB_PATH)) return;
  try {
    garantirDiretorio();
    const hoje = new Date().toISOString().split('T')[0];
    const jaFez = fs.readdirSync(BACKUP_DIR).some(f => f.includes(hoje));
    if (!jaFez) {
      const destino = path.join(BACKUP_DIR, nomeArquivo());
      fs.copyFileSync(DB_PATH, destino);
      limparBackupsAntigos();
      console.log(`[backup] Backup automatico: ${path.basename(destino)}`);
    }
  } catch (e) {
    console.error('[backup] Erro no backup automatico:', e.message);
  }
};
