const RoleValidation = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Role not allowed' });
    }
    next();
  };
};

module.exports = RoleValidation;
