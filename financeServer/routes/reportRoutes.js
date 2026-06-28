import express from 'express';
import {
  getLedger,
  getProfitLoss,
  getVATSummary,
  getCategoryReport,  // ADD
  getTrialBalance,
  getBalanceSheet,
  getAgingReport 
} from '../controllers/reportController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

const router = express.Router();

router.get('/ledger',   getLedger);
router.get('/vat',      getVATSummary);
router.get('/category', getCategoryReport);  // ADD
router.get('/pl',            protect, allow('admin'), getProfitLoss);
router.get('/trial-balance', protect, allow('admin'), getTrialBalance);
router.get('/balance-sheet', protect, allow('admin'), getBalanceSheet);
router.get('/aging',         protect, allow('admin'), getAgingReport);
export default router;