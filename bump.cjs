#!/usr/bin/env node
// 发布脚本：一条命令同步升 APP_VERSION 与 sw.js CACHE，校验静态文件清单，最后跑 smoke。
// 用法：node bump.cjs           升版本 + 自动补齐 FILES + 跑 smoke
//       node bump.cjs --check   只校验，不写任何文件（清单缺项时非零退出）
// 零依赖，仅用 Node 内置模块；不引入「版本须与 git 同步」的强校验。
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const indexPath = path.join(root, 'index.html');
const swPath = path.join(root, 'sw.js');
const checkOnly = process.argv.includes('--check');

function fail(msg){ console.error('❌ ' + msg); process.exit(1); }
function log(msg){ console.log('  ' + msg); }

const html = fs.readFileSync(indexPath, 'utf8');
const sw = fs.readFileSync(swPath, 'utf8');

const verM = html.match(/const APP_VERSION\s*=\s*'([^']+)'/);
const cacheM = sw.match(/const CACHE\s*=\s*'([^']+)'/);
const filesM = sw.match(/const FILES\s*=\s*\[([^\]]*)\]/);
if(!verM) fail('index.html 未找到 APP_VERSION');
if(!cacheM) fail('sw.js 未找到 CACHE');
if(!filesM) fail('sw.js 未找到 FILES');

const files = filesM[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);

// 运行时必须预缓存的静态文件：页面、内置数据、manifest、图标。
// 排除 sw.js 自身、*.cjs 脚本、文档、历史数据 .json（不是运行时依赖）。
const needed = fs.readdirSync(root).filter(f => {
  if(!fs.statSync(path.join(root, f)).isFile()) return false;
  return f === 'index.html' || f === 'data-notes.js' || f === 'manifest.webmanifest'
      || /^icon.*\.(png|svg)$/.test(f) || /\.html$/.test(f);
}).sort();

const missing = needed.filter(f => !files.includes(f));
const notOnDisk = files.filter(f => !fs.existsSync(path.join(root, f)));

function nextVersion(cur, today){
  const m = cur.match(/^(\d{4}-\d{2}-\d{2})([a-z]?)$/);
  if(!m) return today + 'a';
  if(m[1] !== today) return today + 'a';
  const c = m[2];
  if(!c) return m[1] + 'a';
  if(c === 'z') return today + 'a1';
  return m[1] + String.fromCharCode(c.charCodeAt(0) + 1);
}
function nextCache(cur){
  const m = cur.match(/^(.*?)(\d+)$/);
  return m ? m[1] + (parseInt(m[2], 10) + 1) : cur + '1';
}

const d = new Date();
const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const newVer = nextVersion(verM[1], today);
const newCache = nextCache(cacheM[1]);

console.log('APP_VERSION  ' + verM[1] + ' → ' + newVer);
console.log('CACHE        ' + cacheM[1] + ' → ' + newCache);
console.log('FILES        ' + files.length + ' 项 / 目录需 ' + needed.length + ' 项');
if(missing.length) log('清单缺项：' + missing.join(', '));
if(notOnDisk.length) log('清单中文件不存在：' + notOnDisk.join(', '));

if(checkOnly){
  console.log('--check：仅校验，未写入任何文件');
  if(missing.length || notOnDisk.length) fail('静态文件清单不完整');
  console.log('✅ 清单完整');
  process.exit(0);
}

const merged = files.concat(missing);
let newSw = sw.replace(/const CACHE\s*=\s*'[^']*'/, "const CACHE = '" + newCache + "'");
newSw = newSw.replace(/const FILES\s*=\s*\[[^\]]*\]/, "const FILES = [" + merged.map(f => "'" + f + "'").join(',') + "]");
const newHtml = html.replace(/const APP_VERSION\s*=\s*'[^']*'/, "const APP_VERSION = '" + newVer + "'");
if(newSw === sw && newHtml === html) fail('版本号/缓存名替换未生效');
fs.writeFileSync(indexPath, newHtml);
fs.writeFileSync(swPath, newSw);
log('已写入 index.html / sw.js' + (missing.length ? '（补入 ' + missing.join(', ') + '）' : ''));

let out = '';
try{
  out = execFileSync(process.execPath, [path.join(root, 'smoke.cjs')], {cwd: root, encoding: 'utf8'});
}catch(e){
  const t = ((e.stdout || '') + (e.stderr || '')).trim().split('\n');
  console.log(t.slice(-15).join('\n'));
  fail('smoke 未通过（改动已写入，请修复后重跑 node smoke.cjs）');
}
console.log(out.trim().split('\n').slice(-2).join('\n'));
console.log('✅ 完成：' + newVer + ' / ' + newCache);
