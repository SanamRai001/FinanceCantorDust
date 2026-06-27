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
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

// ── Multer config ─────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');  // files saved to uploads/ folder
  },
  filename: (req, file, cb) => {
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
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max still enforced
});

// ── Routes ────────────────────────────────────────────────────
const router = express.Router();

// GET    /api/transactions      ← get all (supports ?type= &party= &from= &to= &keyword= &payment_method=)
// POST   /api/transactions      ← create new (supports file upload)
// transactionRoutes.js
router.route('/')
  .get(protect, getTransactions)
  .post(protect, allow('admin', 'accountant'), upload.single('attachment'), createTransaction);

router.route('/:id')
  .get(protect, getTransactionById)
  .put(protect, allow('admin', 'accountant'), upload.single('attachment'), updateTransaction)
  .delete(protect, allow('admin'), deleteTransaction);
export default router;