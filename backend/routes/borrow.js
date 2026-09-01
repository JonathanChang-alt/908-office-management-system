const express = require('express');
const router = express.Router();
const { db } = require('../db');

function nowText() {
  // 使用服务器本地时间（CST），与数据库 datetime('now','localtime') 保持一致
  var n = new Date();
  function p(x) { return String(x).length < 2 ? '0' + x : String(x); }
  return n.getFullYear() + '-' + p(n.getMonth() + 1) + '-' + p(n.getDate()) + ' '
    + p(n.getHours()) + ':' + p(n.getMinutes()) + ':' + p(n.getSeconds());
}

// GET 全部借还记录
router.get('/', function (req, res) {
  try {
    const rows = db.prepare(
      'SELECT br.*, m.name AS material_name, m.code AS material_code FROM borrow_records br LEFT JOIN materials m ON br.material_id = m.id ORDER BY br.id DESC'
    ).all();
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: err.message }); }
});

// GET 未归还
router.get('/unreturned', function (req, res) {
  try {
    const rows = db.prepare(
      "SELECT br.*, m.name AS material_name FROM borrow_records br LEFT JOIN materials m ON br.material_id = m.id WHERE br.status = '未归还' ORDER BY br.id DESC"
    ).all();
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: err.message }); }
});

// GET 最近记录
router.get('/recent/:count', function (req, res) {
  try {
    const count = parseInt(req.params.count, 10) || 10;
    const rows = db.prepare(
      'SELECT br.*, m.name AS material_name FROM borrow_records br LEFT JOIN materials m ON br.material_id = m.id ORDER BY br.id DESC LIMIT ?'
    ).all(count);
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: err.message }); }
});

// GET 未归还统计
router.get('/stats/unreturned', function (req, res) {
  try {
    const row = db.prepare("SELECT COUNT(*) as count FROM borrow_records WHERE status = '未归还'").get();
    res.json({ code: 0, message: 'success', data: { count: row ? row.count : 0 } });
  } catch (err) { res.status(500).json({ code: 1, message: err.message }); }
});

// POST 借用（含状态校验+备注）
router.post('/borrow', function (req, res) {
  try {
    const body = req.body || {};
    const userName = body.user_name || body.userName || '';
    const materialId = Number(body.material_id || body.materialId || 0);
    const borrowNum = Number(body.borrow_num || body.borrowNum || 0);
    const purpose = body.purpose || '';
    const borrowNote = body.borrow_note || body.borrowNote || body.reason || '';

    if (!userName || !materialId || !borrowNum) return res.status(400).json({ code: 1, message: '参数不完整' });
    if (borrowNum <= 0) return res.status(400).json({ code: 1, message: '借用数量必须大于0' });

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId);
    if (!material) return res.status(404).json({ code: 1, message: '物资不存在' });
    if (material.status === '损坏') return res.status(400).json({ code: 1, message: '该物资已损坏，无法借用' });
    if (material.status === '已借完' || material.available <= 0) return res.status(400).json({ code: 1, message: '该物资已借完，无法借用' });
    if (material.available < borrowNum) return res.status(400).json({ code: 1, message: '库存不足' });

    const time = nowText();
    const insert = db.prepare(
      "INSERT INTO borrow_records (user_name, material_id, material_name, borrow_num, purpose, borrow_note, borrow_time, return_time, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', '未归还', ?)"
    );
    const updateMaterial = db.prepare(
      "UPDATE materials SET available = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    );

    const transaction = db.transaction(function () {
      const result = insert.run(userName, materialId, material.name, borrowNum, purpose, borrowNote, time, time);
      const newAvailable = material.available - borrowNum;
      const newStatus = newAvailable <= 0 ? '已借完' : (material.status === '损坏' ? '损坏' : '可借用');
      updateMaterial.run(newAvailable, newStatus, materialId);
      return { id: result.lastInsertRowid, newAvailable: newAvailable };
    });

    const data = transaction();
    res.json({ code: 0, message: '借用成功', data: data });
  } catch (err) {
    console.error('POST /borrow/borrow error:', err);
    res.status(500).json({ code: 1, message: '借用失败', error: err.message });
  }
});

// POST 归还（含备注）
router.post('/return/:id', function (req, res) {
  try {
    const recordId = Number(req.params.id);
    const body = req.body || {};
    const returnNote = body.return_note || body.returnNote || '';

    const record = db.prepare('SELECT * FROM borrow_records WHERE id = ?').get(recordId);
    if (!record) return res.status(404).json({ code: 1, message: '记录不存在' });
    if (record.status === '已归还') return res.status(400).json({ code: 1, message: '该记录已归还' });

    const material = db.prepare('SELECT * FROM materials WHERE id = ?').get(record.material_id);
    if (!material) return res.status(404).json({ code: 1, message: '对应物资不存在' });

    const time = nowText();
    const newAvailable = material.available + record.borrow_num;
    if (newAvailable > material.total) return res.status(400).json({ code: 1, message: '归还后库存超过总库存' });

    const updateRecord = db.prepare(
      "UPDATE borrow_records SET status = '已归还', return_time = ?, return_note = ? WHERE id = ?"
    );
    const updateMaterial = db.prepare(
      "UPDATE materials SET available = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    );

    db.transaction(function () {
      updateRecord.run(time, returnNote, recordId);
      const newStatus = material.status !== '损坏' ? (newAvailable > 0 ? '可借用' : '已借完') : '损坏';
      updateMaterial.run(newAvailable, newStatus, record.material_id);
    })();

    res.json({ code: 0, message: '归还成功', data: { id: recordId, newAvailable: newAvailable } });
  } catch (err) {
    console.error('POST /borrow/return error:', err);
    res.status(500).json({ code: 1, message: '归还失败', error: err.message });
  }
});

// PATCH 管理员批注
router.patch('/:id/comment', function (req, res) {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const comment = body.admin_comment || body.adminComment || '';

    if (!id) return res.status(400).json({ code: 1, message: '记录ID无效' });
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ code: 1, message: '仅管理员可批注' });

    const result = db.prepare('UPDATE borrow_records SET admin_comment = ? WHERE id = ?').run(comment, id);
    if (result.changes === 0) return res.status(404).json({ code: 1, message: '借还记录不存在' });
    res.json({ code: 0, message: '批注成功' });
  } catch (err) {
    console.error('PATCH /borrow/:id/comment error:', err);
    res.status(500).json({ code: 1, message: '批注失败', error: err.message });
  }
});

module.exports = router;
