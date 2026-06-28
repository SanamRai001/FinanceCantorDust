import express from 'express';
import { exportToTally } from '../controllers/exportController.js';
import protect from '../middleware/auth.js';
import allow   from '../middleware/role.js';

const router = express.Router();

// GET /api/export/tally
// supports: ?from= &to= &unexported_only=true
router.get('/tally', protect, allow('admin'), exportToTally);
export default router;