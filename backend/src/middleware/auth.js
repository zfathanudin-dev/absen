const jwt = require('jsonwebtoken');

function butuhLoginPekerja(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipe !== 'pekerja') throw new Error('bukan token pekerja');
    req.pekerja = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
}

function butuhLoginAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token tidak ada' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.tipe !== 'admin') throw new Error('bukan token admin');
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token tidak valid atau kedaluwarsa' });
  }
}

module.exports = { butuhLoginPekerja, butuhLoginAdmin };
