import jwt  from 'jsonwebtoken';
import User from '../models/User.js';

const protect = async (req, res, next) => {
  try {
    // check if token exists in header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error:   'Not authorized — no token'
      });
    }

    // get token from header
    const token = authHeader.split(' ')[1];

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user to request — available as req.user in all protected routes
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error:   'Not authorized — user not found'
      });
    }

    if (!req.user.is_active) {
      return res.status(401).json({
        success: false,
        error:   'Not authorized — account deactivated'
      });
    }

    next();

  } catch (err) {
    return res.status(401).json({
      success: false,
      error:   'Not authorized — invalid token'
    });
  }
};

export default protect;