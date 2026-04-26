// middleware/authGuard.js — проверка JWT токена
const jwt = require('jsonwebtoken');

function authGuard(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: токен отсутствует' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: токен недействителен или истёк' });
  }
}

module.exports = authGuard;