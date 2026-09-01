const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// ---- 加载环境变量 ----
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
    console.log('[server] .env loaded');
  }
} catch (e) {
  console.log('[server] .env not loaded:', e.message);
}

// ---- Token 认证中间件（提取用户信息注入到 req.user）----
const { db } = require('./db');
app.use('/api', function (req, res, next) {
  const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') ||
    req.headers['x-token'] || '';
  if (token) {
    try {
      // 清理过期 session
      db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now','localtime')").run();
      const session = db.prepare(
        "SELECT * FROM sessions WHERE token = ? AND expires_at > datetime('now','localtime')"
      ).get(token);
      if (session) {
        const user = db.prepare("SELECT * FROM users WHERE openid = ? AND status = 'active'").get(session.openid);
        if (user) {
          req.user = user;
        }
      }
    } catch (e) {
      // ignore token parse error
    }
  }
  // ---- 全局鉴权：除公开接口外一律要求已登录（active）----
  var isPublic = (req.method === 'OPTIONS') ||
    (req.path === '/health' && req.method === 'GET') ||
    (req.path === '/auth/wechat-login' && req.method === 'POST');
  if (!isPublic && !req.user) {
    return res.status(401).json({ code: 1, message: 'not logged in' });
  }
  // ---- 管理员专属操作（后端强制）----
  var adminOnly =
    (req.path.indexOf('/materials') === 0 && ['POST', 'PUT', 'DELETE'].indexOf(req.method) !== -1) ||
    (req.path.indexOf('/duty') === 0 && ['POST', 'PUT', 'DELETE'].indexOf(req.method) !== -1) ||
    (req.path.indexOf('/checkin') === 0 && req.method === 'DELETE') ||
    (req.path.indexOf('/borrow') === 0 && req.method === 'PATCH');
  if (adminOnly && (!req.user || req.user.role !== 'admin')) {
    return res.status(403).json({ code: 1, message: 'admin only' });
  }
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'swu-backend is running' });
});

// 路由注册
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/borrow', require('./routes/borrow'));
app.use('/api/duty', require('./routes/duty'));
app.use('/api/checkin', require('./routes/checkin'));

// 根路径
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: '\u5b66\u751f\u4f1a\u529e\u516c\u5ba4\u7269\u8d44\u4e0e\u503c\u73ed\u7ba1\u7406\u7cfb\u7edf\u540e\u7aef\u670d\u52a1' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '\u63a5\u53e3\u4e0d\u5b58\u5728', path: req.path });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('SWU backend server running at http://127.0.0.1:' + PORT);
});