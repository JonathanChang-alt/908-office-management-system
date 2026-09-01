const express = require('express');
const router = express.Router();
const { db } = require('../db');

router.get('/', function (req, res) {
  try {
    const includeDeleted = req.query.includeDeleted === '1';
    let rows;
    if (includeDeleted) {
      rows = db.prepare('SELECT * FROM materials ORDER BY id').all();
    } else {
      rows = db.prepare("SELECT * FROM materials WHERE status IS NULL OR status NOT IN ('停用', '已删除') ORDER BY id").all();
    }
    res.json({ code: 0, message: 'success', data: rows });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: err.message }); }
});

router.get('/:id', function (req, res) {
  try {
    const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ code: 1, message: '物资不存在' });
    res.json({ code: 0, message: 'success', data: row });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: err.message }); }
});

router.get('/stats/summary', function (req, res) {
  try {
    const count = db.prepare("SELECT COUNT(*) as materialCount, SUM(available) as totalAvailable FROM materials WHERE status != '停用'").get();
    res.json({ code: 0, message: 'success', data: count || { materialCount: 0, totalAvailable: 0 } });
  } catch (err) { res.status(500).json({ code: 1, message: err.message }); }
});

router.post('/', function (req, res) {
  try {
    const body = req.body || {};
    const code = body.code, name = body.name, category = body.category || '';
    const total = Number(body.total) || 0;
    let available = isNaN(Number(body.available)) ? total : Number(body.available);
    const location = body.location || '';
    const status = body.status || (available > 0 ? '可借用' : '已借完');
    // 数据一致性规则：不可借状态一律强制 available = 0
    if (['已借完', '损坏', '停用', '已删除'].indexOf(status) !== -1) {
      available = 0;
    }

    if (!code || !name) return res.status(400).json({ code: 1, message: '编号和名称不能为空' });

    // 编号唯一性校验
    const dupCode = db.prepare('SELECT id FROM materials WHERE code = ? LIMIT 1').get(code);
    if (dupCode) return res.status(400).json({ code: 1, message: '编号已存在，请使用其他编号' });

    const result = db.prepare(
      "INSERT INTO materials (code, name, category, total, available, location, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))"
    ).run(code, name, category, total, available, location, status);

    res.json({ code: 0, message: '新增成功', data: { id: result.lastInsertRowid } });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: '新增失败', error: err.message }); }
});

// PUT — 支持 status 字段编辑
router.put('/:id', function (req, res) {
  try {
    const id = Number(req.params.id);
    const body = req.body || {};
    const code = body.code, name = body.name, category = body.category || '';
    const total = Number(body.total);
    let available = Number(body.available);
    const location = body.location || '', status = body.status || '可借用';
    // 数据一致性规则：不可借状态无论前端传入什么 available，一律强制为 0
    if (['已借完', '损坏', '停用', '已删除'].indexOf(status) !== -1) {
      available = 0;
    }

    if (!id) return res.status(400).json({ code: 1, message: '物资ID无效' });
    if (!code || !name) return res.status(400).json({ code: 1, message: '编号和名称不能为空' });
    if (isNaN(total) || total <= 0) return res.status(400).json({ code: 1, message: '总量必须大于0' });
    if (isNaN(available) || available < 0) return res.status(400).json({ code: 1, message: '可借数量不能小于0' });
    if (available > total) return res.status(400).json({ code: 1, message: '可借数量不能大于总量' });

    // 编号冲突校验（排除自身）
    const dupCode = db.prepare('SELECT id FROM materials WHERE code = ? AND id != ? LIMIT 1').get(code, id);
    if (dupCode) return res.status(400).json({ code: 1, message: '编号已存在，请使用其他编号' });

    const result = db.prepare(
      "UPDATE materials SET code = ?, name = ?, category = ?, total = ?, available = ?, location = ?, status = ?, updated_at = datetime('now','localtime') WHERE id = ?"
    ).run(code, name, category, total, available, location, status, id);

    if (result.changes === 0) return res.status(404).json({ code: 1, message: '物资不存在' });
    res.json({ code: 0, message: '更新成功' });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: '更新失败', error: err.message }); }
});

router.delete('/:id', function (req, res) {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ code: 1, message: '物资ID无效' });
    const result = db.prepare("UPDATE materials SET status = '停用', available = 0, updated_at = datetime('now','localtime') WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ code: 1, message: '物资不存在' });
    res.json({ code: 0, message: '已停用' });
  } catch (err) { console.error(err); res.status(500).json({ code: 1, message: '停用失败', error: err.message }); }
});

module.exports = router;
