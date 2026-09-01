const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'swu_office.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT DEFAULT '', total INTEGER DEFAULT 0, available INTEGER DEFAULT 0,
      location TEXT DEFAULT '', status TEXT DEFAULT '\u53ef\u501f\u7528',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT NOT NULL,
      material_id INTEGER NOT NULL, material_name TEXT NOT NULL,
      borrow_num INTEGER NOT NULL, borrow_time TEXT NOT NULL,
      purpose TEXT DEFAULT '', borrow_note TEXT DEFAULT '',
      admin_comment TEXT DEFAULT '', return_note TEXT DEFAULT '',
      return_time TEXT DEFAULT '-', status TEXT DEFAULT '未归还',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (material_id) REFERENCES materials(id)
    );
    CREATE TABLE IF NOT EXISTS duty_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, weekday TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL, duty_person TEXT NOT NULL,
      location TEXT DEFAULT '908办公室', status TEXT DEFAULT '正常',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_name TEXT NOT NULL,
      duty_id INTEGER NOT NULL, checkin_time TEXT NOT NULL,
      status TEXT DEFAULT '\u5df2\u6253\u5361',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (duty_id) REFERENCES duty_schedules(id)
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      role_name TEXT DEFAULT '工作人员',
      department TEXT DEFAULT '',
      bind_code TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      status TEXT DEFAULT '正常',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      openid TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      expires_at TEXT DEFAULT (datetime('now','localtime','+7 days'))
    );
    CREATE TABLE IF NOT EXISTS bind_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'staff',
      role_name TEXT DEFAULT '\u5de5\u4f5c\u4eba\u5458',
      department TEXT DEFAULT '',
      used INTEGER DEFAULT 0,
      used_by_openid TEXT DEFAULT '',
      reusable INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      used_at TEXT DEFAULT ''
    );
  `);
}

function seedData() {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM materials').get();
  if (count.cnt > 0) return;
  const im = db.prepare('INSERT INTO materials (code,name,category,total,available,location) VALUES (?,?,?,?,?,?)');
  const id = db.prepare('INSERT INTO duty_schedules (date,weekday,start_time,end_time,duty_person) VALUES (?,?,?,?,?)');
  const t = db.transaction(() => {
    im.run('SWU-908-MIC-001','\u65e0\u7ebf\u8bdd\u7b52','\u97f3\u9891\u8bbe\u5907',5,3,'908\u4e3b\u67dc\u7b2c2\u5c42');
    im.run('SWU-908-SPK-001','\u4fbf\u643a\u97f3\u54cd','\u97f3\u9891\u8bbe\u5907',2,2,'908\u4e3b\u67dc\u7b2c1\u5c42');
    im.run('SWU-908-SIN-001','\u6d3b\u52a8\u684c\u724c','\u5ba3\u4f20\u7269\u6599',20,20,'908\u62bd\u5c49A');
    im.run('SWU-908-CAB-001','\u97f3\u9891\u8fde\u63a5\u7ebf','\u7ebf\u6750\u8017\u6750',8,8,'908\u62bd\u5c49B');
    im.run('SWU-908-RCK-001','\u6613\u62c9\u5b9d\u5c55\u67b6','\u5ba3\u4f20\u7269\u6599',4,4,'908\u5899\u89d2');
    id.run('2026-07-06','\u5468\u4e00','14:00','17:00','\u5f20\u4e09');
    id.run('2026-07-07','\u5468\u4e8c','14:00','17:00','\u674e\u56db');
    id.run('2026-07-08','\u5468\u4e09','09:00','12:00','\u738b\u4e94');
    id.run('2026-07-09','\u5468\u56db','14:00','17:00','\u8d75\u516d');
    id.run('2026-07-10','\u5468\u4e94','14:00','17:00','\u5f20\u4e09');
  });
  t();
  console.log('[DB] \u79cd\u5b50\u6570\u636e\u521d\u59cb\u5316\u5b8c\u6210');
}

// 初始化绑定码
function seedBindCodes() {
  // 绑定码不再硬编码默认值，仅当通过环境变量显式配置时创建对应角色的绑定码
  const count = db.prepare('SELECT COUNT(*) as cnt FROM bind_codes').get();
  if (count.cnt > 0) return;
  const ins = db.prepare('INSERT INTO bind_codes (code, name, role, role_name, department, reusable) VALUES (?,?,?,?,?,?)');
  const presets = [
    { envKey: 'ADMIN_BIND_CODE', name: '示例管理员', role: 'admin', roleName: '管理员', department: '学生会办公室', reusable: 0 },
    { envKey: 'STAFF_BIND_CODE', name: '示例工作人员', role: 'staff', roleName: '工作人员', department: '学生会办公室', reusable: 1 },
    { envKey: 'REVIEW_BIND_CODE', name: '示例审核人员', role: 'reviewer', roleName: '审核体验用户', department: '审核体验', reusable: 1 }
  ];
  let created = 0;
  const t = db.transaction(() => {
    presets.forEach(function (p) {
      const code = process.env[p.envKey] || '';
      if (!code) {
        console.log('[DB] ' + p.envKey + ' 未配置，跳过种子创建');
        return;
      }
      ins.run(code, p.name, p.role, p.roleName, p.department, p.reusable);
      created++;
    });
  });
  t();
  console.log('[DB] 绑定码种子初始化完成（共 ' + created + ' 个）');
}

module.exports = { db, initDatabase, seedData, seedBindCodes };

