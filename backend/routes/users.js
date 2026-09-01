const express = require('express');
const router = express.Router();
const { db } = require('../db');

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now','localtime')"
  ).get(token);
  if (!session) return null;
  return db.prepare("SELECT * FROM users WHERE openid = ? AND status != 'disabled'").get(session.openid);
}

function requireAdmin(req, res, next) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || '';
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ code: 1, message: 'not logged in' });
  if (user.role !== 'admin') return res.status(403).json({ code: 1, message: 'admin only' });
  if (user.status !== 'active') return res.status(403).json({ code: 1, message: 'account inactive' });
  req.currentUser = user;
  next();
}

// GET /api/users
router.get('/', requireAdmin, function(req, res) {
  try {
    const users = db.prepare("SELECT id, openid, name, role, status, phone, created_at FROM users ORDER BY id").all();
    res.json({ code: 0, message: 'ok', data: users });
  } catch(err) {
    res.status(500).json({ code: 1, message: 'server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', requireAdmin, function(req, res) {
  try {
    const id = parseInt(req.params.id);
    const body = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ code: 1, message: 'user not found' });

    const newName = body.name !== undefined ? body.name : user.name;
    const newRole = body.role !== undefined ? body.role : user.role;
    const newStatus = body.status !== undefined ? body.status : user.status;

    db.prepare(
      "UPDATE users SET name = ?, role = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(newName, newRole, newStatus, id);

    const updated = db.prepare('SELECT id, openid, name, role, status, phone, created_at FROM users WHERE id = ?').get(id);
    res.json({ code: 0, message: 'ok', data: updated });
  } catch(err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

module.exports = router;
