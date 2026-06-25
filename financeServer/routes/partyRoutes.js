import express from 'express'
import {
  getParties,
  getSingleParty,
  createParty,
  deleteParty
} from '../controllers/partyController.js';

const router = express.Router();

// GET    /api/parties          ← get all parties (supports ?type= &keyword= &active=)
// POST   /api/parties          ← create a new party
router.route('/')
  .get(getParties)
  .post(createParty);

// GET    /api/parties/:id      ← get single party + transaction summary
// DELETE /api/parties/:id      ← soft delete if has transactions, hard delete if not
router.route('/:id')
  .get(getSingleParty)
  .delete(deleteParty);

export default router;
