import express from 'express'
import {
  getParties,
  getSingleParty,
  createParty,
  deleteParty
} from '../controllers/partyController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

const router = express.Router();

router.route('/')
  .get(protect, getParties)
  .post(protect, allow('admin', 'accountant'), createParty);

router.route('/:id')
  .get(protect, getSingleParty)
  .delete(protect, allow('admin'), deleteParty);
export default router;
