const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/authMiddleware');
const ctrl    = require('../controllers/tenantController');

// O frontend manda a imagem como body cru (Content-Type: image/*).
// express.raw() preenche req.body com um Buffer.
const rawImage = express.raw({
  type: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
  limit: '2mb',
});

router.post  ('/logo', auth, rawImage, ctrl.uploadLogo);
router.delete('/logo', auth,           ctrl.removerLogo);

module.exports = router;
