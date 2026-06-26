const allow = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error:   `Access denied — ${req.user.role} cannot perform this action`
      });
    }
    next();
  };
};

export default allow;