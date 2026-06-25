import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction
} from '../controllers/transactionController.js';

// ── Multer config ─────────────────────────────────────────────
// controls how uploaded files are stored
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // files saved to uploads/ folder
  },
  filename: (req, file, cb) => {
    // gives each file a unique name so files never overwrite each other
    // e.g. bill-1234567890-123456789.pdf
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `bill-${unique}${path.extname(file.originalname)}`);
  }
});

// file filter — only allow pdf, jpg, jpeg, png
const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
  const ext     = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG and PNG files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB max
});

// ── Routes ────────────────────────────────────────────────────
const router = express.Router();

// GET    /api/transactions      ← get all (supports ?type= &party= &from= &to= &keyword= &payment_method=)
// POST   /api/transactions      ← create new (supports file upload)
router.route('/')
  .get(getTransactions)
  .post(upload.single('attachment'), createTransaction);

// GET    /api/transactions/:id  ← get single transaction
// PUT    /api/transactions/:id  ← update transaction (supports file upload)
// DELETE /api/transactions/:id  ← delete transaction
router.route('/:id')
  .get(getTransactionById)
  .put(upload.single('attachment'), updateTransaction)
  .delete(deleteTransaction);

export default router;