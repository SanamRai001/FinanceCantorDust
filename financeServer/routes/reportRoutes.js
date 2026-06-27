import express from 'express';
import {
  getLedger,
  getProfitLoss,
  getVATSummary,
  getCategoryReport   // ADD
} from '../controllers/reportController.js';

const router = express.Router();

router.get('/ledger',   getLedger);
router.get('/pl',       getProfitLoss);
router.get('/vat',      getVATSummary);
router.get('/category', getCategoryReport);  // ADD

export default router;