// 数据库初始化脚本（GitHub 发布版）
// 用法: npm run init-db
// 说明: 可重复执行——仅创建缺失的表，不为非空表重复写入种子数据，
//       不会覆盖已有业务数据；绑定码仅在通过环境变量显式配置时创建。

// ---- 加载环境变量（与 server.js 相同方式）----
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim();
      }
    }
    console.log('[init-db] .env loaded');
  }
} catch (e) {
  console.log('[init-db] .env not loaded:', e.message);
}

const { initDatabase, seedData, seedBindCodes } = require('../db');

console.log('[init-db] 开始数据库初始化...');
initDatabase();
console.log('[init-db] 数据表创建完成');

seedData();
console.log('[init-db] demo 数据检查完成');

seedBindCodes();
console.log('[init-db] 绑定码种子检查完成');

console.log('[init-db] 初始化完成');
