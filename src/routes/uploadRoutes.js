const express = require('express');
const { authenticate } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/', authenticate, (req, res) => {
  upload.array('photos', 6)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB per file.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 6 photos.' });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
  });
});

module.exports = router;
