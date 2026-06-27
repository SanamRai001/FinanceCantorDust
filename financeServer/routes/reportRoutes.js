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

const router = express.Router();

router.get('/ledger',   getLedger);
router.get('/pl',       getProfitLoss);
router.get('/vat',      getVATSummary);
router.get('/category', getCategoryReport);  // ADD
router.get('/trial-balance', getTrialBalance);
router.get('/balance-sheet', getBalanceSheet);
router.get('/aging', getAgingReport);  // ADD
export default router;