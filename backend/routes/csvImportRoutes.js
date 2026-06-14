const express = require('express');
const multer = require('multer');
const CsvImportController = require('../controllers/csvImportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Enforce authentication
router.use(authMiddleware);

// Configure multer to store files in memory as buffer (diskless)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    // Only accept CSV files
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Post route to import CSV
router.post('/import', upload.single('file'), CsvImportController.importCsv);

module.exports = router;
