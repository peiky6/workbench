#!/usr/bin/env node
// 固化冒烟测试：抽取 index.html 与 sw.js 的 JS，做语法校验 + 关键函数/字符串存在性检查。
// 用法：node smoke.cjs   （不依赖任何第三方包，纯 Node 内置）
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const htmlPath = path.join(root, 'index.html');
const swPath = path.join(root, 'sw.js');
const dataNotesPath = path.join(root, 'data-notes.js');

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
    const errText = ((e.stderr || '') + '').trim();
    if(!errText){
      // 环境原因（Windows 沙箱 spawn 偶发 EBUSY / 权限），不是代码语法问题 → 退回同进程编译校验
      try{ new (require('vm').Script)(js, {filename: label}); ok(label + ' 语法校验 (vm.Script 回退)'); }
      catch(ve){ bad(label + ' 语法校验', (ve.message || '').split('\n')[0]); }
    }else{
      bad(label + ' 语法校验', errText.split('\n')[0]);
    }
  }finally{
    try{ fs.unlinkSync(tmp); }catch(_){}
  }
  return js;
}

let htmlJs = checkScriptSyntax('index.html', htmlPath, (raw)=>{
  const m = raw.match(/<script>([\s\S]*?)<\/script>/g) || [];
  return m.length ? m[m.length-1].replace(/^<script>/, '').replace(/<\/script>$/, '') : '';
});
// 校验拆出的内置数据文件，并合并进 htmlJs 以便 token 检查
const dataNotesJs = checkScriptSyntax('data-notes.js', dataNotesPath, null);
if(dataNotesJs) htmlJs = htmlJs + '\n' + dataNotesJs;
checkScriptSyntax('sw.js', swPath);

// 2) 关键函数 / 字符串存在性（防止重构误删）
const required = [
  ['renderHome', '首页渲染'],
  ['todayChecklistItems', '待办清单数据（首页进度共用）'],
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
  ['function renderInterview', '求职面试渲染函数'],
  ['function openInterviewEditor', '面试编辑器'],
  ['function saveInterview', '面试保存'],
  ['ivMarkDone', '面试标记完成'],
  ['ivDelete', '面试删除'],
  ['interviewHomeCardHtml', '首页面试卡片'],
  ['state.interviews', '面试数据字段'],
  ['histOpen', 'IndexedDB 历史快照打开'],
  ['histTakeSnapshotIfToday', '每日自动快照'],
  ['histListSnapshots', '快照列表'],
  ['histCleanupOld', '快照自动清理'],
  ['renderSnapshotList', '快照面板渲染'],
  ['exportModuleCSV', '按模块导出 CSV'],
  ['downloadCSV', 'CSV 下载'],
  ['showCSVModal', 'CSV 模态框（手机兼容）'],
  ['copyCSV', 'CSV 复制按钮'],
  ['历史快照', '历史快照面板文案'],
  ['按模块导出', 'CSV 导出面板文案'],
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
    ['function toggleTrainSkip', '今日不训练标记'],
    ['trainSkip', '训练跳过字段(JS 内)'],
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
    ['function qaWeekList', '每周5条自测抽题(v2026-10-13 由每日改为每周)'],
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
    ['function allExercises', '合并运动库(自定义+内置)'],
    ['function saveCustomExercise', '自定义运动入库'],
    ['function addCustomExercise', '自定义运动+消耗热量添加'],
    ['customExercises', '自定义运动库字段'],
    ['自定义运动名', '运动自定义输入行'],
    ['ceKcal', '自定义运动消耗输入框'],
    ["e.min?(' · '+e.min+'分钟'):''", '自定义运动行省略时长'],
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
  if(verMatch && verMatch[1]==='2026-10-14b') ok('APP_VERSION = 2026-10-14b');
  else bad('APP_VERSION 未更新为 2026-10-14b（当前 ' + (verMatch?verMatch[1]:'?') + '）');
  // v2026-10-10b：M0/M5/M6 内置笔记改版（正文覆盖 + 问答去重追加，旧问答保留）
  try{
    const dn = JSON.parse(dataNotesJs.slice(dataNotesJs.indexOf('['), dataNotesJs.lastIndexOf(']') + 1));
    const targets = {
      '【AI学习笔记】M0 认知地基': [14, 'rerank'],
      '【AI学习笔记】M5 需求落地': [25, '图片提示词六件套'],
      '【AI学习笔记】M6 行业商机': [21, 'SLA']
    };
    for(const [t, [cnt, kw]] of Object.entries(targets)){
      const n = dn.find(x => x.title === t);
      if(!n){ bad('内置笔记缺失：' + t); continue; }
      if(n.v === '2026-10-10' && n.qa.length === cnt && n.content.includes(kw)) ok('内置笔记已升级：' + t + '（v' + n.v + ' · ' + n.qa.length + ' 问答）');
      else bad('内置笔记版本/问答数不符：' + t + '（v=' + n.v + ' qa=' + n.qa.length + '）');
    }
  }catch(e){ bad('data-notes.js 解析失败：' + e.message); }
  for(const [token, desc] of [['local.bv=nv', '内置笔记正文升级(v2026-10-10b)'], ['qi_notes_qa_bak_', '升级前问答备份(v2026-10-10b)']]){
    if(htmlJs.includes(token)) ok('存在：' + token + '（' + desc + '）');
    else bad('缺失：' + token + '（' + desc + '）');
  }
  // v2026-10-08a 同步修复：加密载体二进制化（ENC2）+ 紧凑 JSON + Gist 1MB 截断自愈覆盖 + 云端诊断行
  const syncTokens = [
    ["return 'ENC2:'+b64FromBytes(all)", '加密载体改为二进制 base64(ENC2)'],
    ["payload.startsWith('ENC2:')", 'decryptText 走 ENC2 分支'],
    ["const o=JSON.parse(atob(payload.slice(4)))", 'decryptText 兼容旧 ENC1 格式'],
    ['const json=JSON.stringify(clone);', '上传改为紧凑 JSON（不带缩进）'],
    ['function gistRawWithRetry', 'raw 直链重试'],
    ['_cloudBroken=true', '标记云端结构性损坏'],
    ['if(_cloudBroken && localHasData()) await forcePush(true)', '截断死锁自动自愈'],
    ['function forcePush', '覆盖云端的强制上传'],
    ['qi_workbench_preoverwrite', '覆盖前留回滚备份'],
    ["getElementById('btnForcePush')", '覆盖云端按钮绑定'],
    ["getElementById('syncDiag')", '诊断行渲染'],
    ["getElementById('btnPull').onclick=()=>pullData(false)", '下载按钮显式非静默（修复 onclick 传 Event 被当 silent）'],
    ["getElementById('btnPush').onclick=()=>pushData(false)", '上传按钮显式非静默'],
  ];
  for(const [token, desc] of syncTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  if(!/'\s*ENC:'\+btoa\(JSON\.stringify/.test(htmlJs)) ok('旧的 5 倍膨胀加密格式已移除');
  else bad('旧的 5 倍膨胀加密格式仍存在');
  if(!/JSON\.stringify\(clone,null,2\)/.test(htmlJs)) ok('上传已不再使用缩进序列化');
  else bad('上传仍使用缩进序列化（体积浪费）');
  // HTML 结构类检查（不在 <script> 内，需读整份 HTML）
  const htmlRaw = fs.readFileSync(htmlPath, 'utf8');
  for(const [token, desc] of [['id="btnForcePush"', '设置页「用本机数据覆盖云端」按钮'], ['id="syncDiag"', '同步区诊断行占位']]){
    if(htmlRaw.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc);
  }
  // 首页顶部进度必须取「今日待办清单」的完成情况，不能再按 ACTIVE_MODULES 计数
  const homeBody = htmlJs.match(/function renderHome\(\)\{[\s\S]*?\n\}/);
  if(homeBody && /todayChecklistItems\(\)/.test(homeBody[0]) && !/ACTIVE_MODULES\.filter\(m=>dayDone/.test(homeBody[0])) ok('首页进度取待办清单完成情况');
  else bad('首页进度口径未切换到 todayChecklistItems()');
  if(!/我的栏目/.test(htmlJs)) ok('首页已移除「我的栏目」');
  else bad('首页仍存在「我的栏目」');
  if(cacheMatch && cacheMatch[1]==='qi-workbench-v90') ok('SW 缓存名 = qi-workbench-v90');
  else bad('SW 缓存名未递增为 v90');
  // v2026-10-13a：笔记问答 + 雅思输出改「每周一次 · 必须有产出物」；雅思考试倒计时
  const weekTokens = [
    ['function weeklyTaskItems', '本周任务数据'],
    ['function weeklyTasksHtml', '本周任务卡片'],
    ['function ieltsWeekOutput', '本周雅思产出物统计'],
    ['function ieltsExamCountdownHtml', '雅思考试倒计时横幅'],
    ['function weekKeyOf', '周起始日计算'],
    ['function ymdToDate', '日期字符串转 Date'],
    ['function qaWeekList', '每周5条自测抽题'],
    ['qaWeekly', '按周锁定的自测字段'],
    ['📌 本周任务', '首页本周任务卡片标题'],
    ['WEEK_OUTPUT_HINT', '产出物说明常量'],
    ['out:1', '雅思菜单输出型标记'],
    ['x.out', '输出型判定（ieltsWeekOutput）'],
    ['距离雅思考试还有', '倒计时文案'],
    ['setIeltsExamDate', '设置页考试日期输入框(JS)'],
    ['ieltsExamDate', '考试日期字段'],
    ['本周问答自测（每周 5 条）', '笔记页改为周维度'],
    ['本周进度', '统计卡改为本周进度'],
    ['📤 本周输出', '雅思页本周输出区块'],
  ];
  for(const [token, desc] of weekTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  for(const token of ['function qaDayList']){
    if(htmlJs.includes(token)) bad('每日问答抽题应已改为每周但仍存在：' + token);
    else ok('已移除：' + token);
  }
  // 笔记问答必须从「每日待办」挪到「本周任务」，不能两处都出现
  const tciBody = htmlJs.match(/function todayChecklistItems\(\)\{[\s\S]*?\n\}/);
  if(tciBody && !/__notes/.test(tciBody[0])) ok('今日待办已不含笔记问答（移到本周任务）');
  else bad('今日待办仍含笔记问答条目');
  const wtiBody = htmlJs.match(/function weeklyTaskItems\(\)\{[\s\S]*?\n\}/);
  if(wtiBody && /__notes/.test(wtiBody[0]) && /ieltsWeekOutput\(\)/.test(wtiBody[0])) ok('本周任务含「笔记自测 + 雅思输出」两项');
  else bad('本周任务项不完整');
  const htmlRaw2 = fs.readFileSync(htmlPath, 'utf8');
  if(htmlRaw2.includes('id="setIeltsExamDate"')) ok('存在：设置页考试日期 input');
  else bad('缺失：设置页考试日期 input');
  // v2026-10-13b：新闻 / 阅读「一句话产出」（不强制，留白也记录；连续留白 ≥3 天首页提醒）
  const takeTokens = [
    ['const TAKEAWAY_ANGLES', 'PM 视角起手式常量'],
    ['const TAKEAWAY_KINDS', '新闻/阅读产出配置'],
    ['function takeawayHtml', '一句话产出输入卡'],
    ['function takeawayBlank', '「没想法」留白按钮'],
    ['function takeawayFill', '角度 chip 一键填入'],
    ['function takeawayClear', '清除已填产出'],
    ['function takeawayWeekStats', '近 7 天产出 / 留白统计'],
    ['function takeawayBlankStreak', '连续留白天数'],
    ['function takeawayBlankAlertHtml', '连续留白首页提醒'],
    ['💡 一句话产出', '产出卡标题'],
    ['takeawayHtml(\'news\')', '新闻页挂产出卡'],
    ['takeawayHtml(\'reading\')', '阅读页挂产出卡'],
    ['takeTs', '产出写入时间戳'],
  ];
  for(const [token, desc] of takeTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // 连续留白提醒必须挂在首页，且阈值 3 天
  const tbaBody = htmlJs.match(/function takeawayBlankAlertHtml\(\)\{[\s\S]*?\n\}/);
  if(tbaBody && /n<3/.test(tbaBody[0])) ok('连续留白提醒阈值为 3 天');
  else bad('连续留白提醒阈值不是 3 天');
  const homeBody2 = htmlJs.match(/function renderHome\(\)\{[\s\S]*?\n\}/);
  if(homeBody2 && /takeawayBlankAlertHtml\(\)/.test(homeBody2[0])) ok('首页已挂连续留白提醒');
  else bad('首页未挂连续留白提醒');
  if(!/takeawayHtml\('notes'\)/.test(htmlJs)) ok('产出卡只挂新闻/阅读两个输入源');
  else bad('产出卡挂到了非输入源');
  // v2026-10-14a：体重/能量「让漂移可见」（7日均体重 · 热量漂移预警 · 盈余直给 · 停滞先查摄入）
  const energyTokens = [
    ['const KCAL_PER_KG = 7700', '脂肪热量换算常量'],
    ['function kcalIntakeOf', '某日摄入热量'],
    ['function kcalExOf', '某日运动消耗'],
    ['function tdeeOf', 'TDEE 估算（BMR×系数+运动）'],
    ['function dayEnergy', '当日能量收支'],
    ['function energyAvg', '近 N 日均值'],
    ['function weightMA', '体重 N 日均值'],
    ['function kcalDrift', '热量漂移计算'],
    ['function kcalDriftHtml', '热量漂移预警横幅'],
    ['function weightEnergyCardHtml', '体重趋势与能量收支卡'],
    ['⚖️ 体重趋势与能量收支', '综合卡标题'],
    ['7 日均体重(kg)', '7 日均体重口径'],
    ['先查摄入，不要先加训练', '停滞时指向饮食而非训练'],
    ['weightEnergyCardHtml()', '体重页挂综合卡'],
  ];
  for(const [token, desc] of energyTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // v2026-10-14b：活动系数可校准（默认 1.40）+ 近 8 周摄入折线
  const actTokens = [
    ['const ACT_FACTOR_DEFAULT = 1.40', '活动系数默认值 1.40（骑车通勤+6000步）'],
    ['function actFactor(', '活动系数读取（设置优先，越界回落默认）'],
    ['function actFactorLabel(', '活动系数档位文案'],
    ['function kcalExAvg(', '近 N 日日均已记录运动消耗'],
    ['function maintenanceKcal(', '维持体重所需日均摄入'],
    ['function kcalWeeks(', '近 N 周周均摄入'],
    ['function kcalWeeksChart(', '8 周摄入折线图'],
    ['function kcalWeeksHtml(', '8 周摄入卡'],
    ['📈 近 8 周摄入', '8 周卡标题'],
    ['维持线 ${maint}', '维持线参考标注'],
    ['s.actFactor=(af>=1.1&&af<=2.0)? af : 1.40;', '设置保存写入活动系数'],
    ['actFactor:1.40', '默认设置含 actFactor'],
  ];
  for(const [token, desc] of actTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // HTML 属性（id="xxx"）不在 <script> 抽取内容里，必须查整份 HTML
  const htmlRaw3 = fs.readFileSync(htmlPath, 'utf8');
  if(htmlRaw3.includes('id="setActFactor"')) ok('存在：设置页活动系数下拉（HTML 属性）');
  else bad('缺失：设置页活动系数下拉 id="setActFactor"');
  if(/value="1\.40">1\.40 中低/.test(htmlRaw3)) ok('活动系数下拉含 1.40 推荐档');
  else bad('活动系数下拉缺少 1.40 推荐档');
  // tdeeOf 必须读可配置系数，不能再乘硬编码 ACT_FACTOR
  const tdeeBody = htmlJs.match(/function tdeeOf\(d\)\{[\s\S]*?\n\}/);
  if(tdeeBody && /\* actFactor\(\)/.test(tdeeBody[0])) ok('tdeeOf 使用可配置活动系数');
  else bad('tdeeOf 未使用可配置活动系数');
  if(!/\* ACT_FACTOR\)/.test(htmlJs)) ok('硬编码 ACT_FACTOR 乘法已移除');
  else bad('仍存在硬编码 ACT_FACTOR 乘法');
  const manaBody2 = htmlJs.match(/function renderMana\(\)\{[\s\S]*?\n\}/);
  if(manaBody2 && /kcalWeeksHtml\(\)/.test(manaBody2[0])) ok('体重页已挂 8 周摄入折线');
  else bad('体重页未挂 8 周摄入折线');
  // TDEE 口径必须改：旧代码 out = BMR + 运动（低估约 25%）
  if(/const out=tdeeOf\(today\(\)\)/.test(htmlJs)) ok('饮食区热量支出已改用 TDEE 口径');
  else bad('饮食区热量支出仍是旧的 BMR+运动 口径');
  if(!/const out=Math\.round\(bmr\(\)\)\+exTotal/.test(htmlJs)) ok('旧的 BMR+运动 口径已移除');
  else bad('旧的 BMR+运动 口径仍存在');
  // 漂移预警阈值 10%
  const driftBody = htmlJs.match(/function kcalDriftHtml\(\)\{[\s\S]*?\n\}/);
  if(driftBody && /Math\.abs\(d\.pct\)<10/.test(driftBody[0])) ok('热量漂移预警阈值为 ±10%');
  else bad('热量漂移预警阈值不是 ±10%');
  const homeBody3 = htmlJs.match(/function renderHome\(\)\{[\s\S]*?\n\}/);
  if(homeBody3 && /kcalDriftHtml\(\)/.test(homeBody3[0]) && /weightEnergyCardHtml\(\)/.test(homeBody3[0])) ok('首页已挂漂移预警 + 综合卡');
  else bad('首页未挂漂移预警或综合卡');
  const examRead = htmlJs.match(/s\.ieltsExamDate=\(document\.getElementById\('setIeltsExamDate'\)\.value\|\|''\)\.trim\(\);/);
  if(examRead) ok('设置保存时读取考试日期'); else bad('设置保存未读取考试日期');
}

console.log('\n冒烟测试结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
