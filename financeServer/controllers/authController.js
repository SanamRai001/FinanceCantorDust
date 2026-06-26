import jwt     from 'jsonwebtoken';
import User    from '../models/User.js';

// ── helper: generate token ────────────────
const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ── POST /api/auth/register ───────────────
export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        error:   'Email already registered'
      });
    }

    const user = await User.create({ name, email, password, role });

    res.status(201).json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id, user.role)
      }
    });

  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// ── POST /api/auth/login ──────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // check user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error:   'Invalid email or password'
      });
    }

    // check active
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error:   'Account is deactivated'
      });
    }

    // check password
    const match = await user.matchPassword(password);
    if (!match) {
      return res.status(401).json({
        success: false,
        error:   'Invalid email or password'
      });
    }

    res.json({
      success: true,
      data: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
        token: generateToken(user._id, user.role)
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ── GET /api/auth/me ──────────────────────
// returns current logged in user from token
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};