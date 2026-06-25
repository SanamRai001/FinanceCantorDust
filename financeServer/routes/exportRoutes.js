import express from 'express';
import { exportToTally } from '../controllers/exportController.js';

const router = express.Router();

// GET /api/export/tally
// supports: ?from= &to= &unexported_only=true
router.get('/tally', exportToTally);

export default router;