const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const sign    = require('../controllers/signController');

// Store uploaded files in memory (buffer) — signService writes them to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// Upload a PDF document
// POST /api/sign/upload
router.post('/upload', upload.single('document'), sign.uploadDocument);

// Start a BankID signing order for a document
// POST /api/sign/start
router.post('/start', sign.startSigning);

// Poll the signing order (call every 2 seconds)
// POST /api/sign/collect
router.post('/collect', sign.collectSigning);

// Cancel a signing order
// POST /api/sign/cancel
router.post('/cancel', sign.cancelSigning);

// Download the signed PDF
// GET /api/sign/download/:documentId
router.get('/download/:documentId', sign.downloadSigned);

// Get the full BankID proof JSON
// GET /api/sign/proof/:documentId
router.get('/proof/:documentId', sign.getProof);

module.exports = router;
