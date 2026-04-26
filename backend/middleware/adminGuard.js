// middleware/adminGuard.js — проверка роли администратора
function adminGuard(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: доступ только для администраторов' });
  }
  next();
}

module.exports = adminGuard;