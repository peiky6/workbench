#!/usr/bin/env node
/**
 * 祈·自律工作台 —— Supabase 同步小工具（本地命令行版）
 *
 * 用途：把本地导出的备份 JSON 推送到 Supabase（首次同步 / 换设备上传），
 *       或从 Supabase 拉取最新数据到本地 JSON（再用 APP「⚙️设置→导入JSON」载入）。
 *
 * 前置（一次性，约 2 分钟）：
 *   1. 到 https://supabase.com 免费新建一个项目
 *   2. 项目 → SQL Editor → 执行建表 SQL：
 *        create table if not exists workbench_sync(id text primary key, data text, updated_at timestamptz default now());
 *        alter table workbench_sync enable row level security;
 *        create policy if not exists "pub" on workbench_sync for all using (true) with check (true);
 *   3. 项目 Settings → API 复制 Project URL 与 anon key
 *
 * 用法：
 *   推送： node supabase_setup.js push <URL> <ANON_KEY> <backup.json>
 *   拉取： node supabase_setup.js pull <URL> <ANON_KEY> <out.json>
 *
 * 说明：anon key 本就是设计给前端公开使用的，可放心用于此脚本；切勿使用 service_role key。
 */
const [,, action, url, key, file] = process.argv;

if (!action || !['push','pull'].includes(action) || !url || !key || !file) {
  console.log('用法：');
  console.log('  推送： node supabase_setup.js push <URL> <ANON_KEY> <backup.json>');
  console.log('  拉取： node supabase_setup.js pull  <URL> <ANON_KEY> <out.json>');
  process.exit(1);
}
const base = url.replace(/\/$/, '');
const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };

async function push() {
  const fs = require('fs');
  if (!fs.existsSync(file)) { console.error('❌ 找不到文件：', file); process.exit(1); }
  const data = fs.readFileSync(file, 'utf8');
  console.log('⬆️ 正在上传到 Supabase…');
  const res = await fetch(`${base}/rest/v1/workbench_sync`, {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([{ id: 'me', data, updated_at: new Date().toISOString() }])
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 404 || res.status === 406) {
      console.error('❌ 表不存在。请先在 Supabase SQL Editor 执行建表 SQL（见脚本顶部注释），再重试。');
    } else {
      console.error('❌ 上传失败：', res.status, t);
    }
    process.exit(1);
  }
  console.log('✅ 已上传，首次同步完成！');
}

async function pull() {
  console.log('⬇️ 正在从 Supabase 下载…');
  const res = await fetch(`${base}/rest/v1/workbench_sync?id=eq.me&select=data,updated_at`, { headers });
  if (!res.ok) { console.error('❌ 下载失败：', res.status, await res.text()); process.exit(1); }
  const rows = await res.json();
  if (!rows.length) { console.error('❌ 云端还没有数据，请先 push。'); process.exit(1); }
  require('fs').writeFileSync(file, rows[0].data, 'utf8');
  console.log('✅ 已保存到', file, '（在 APP 设置→导入 JSON 载入即可）');
}

(action === 'push' ? push() : pull()).catch(e => { console.error('💥 出错：', e.message); process.exit(1); });
