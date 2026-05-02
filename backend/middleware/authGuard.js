// middleware/authGuard.js — поддержка cookie И Bearer token
const jwt = require('jsonwebtoken');

function authGuard(req, res, next) {
  // Сначала пробуем Bearer token из заголовка
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    // Потом пробуем cookie
    token = req.cookies?.token;
  }

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
