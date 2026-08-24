#!/usr/bin/env node
// 固化冒烟测试：抽取 index.html 与 sw.js 的 JS，做语法校验 + 关键函数/字符串存在性检查。
// 用法：node smoke.cjs   （不依赖任何第三方包，纯 Node 内置）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const swPath = path.join(root, 'sw.js');

let pass = 0, fail = 0;
function ok(name){ pass++; console.log('  ✅ ' + name); }
function bad(name, detail){ fail++; console.log('  ❌ ' + name + (detail ? '  →  ' + detail : '')); }

// 1) 抽取 index.html 的最后一个 <script> 块并语法校验
function checkScriptSyntax(label, filePath, extract){
  let js;
  try{
    const raw = fs.readFileSync(filePath, 'utf8');
    js = extract ? extract(raw) : raw;
  }catch(e){ bad(label + ' 读取', e.message); return null; }
  const tmp = path.join(root, '.smoke_tmp.js');
  try{ fs.writeFileSync(tmp, js); }catch(e){ bad(label + ' 写临时文件', e.message); return null; }
  try{
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    ok(label + ' 语法校验 (node --check)');
  }catch(e){
    const msg = (e.stderr || '').toString().split('\n')[0] || 'syntax error';
    bad(label + ' 语法校验', msg);
  }finally{
    try{ fs.unlinkSync(tmp); }catch(_){}
  }
  return js;
}

const htmlJs = checkScriptSyntax('index.html', htmlPath, (raw)=>{
  const m = raw.match(/<script>([\s\S]*?)<\/script>/g) || [];
  return m.length ? m[m.length-1].replace(/^<script>/, '').replace(/<\/script>$/, '') : '';
});
checkScriptSyntax('sw.js', swPath);

// 2) 关键函数 / 字符串存在性（防止重构误删）
const required = [
  ['renderHome', '首页渲染'],
  ['togglePlanSeq', '计划打卡'],
  ['togglePlanSkip', '计划跳过'],
  ['planCurrentSeq', '计划进度计算'],
  ['ieltsGoalHtml', '雅思目标露出'],
  ['weekGridHtml', '打卡周视图'],
  ['weightWeekRows', '体重周环比'],
  ['APP_VERSION', '版本常量'],
  ['showUpdateBar', 'SW 更新提示'],
  ['PLAN_ANS', '计划参考答案'],
  ['togglePlanCollapse', '计划收起/展开'],
  ['IELTS_MENU', '雅思菜单数据'],
  ['ieltsMenuPick', '雅思点菜'],
  ['showBarTip', '图表柱子点击数值'],
  ['historyByDate', '历史回顾'],
  ['monthlyReviewHtml', '月度复盘'],
  ['predictGoalDays', '目标达成日预测'],
  ['togglePlanCollapseAll', '计划全部收起'],
  ['planFocusTerm', '计划关联术语'],
  ['reminderBannerHtml', '每日提醒横幅'],
  ['bmrForW', 'BMR 联合趋势'],
  ['aiMarkMastered', '掌握状态 LWW'],
  ['isMastered', '掌握判定'],
  ['aiMasteredTs', '掌握时间戳'],
  ['aiMasteredDel', '掌握移除时间戳'],
  ['AI_REVIEW_TARGET', '复习刷卡目标遍数'],
  ['aiStudyCount', '刷卡遍数读取'],
  ['aiStudyTerm', '点已学习记一遍'],
  ['aiStudyUndo', '误点撤销一遍'],
  ['aiReadyCount', '刷满目标遍数统计'],
  ['aiReviewCycle', '复习周期迁移标记'],
  ['aiPass1', '首轮成绩存档'],
  ['aiExtEntries', '外部术语枚举'],
  ['allAiTerms', '内置+外部术语统一视图'],
  ['aiTermIdxList', '术语 idx 列表'],
  ['aiTermByIdx', '按 key 取术语'],
  ['aiSlugOf', '外部术语 slug 生成'],
  ['aiAddTerm', '添加外部术语'],
  ['aiToggleAddTerm', '添加表单开关'],
  ['aiAddTermFromForm', '添加表单提交'],
  ['jsKey', '渲染 key 引号'],
  ['ai-terms-feed.json', '自动化术语 feed 文件'],
  ['readingComplete', '阅读完成(发币/成就)'],
  ['readingCheckAch', '成就解锁检查'],
  ['readingCelebrate', '庆祝 overlay'],
  ['readingRandomCard', '随机金句卡池'],
  ['readingStreakWarningHtml', '断卡预警'],
  ['closeCelebrate', '关闭庆祝'],
  ['READ_ACH', '阅读成就表'],
  ['readGoal', '阅读目标设置'],
  ['readingFinished', '已读书架字段'],
  ['openBookProgress', '更新书籍进度'],
  ['saveBookProgress', '保存书籍进度'],
  ['readingFinishCelebrate', '完读庆祝'],
  ['readingFinishedHtml', '已读书架渲染'],
  ['readingNotesTimelineHtml', '读书卡片时间线'],
  ['readingNoteReview', '随机回顾3张'],
  ['readingWeekStats', '阅读周统计'],
  ['readingWeekGoal', '阅读下周小目标'],
  ['mergeReadingFinished', '已读书架合并'],
  ['pushFinished', '加入已读书架'],
  ['f1', '完读成就-开卷有成'],
  ['f5', '完读成就-博览群书'],
  ['已读书架', '已读书架文案'],
  ['随机回顾 3 张', '读书卡片回顾入口'],
];
if(htmlJs){
  for(const [token, desc] of required){
    if(htmlJs.includes(token)) ok('存在：' + token + '（' + desc + '）');
    else bad('缺失：' + token + '（' + desc + '）');
  }
}

// 3) sw.js 缓存版本应随部署递增（仅提示，不强制）
const swRaw = fs.readFileSync(swPath, 'utf8');
const cacheMatch = swRaw.match(/const CACHE\s*=\s*'([^']+)'/);
if(cacheMatch) ok('sw.js 缓存名 = ' + cacheMatch[1]); else bad('sw.js 缓存名未识别');

// 4) 每月统计页 + 月末提醒（2026-08-18 新增）
if(htmlJs){
  const monthlyTokens = [
    ['function renderMonthly', '每月统计页渲染函数'],
    ['function ensurePageBaseline', '页数快照函数'],
    ['function isLastDayOfMonth', '月末判断函数'],
    ['function monthReminderBanner', '月末提醒横幅'],
    ['__monthly', '导航新增每月统计入口'],
    ['每月统计', '每月统计导航文案'],
    ['听/说/读/写', '雅思按四技能统计'],
    ['readPages', '页数快照字段'],
    ['function openBatchTrain', '批量补训练弹窗'],
    ['function doBatchTrain', '批量补训练执行'],
    ['批量补训练达成', '训练卡批量补按钮'],
    ['function bookPagesMap', '每书页数快照'],
    ['bookStart', '每书月初页数快照'],
    ['bookEnd', '每书月末页数快照'],
    ['各书目', '每月统计按书展示页数'],
    ['function allFoods', '合并食物库(内置+自定义)'],
    ['function saveCustomFood', '自定义食物入库'],
    ['function addCustomFood', '自定义食物+热量添加'],
    ['customFoods', '自定义食物库字段'],
    ['自定义食物名', '三餐自定义食物输入行'],
    ['mini line sm', '套用按钮缩小样式'],
    ["replace(/'/g", 'jsKey 字符串key单引号转义'],
    ['f.qty&&f.qty!==1', '餐次行显示份量'],
    ['fe.qty=mt.qty', '三餐记录存份量'],
    ['function snapshotInputs', '输入保护-快照'],
    ['function restoreInputs', '输入保护-恢复'],
    ["raw[0]==='0'", '防吞小数点(05→0.5)'],
    ['function weekGridHtml', '打卡周视图渲染'],
    ['function weightWeekRows', '体重周环比'],
    ['训练打卡周视图', '训练周视图卡片'],
    ['雅思打卡周视图', '雅思周视图卡片'],
    ['体重周环比', '体重周环比卡片'],
    ['function renderNotes', '笔记问答视图渲染'],
    ['function qaAnswer', '问答自测反馈'],
    ['function qaBulk', '问答批量导入'],
    ['function qaDayList', '每日5条自测抽题'],
    ['笔记问答', '导航入口'],
    ['qaReveal', '显示答案按钮'],
    ['从云端同步', '空状态一键同步'],
    ['const BUILTIN_NOTES', '内置笔记数据(v43重做)'],
    ['function seedNotes', '内置数据自动载入'],
    ['function mdRender', '笔记Markdown渲染器(v50)'],
    ['md-body', '笔记阅读排版样式(v50)'],
    ['function toggleSidebar', '侧边栏收起/展开(v52)'],
    ['sb-collapsed', '侧边栏收起样式(v52)'],
    ['📊 学习统计', '笔记问答顶部统计激励卡(v54)'],
    ['连续自测', '统计-连续天数(v54)'],
  ];
  for(const [token, desc] of monthlyTokens){
    if(htmlJs.includes(token)) ok('存在：' + token + '（' + desc + '）');
    else bad('缺失：' + token + '（' + desc + '）');
  }
  const removedTokens = ['SUPABASE_SQL','supaBox','setSupaUrl','setSyncMethod','biliYs','state.bili','habitHeatmapHtml','热力图','hm-wrap','overallStreak','bestStreak','bili-btn','planVideoUrl','qaImport','qaToggleImport','qaImportFile','qaImportBox','🗂 全部问答']; 
  for(const token of removedTokens){
    if(htmlJs.includes(token)) bad('应已移除但仍存在：' + token + '（代码瘦身）');
    else ok('已移除：' + token);
  }
  const verMatch = htmlJs.match(/const APP_VERSION\s*=\s*'([^']+)'/);
  if(verMatch && verMatch[1]==='2026-08-21u') ok('APP_VERSION = 2026-08-21u');
  else bad('APP_VERSION 未更新为 2026-08-21j（当前 ' + (verMatch?verMatch[1]:'?') + '）');
  if(cacheMatch && cacheMatch[1]==='qi-workbench-v54') ok('SW 缓存名 = qi-workbench-v54');
  else bad('SW 缓存名未递增为 v43');
}

console.log('\n冒烟测试结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
