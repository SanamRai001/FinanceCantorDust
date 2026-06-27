import express from 'express';
import {
  getAccounts,
  getSingleAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountBalance,
  seedDefaultAccounts
} from '../controllers/accountController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

const router = express.Router();

// seed default chart of accounts — admin only, run once
router.post('/seed',    protect, allow('admin'), seedDefaultAccounts);

router.route('/')
  .get(protect, getAccounts)
  .post(protect, allow('admin'), createAccount);

router.route('/:id')
  .get(protect, getSingleAccount)
  .put(protect, allow('admin'), updateAccount)
  .delete(protect, allow('admin'), deleteAccount);

router.get('/:id/balance', protect, getAccountBalance);

export default router;