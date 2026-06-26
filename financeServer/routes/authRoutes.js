import express        from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import protect        from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register  ← create new user
router.post('/register', register);

// POST /api/auth/login     ← login and get token
router.post('/login', login);

// GET  /api/auth/me        ← get current user (protected)
router.get('/me', protect, getMe);

export default router;