const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');

// Start a new authentication order
// POST /api/auth/start
router.post('/start', auth.startAuth);

// Get the current QR code data for an order (call every 1 second)
// GET /api/auth/qr/:orderRef
router.get('/qr/:orderRef', auth.getQrCode);

// Poll the status of an order (call every 2 seconds)
// POST /api/auth/collect
router.post('/collect', auth.collectAuth);

// Cancel an ongoing order
// POST /api/auth/cancel
router.post('/cancel', auth.cancelAuth);

module.exports = router;
