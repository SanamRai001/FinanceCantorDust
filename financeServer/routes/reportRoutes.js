import express from 'express';
import {
  getLedger,
  getProfitLoss,
  getVATSummary
} from '../controllers/reportController.js';

const router = express.Router();

// GET /api/reports/ledger    ← ledger with running balance
//     supports: ?from= &to= &type= &party= &keyword= &payment_method=
router.get('/ledger', getLedger);

// GET /api/reports/pl        ← profit and loss
//     supports: ?from= &to=
router.get('/pl', getProfitLoss);

// GET /api/reports/vat       ← VAT summary
//     supports: ?from= &to=
router.get('/vat', getVATSummary);

export default router;