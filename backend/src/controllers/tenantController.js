const path   = require('path');
const fs     = require('fs');
const prisma = require('../lib/prisma');

const LOGOS_DIR = path.join(__dirname, '..', '..', 'public', 'logos');

// Map Content-Type -> extensao
const MIME_EXT = {
  'image/png' : '.png',
  'image/jpeg': '.jpg',
  'image/jpg' : '.jpg',
  'image/webp': '.webp',
  'image/gif' : '.gif',
};

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * POST /api/tenant/logo
 * Recebe a imagem CRUA no body (Content-Type: image/png, image/jpeg, etc).
 * Salva em backend/public/logos/tenant_<id>.<ext> e atualiza logoUrl no DB.
 *
 * O frontend (Sidebar do App.jsx) ja faz fetch assim:
 *   fetch('/api/tenant/logo', { method:'POST', headers:{'Content-Type':file.type, Authorization:`Bearer ${token}`}, body:file })
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (req.user?.isAdmin) {
      return res.status(403).json({ erro: 'Admin nao tem logo proprio.' });
    }

    const tenantId = req.user?.id;
    if (!tenantId) return res.status(401).json({ erro: 'Nao autenticado.' });

    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const ext = MIME_EXT[contentType];
    if (!ext) {
      return res.status(400).json({ erro: 'Formato invalido. Envie PNG, JPG, WEBP ou GIF.' });
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ erro: 'Arquivo vazio ou invalido.' });
    }
    if (req.body.length > MAX_BYTES) {
      return res.status(413).json({ erro: 'Arquivo muito grande (limite 2MB).' });
    }

    if (!fs.existsSync(LOGOS_DIR)) fs.mkdirSync(LOGOS_DIR, { recursive: true });

    // Apaga logos antigos do mesmo tenant (qualquer extensao)
    const prefix = `tenant_${tenantId}`;
    for (const f of fs.readdirSync(LOGOS_DIR)) {
      if (f.startsWith(prefix)) {
        try { fs.unlinkSync(path.join(LOGOS_DIR, f)); } catch {}
      }
    }

    const fileName = `${prefix}${ext}`;
    const fullPath = path.join(LOGOS_DIR, fileName);
    fs.writeFileSync(fullPath, req.body);

    // Cache-busting com timestamp para forcar reload no <img>
    const logoUrl = `/logos/${fileName}?v=${Date.now()}`;

    await prisma.clienteTenant.update({
      where: { id: tenantId },
      data:  { logoUrl },
    });

    res.json({ logoUrl });
  } catch (e) {
    console.error('[tenant:logo]', e.message);
    res.status(500).json({ erro: 'Erro ao salvar logo.' });
  }
};

/**
 * DELETE /api/tenant/logo  — volta para o estado "sem logo"
 */
exports.removerLogo = async (req, res) => {
  try {
    const tenantId = req.user?.id;
    if (!tenantId || req.user?.isAdmin) {
      return res.status(403).json({ erro: 'Operacao nao permitida.' });
    }

    if (fs.existsSync(LOGOS_DIR)) {
      const prefix = `tenant_${tenantId}`;
      for (const f of fs.readdirSync(LOGOS_DIR)) {
        if (f.startsWith(prefix)) {
          try { fs.unlinkSync(path.join(LOGOS_DIR, f)); } catch {}
        }
      }
    }

    await prisma.clienteTenant.update({
      where: { id: tenantId },
      data:  { logoUrl: null },
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('[tenant:logo:del]', e.message);
    res.status(500).json({ erro: 'Erro ao remover logo.' });
  }
};
