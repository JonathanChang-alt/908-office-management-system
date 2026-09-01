const express = require('express');
const router = express.Router();
const { db } = require('../db');

// 日期规范化：接受 YYYY-M-D / YYYY.M.D / YYYY/M/D，统一补零为 YYYY-MM-DD；非法返回 null
function normalizeDate(input) {
  if (!input) return null;
  var s = String(input).trim();
  var m = s.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (!m) return null;
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  function p(x) { return x < 10 ? '0' + x : String(x); }
  return y + '-' + p(mo) + '-' + p(d);
}

// 管理员请求校验（只信任 token 认证注入的 req.user，杜绝 body 伪造）
function isAdminRequest(req) {
  return !!(req.user && req.user.role === 'admin');
};

// GET 全部（过滤已删除）
router.get('/', function (req, res) {
  try {
    const rows = db.prepare(
      "SELECT * FROM duty_schedules WHERE status IS NULL OR status != '已删除' ORDER BY date, start_time"
    ).all();
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    console.error('GET /duty error:', err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET 本周
router.get('/week', function (req, res) {
  try {
    const rows = db.prepare(
      "SELECT * FROM duty_schedules WHERE (status IS NULL OR status != '已删除') AND date >= date('now','localtime') AND date < date('now','localtime','+7 days') ORDER BY date, start_time"
    ).all();
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    console.error('GET /duty/week error:', err);
    try {
      const rows = db.prepare("SELECT * FROM duty_schedules WHERE status IS NULL OR status != '已删除' ORDER BY date, start_time").all();
      res.json({ code: 0, message: 'success', data: rows });
    } catch (e2) {
      res.status(500).json({ code: 1, message: e2.message });
    }
  }
});

// GET 统计
router.get('/stats/count', function (req, res) {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM duty_schedules WHERE (status IS NULL OR status != '已删除') AND date >= date('now','localtime')").get();
    res.json({ code: 0, message: 'success', data: { count: row ? row.count : 0 } });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// POST 新增
router.post('/', function (req, res) {
  try {
    const body = req.body || {};
    const date = body.date, weekday = body.weekday;
    const start_time = body.start_time || body.startTime || '';
    const end_time = body.end_time || body.endTime || '';
    const duty_person = body.duty_person || body.dutyPerson || '';
    const location = body.location || '908办公室';
    if (!date || !weekday || !start_time || !end_time || !duty_person) {
      return res.status(400).json({ code: 1, message: '请填写完整值班信息' });
    }
    // 日期规范化并严格校验，统一保存为 YYYY-MM-DD
    const normDate = normalizeDate(date);
    if (!normDate) {
      return res.status(400).json({ code: 1, message: '日期格式无效，请使用 YYYY-MM-DD' });
    }
    const result = db.prepare(
      "INSERT INTO duty_schedules (date, weekday, start_time, end_time, duty_person, location, status) VALUES (?, ?, ?, ?, ?, ?, '正常')"
    ).run(normDate, weekday, start_time, end_time, duty_person, location);
    res.json({ code: 0, message: '新增成功', data: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('POST /duty error:', err);
    res.status(500).json({ code: 1, message: '新增失败', error: err.message });
  }
});

// PUT 编辑
router.put('/:id', function (req, res) {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const date = body.date, weekday = body.weekday;
    const start_time = body.start_time || body.startTime || '';
    const end_time = body.end_time || body.endTime || '';
    const duty_person = body.duty_person || body.dutyPerson || '';
    const location = body.location || '908办公室';
    if (!id) return res.status(400).json({ code: 1, message: '值班ID无效' });
    if (!date || !weekday || !start_time || !end_time || !duty_person) {
      return res.status(400).json({ code: 1, message: '请填写完整值班信息' });
    }
    // 日期规范化并严格校验，统一保存为 YYYY-MM-DD
    const normDate = normalizeDate(date);
    if (!normDate) {
      return res.status(400).json({ code: 1, message: '日期格式无效，请使用 YYYY-MM-DD' });
    }
    const result = db.prepare(
      'UPDATE duty_schedules SET date = ?, weekday = ?, start_time = ?, end_time = ?, duty_person = ?, location = ? WHERE id = ?'
    ).run(normDate, weekday, start_time, end_time, duty_person, location, id);
    if (result.changes === 0) return res.status(404).json({ code: 1, message: '值班安排不存在' });
    res.json({ code: 0, message: '更新成功' });
  } catch (err) {
    console.error('PUT /duty/:id error:', err);
    res.status(500).json({ code: 1, message: '更新失败', error: err.message });
  }
});

// DELETE 软删除（需管理员权限）
router.delete('/:id', function (req, res) {
  try {
    if (!isAdminRequest(req)) {
      return res.status(403).json({ code: 1, message: '无权限删除值班记录' });
    }
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ code: 1, message: '值班ID无效' });
    const result = db.prepare(
      "UPDATE duty_schedules SET status = '已删除' WHERE id = ?"
    ).run(id);
    if (result.changes === 0) return res.status(404).json({ code: 1, message: '值班安排不存在' });
    res.json({ code: 0, message: '删除成功' });
  } catch (err) {
    console.error('DELETE /duty/:id error:', err);
    res.status(500).json({ code: 1, message: '删除失败', error: err.message });
  }
});

module.exports = router;
