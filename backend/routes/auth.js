const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const https = require('https');
const { db } = require('../db');

// ---- config ----
let WECHAT_APPID = process.env.WECHAT_APPID || '';
let WECHAT_SECRET = process.env.WECHAT_SECRET || '';

if (!WECHAT_APPID || !WECHAT_SECRET) {
  try {
    const fs = require('fs'), path = require('path');
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const m = line.match(/^([A-Z_]+)=(.+)$/);
        if (m) {
          if (m[1] === 'WECHAT_APPID') WECHAT_APPID = m[2].trim();
          if (m[1] === 'WECHAT_SECRET') WECHAT_SECRET = m[2].trim();
        }
      }
    }
  } catch(e) { console.error('[auth] .env read error:', e.message); }
}

console.log('[auth] APPID:', WECHAT_APPID || 'NOT SET');
console.log('[auth] SECRET:', WECHAT_SECRET ? '***ok***' : 'NOT SET');

// ---- admin whitelist ----
// 通过环境变量 ADMIN_OPENIDS 配置，逗号分隔多个 OpenID；未配置时无管理员
const ADMIN_OPENIDS = (process.env.ADMIN_OPENIDS || '')
  .split(',')
  .map(function (s) { return s.trim(); })
  .filter(Boolean);

// ---- token utils ----
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(openid) {
  const token = generateToken();
  db.prepare(
    "INSERT INTO sessions (token, openid, created_at, expires_at) VALUES (?, ?, datetime('now','localtime'), datetime('now','localtime','+7 days'))"
  ).run(token, openid);
  return token;
}

function getUserByToken(token) {
  if (!token) return null;
  const session = db.prepare(
    "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now','localtime')"
  ).get(token);
  if (!session) return null;
  return db.prepare("SELECT * FROM users WHERE openid = ? AND status != 'disabled'").get(session.openid);
}

function cleanExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now','localtime')").run();
}

// ---- token auth middleware ----
router.use('/me', function(req, res, next) {
  cleanExpiredSessions();
  next();
});
router.use('/users', function(req, res, next) {
  cleanExpiredSessions();
  next();
});

// ---- code2Session ----
function code2Session(code) {
  return new Promise((resolve, reject) => {
    if (!WECHAT_APPID || !WECHAT_SECRET)
      return reject(new Error('AppID/AppSecret not configured'));
    const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + WECHAT_APPID +
      '&secret=' + WECHAT_SECRET + '&js_code=' + encodeURIComponent(code) + '&grant_type=authorization_code';
    https.get(url, (resp) => {
      let data = '';
      resp.on('data', c => data += c);
      resp.on('end', () => {
        try {
          const r = JSON.parse(data);
          if (r.errcode) return reject(new Error((r.errmsg || r.errcode || 'wechat error') + ''));
          resolve(r);
        } catch(e) { reject(new Error('parse wechat response failed')); }
      });
    }).on('error', e => reject(new Error('wechat request failed')));
  });
}

// ======== POST /api/auth/wechat-login ========
router.post('/wechat-login', function(req, res) {
  try {
    const code = (req.body || {}).code;
    const name = (req.body || {}).name || '';

    if (!code) return res.status(400).json({ code: 1, message: 'missing code' });

    code2Session(code).then(function(wxData) {
      const openid = wxData.openid;
      if (!openid) return res.status(500).json({ code: 1, message: 'cannot get openid' });

      console.log('[auth] WeChat user login success');

      // check admin whitelist
      const isAdmin = ADMIN_OPENIDS.indexOf(openid) !== -1;

      // check existing user
      let user = db.prepare('SELECT * FROM users WHERE openid = ?').get(openid);

      if (user) {
        // update admin whitelist users
        if (isAdmin && user.role !== 'admin') {
          db.prepare("UPDATE users SET role='admin', status='active', updated_at=datetime('now','localtime') WHERE id=?").run(user.id);
          user.role = 'admin';
          user.status = 'active';
        }
        if (name && !user.name) {
          db.prepare("UPDATE users SET name=?, updated_at=datetime('now','localtime') WHERE id=?").run(name, user.id);
          user.name = name;
        }

        if (user.status === 'active') {
          const token = createSession(openid);
          return res.json({
            code: 0, message: 'login ok',
            data: { token, user: { id: user.id, name: user.name, role: user.role, status: user.status, openid: openid } }
          });
        } else if (user.status === 'pending') {
          return res.status(403).json({ code: 1, message: 'account pending approval' });
        } else {
          return res.status(403).json({ code: 1, message: 'account disabled' });
        }
      }

      // new user
      const role = isAdmin ? 'admin' : 'staff';
      const status = isAdmin ? 'active' : 'pending';
      const displayName = name || 'wechat user';

      const result = db.prepare(
        "INSERT INTO users (openid, name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))"
      ).run(openid, displayName, role, status);

      if (isAdmin) {
        const token = createSession(openid);
        return res.json({
          code: 0, message: 'login ok (admin)',
          data: { token, user: { id: result.lastInsertRowid, name: displayName, role, status, openid } }
        });
      }

      return res.status(403).json({ code: 1, message: 'applied, waiting for admin approval' });
    }).catch(function(err) {
      console.error('[auth] code2Session error:', err.message);
      return res.status(500).json({ code: 1, message: err.message });
    });
  } catch(err) {
    console.error('[auth] exception:', err);
    res.status(500).json({ code: 1, message: 'server error' });
  }
});

// ======== GET /api/auth/me ========
router.get('/me', function(req, res) {
  try {
    const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') || req.headers['x-token'] || '';
    if (!token) return res.status(401).json({ code: 1, message: 'not logged in' });

    const user = getUserByToken(token);
    if (!user) return res.status(401).json({ code: 1, message: 'login expired' });

    return res.json({
      code: 0, message: 'ok',
      data: { id: user.id, name: user.name, role: user.role, status: user.status, openid: user.openid }
    });
  } catch(err) {
    console.error('[auth] me error:', err);
    res.status(500).json({ code: 1, message: 'server error' });
  }
});

module.exports = router;
module.exports.getUserByToken = getUserByToken;
