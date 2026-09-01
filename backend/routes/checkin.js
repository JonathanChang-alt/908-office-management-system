const express = require('express');
const router = express.Router();
const { db } = require('../db');

// 检查是否管理员请求（只信任 token 认证注入的 req.user，杜绝 body 伪造）
function isAdminRequest(req) {
  return !!(req.user && req.user.role === 'admin');
}


// GET 全部打卡记录
router.get('/', function (req, res) {
  try {
    // 过滤掉已删除记录
    const rows = db.prepare(
      'SELECT c.*, d.date, d.weekday, d.start_time, d.end_time, d.location FROM checkins c LEFT JOIN duty_schedules d ON c.duty_id = d.id WHERE c.status != \'已删除\' ORDER BY c.id DESC'
    ).all();
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) {
    console.error('GET /checkin error:', err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

// POST 打卡（兼容 camelCase）
router.post('/', function (req, res) {
  try {
    const body = req.body || {};
    const dutyId = Number(body.duty_id || body.dutyId || 0);
    const userName = String(body.user_name || body.userName || '').trim();

    if (!dutyId) return res.status(400).json({ code: 1, message: '值班ID无效' });
    if (!userName) return res.status(400).json({ code: 1, message: '打卡人姓名不能为空' });

    // 检查值班是否存在
    const duty = db.prepare('SELECT * FROM duty_schedules WHERE id = ? AND status != \'已删除\'').get(dutyId);
    if (!duty) return res.status(404).json({ code: 1, message: '值班安排不存在' });

    // 检查是否重复打卡
    const existed = db.prepare('SELECT * FROM checkins WHERE duty_id = ? AND user_name = ? AND status != \'已删除\'').get(dutyId, userName);
    if (existed) return res.status(400).json({ code: 1, message: '请勿重复打卡' });

    // 校验打卡人必须与值班安排的值班人员一致
    if (userName !== duty.duty_person) {
      return res.status(400).json({ code: 1, message: '打卡人不是该值班安排的值班人员' });
    }

    // 插入打卡记录
    const result = db.prepare(
      "INSERT INTO checkins (duty_id, user_name, checkin_time, status) VALUES (?, ?, datetime('now','localtime'), '已打卡')"
    ).run(dutyId, userName);

    res.json({ code: 0, message: '打卡成功', data: { id: result.lastInsertRowid } });
  } catch (err) {
    console.error('POST /checkin error:', err);
    res.status(500).json({ code: 1, message: '打卡失败', error: err.message });
  }
});

// DELETE 删除打卡记录（软删除，仅管理员）
router.delete('/:id', function (req, res) {
  try {
    // 管理员权限检查
    if (!isAdminRequest(req)) {
      return res.status(403).json({ code: 1, message: '无权限删除打卡记录' });
    }
    
    const checkinId = Number(req.params.id);
    if (!checkinId) return res.status(400).json({ code: 1, message: '打卡ID无效' });

    // 检查记录是否存在
    const existed = db.prepare('SELECT * FROM checkins WHERE id = ? AND status != \'已删除\'').get(checkinId);
    if (!existed) return res.status(404).json({ code: 1, message: '打卡记录不存在' });

    // 软删除：更新状态为 "已删除"
    const result = db.prepare(
      'UPDATE checkins SET status = \'已删除\' WHERE id = ?'
    ).run(checkinId);

    res.json({ code: 0, message: '删除成功', data: { changes: result.changes } });
  } catch (err) {
    console.error('DELETE /checkin/:id error:', err);
    res.status(500).json({ code: 1, message: '删除失败', error: err.message });
  }
});

// GET 打卡统计
router.get('/stats/count', function (req, res) {
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM checkins WHERE status != \'已删除\'').get();
    res.json({ code: 0, message: 'success', data: { count: row ? row.count : 0 } });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET 查重
router.get('/check/:dutyId/:userName', function (req, res) {
  try {
    const row = db.prepare('SELECT * FROM checkins WHERE duty_id = ? AND user_name = ? AND status != \'已删除\'').get(Number(req.params.dutyId), req.params.userName);
    res.json({ code: 0, message: 'success', data: { hasChecked: !!row } });
  } catch (err) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

module.exports = router;

