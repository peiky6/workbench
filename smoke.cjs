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
  ['manaTrendSeries', '体重体脂统一取数'],
  ['APP_VERSION', '版本常量'],
  ['showUpdateBar', 'SW 更新提示'],
  ['PLAN_ANS', '计划参考答案'],
  ['togglePlanCollapse', '计划收起/展开'],
  ['IELTS_MENU', '雅思菜单数据'],
  ['ieltsMenuPick', '雅思点菜'],
  ['showBarTip', '图表柱子点击数值'],
  ['function homeReviewHtml', '首页数据速览'],
  ['function checkRate', '统一打卡率口径（首页 7 天 / 月报 30 天）'],
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
  ['function aiEnsureRoundBaseline', '轮次基线幂等'],
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
    ['function bodyFatSeries', '体脂序列取数'],
    ['训练打卡周视图', '训练周视图卡片'],
    ['雅思打卡周视图', '雅思周视图卡片'],
    ['📈 趋势分析', '趋势分析卡'],
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
  if(verMatch && /^20\d{2}-\d{2}-\d{2}[a-z]?$/.test(verMatch[1])) ok('APP_VERSION 合法: '+verMatch[1]);
  else bad('APP_VERSION 缺失或格式异常（当前 ' + (verMatch?verMatch[1]:'?') + '）');
  // v2026-11-03a：按「饮食指南&训练计划.md」更新体重管理模块
  if(htmlJs.includes('≈ 1760 kcal · 蛋白 101g')) ok('饮食指南已更新为工作日 1760kcal/101g 方案');
  else bad('饮食指南未更新为工作日 1760kcal/101g 方案');
  if(/TRAIN_PLAN[\s\S]*?坐姿弯举/.test(htmlJs)) ok('训练计划已按文档更新（含坐姿弯举等动作）');
  else bad('训练计划未包含文档动作（坐姿弯举缺失）');
  // v2026-10-10b / v2026-10-29a：内置笔记改版（正文覆盖 + 问答去重追加，旧问答保留）
  try{
    const dn = JSON.parse(dataNotesJs.slice(dataNotesJs.indexOf('['), dataNotesJs.lastIndexOf(']') + 1));
    const targets = {
      '【AI学习笔记】M0 认知地基': ['2026-10-10', 14, 'rerank'],
      '【AI学习笔记】M5 需求落地': ['2026-10-10', 25, '图片提示词六件套'],
      '【AI学习笔记】M6 行业商机': ['2026-10-10', 21, 'SLA'],
      '【AI学习笔记】20260902-AI笔记一页纸速记总表': ['2026-10-29', 43, '选型五步']
    };
    for(const [t, [v, cnt, kw]] of Object.entries(targets)){
      const n = dn.find(x => x.title === t);
      if(!n){ bad('内置笔记缺失：' + t); continue; }
      if(n.v === v && n.qa.length === cnt && n.content.includes(kw)) ok('内置笔记已升级：' + t + '（v' + n.v + ' · ' + n.qa.length + ' 问答）');
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
  // v2026-11-11a 阶段一：本地备份脱敏 + 真实下载（D1/D2/D3）
  const stage1Tokens = [
    ['function serializeBackup', '统一备份序列化（脱敏单一来源）'],
    ['function purgeSecrets', '剔除 PAT/口令'],
    ['function downloadBackup', '备份真实下载按钮逻辑'],
    ["id=\"btnDownloadBackup\"", '备份弹窗「下载文件」按钮（HTML 属性）'],
    ['delete clone.settings.gistToken', '备份剔除 GitHub Token'],
    ['delete clone.settings.encPass', '备份剔除加密口令'],
  ];
  for(const [token, desc] of stage1Tokens){
    if(htmlJs.includes(token) || htmlRaw.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  if(!/JSON\.stringify\(state,null,2\)/.test(htmlJs)) ok('本地备份已不再裸序列化整个 state（密钥不再泄露）');
  else bad('本地备份仍裸序列化整个 state（密钥泄露风险）');
  // v2026-11-12：AI 本轮遍数分层轮次（每轮每卡刷满 3 遍）+ 配置持久化 + 每日自测移除
  for(const [token, desc] of [
    ['aiRoundStudy:{}', '本轮遍数字段'],
    ['aiQueueTs:{}', '入队时间戳字段'],
    ['aiRoundBaselineV2:0', '轮次基线标记字段'],
    ['function aiEnsureRoundBaseline', '轮次基线幂等'],
    ['本轮已完成 ', '进度卡标题轮次+词数'],
    ['🏁 累计完成 ', '累计完成轮数文案'],
    ['答错排进优先复习，次日出现在今日卡片', '周测答错新文案'],
    ['function aiRoundCount', '本轮遍数读取'],
    ['function aiRoundLayer', '当前遍数层'],
    ['function aiRoundDone', '本轮完成判定'],
    ['function aiQueuePending', '插队未消解判定'],
    ['function aiAdvanceRound', '轮次推进'],
    ['function aiCheckRound', '轮次计数'],
    ['function aiTodayPicks', '每日抽卡'],
    ['function aiDayDone', '当日打卡判定'],
    ['aiReviewRound:0', '复习轮次默认字段'],
    ['复习今日 AI 术语', '首页待办复习文案'],
    ['id="gistRemembered"', '设置页「已记住」提示'],
    ['_def, _rem, _cur', 'mergeState 本机 settings 优先'],
    ["state.aiQueueTs[k]=Date.now()", 'feed 新词入队'],
    ["'aiRoundStudy','aiQueueTs','aiRoundBaselineV2'", 'mergeState 新字段登记'],
    ['全部词各刷满 3 遍', '轮次完成文案'],
  ]){
    if(htmlJs.includes(token) || htmlRaw.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // 反向锁：已删除的旧模式不得复活（残留键 aiDailyQuiz/aiDailyQuizDone 允许存在，但函数与控件必须清零）
  for(const [token, desc] of [
    ['function aiReviewActive', '持续复习模式判定'],
    ['function aiAllMastered', '全掌握判定'],
    ['function aiToggleKeepReview', '持续复习开关'],
    ['function aiToggleDailyQuiz', '每日自测开关'],
    ['function aiDailyQuizRender', '每日自测渲染'],
    ['function aiDailyQuizQuestions', '每日自测抽题'],
    ['function aiDailyQuizAnswer', '每日自测答题'],
    ['function aiDailyQuizReset', '每日自测重做'],
    ['function markTerm', '卡片掌握按钮'],
    ['aiKeepReview:true', '持续复习默认开配置'],
    ['📝 每日自测', '每日自测 chip'],
    ['🎯 持续复习', '持续复习 chip'],
    ['aiDailyQuizRender()', '每日自测渲染调用'],
    ['aiMasteredEver', '累计达成次数字段'],
    ['function aiReadyCount', '刷满目标遍数统计'],
    ['function aiRoundsTotal', '总刷卡遍数统计'],
    ['累计达成', '累计达成文案'],
    ['总刷卡遍数', '总刷卡遍数进度条'],
    ['刷满 ${AI_REVIEW_TARGET} 遍的词', '刷满3遍的词进度条'],
    ['首轮已学完', '首轮成绩展示'],
    ['下面按层级', '层级分布引导句'],
    ['答错会自动把该术语标记为未掌握', '周测旧答错文案'],
    ['已掌握 ${totalDone}', '标题静态已掌握比例'],
  ]){
    if(!htmlJs.includes(token) && !htmlRaw.includes(token)) ok('已移除：' + desc);
    else bad('残留：' + desc + '（token: ' + token + '）');
  }
  // 首页顶部进度必须取「今日待办清单」的完成情况，不能再按 ACTIVE_MODULES 计数
  const homeBody = htmlJs.match(/function renderHome\(\)\{[\s\S]*?\n\}/);
  if(homeBody && /todayChecklistItems\(\)/.test(homeBody[0]) && !/ACTIVE_MODULES\.filter\(m=>dayDone/.test(homeBody[0])) ok('首页进度取待办清单完成情况');
  else bad('首页进度口径未切换到 todayChecklistItems()');
  if(!/我的栏目/.test(htmlJs)) ok('首页已移除「我的栏目」');
  else bad('首页仍存在「我的栏目」');
  // SW 缓存名必须随部署递增；MIN_SW 为历史最低基线，升到更高版本时请同步调高，
  // 否则无法发现「忘了升缓存」。floor 检查可防止误设旧值/笔误，且部署无需再改本断言。
  const MIN_SW = 94;
  if(cacheMatch){
    const m = cacheMatch[1].match(/^qi-workbench-v(\d+)$/);
    if(m && parseInt(m[1],10) >= MIN_SW) ok('SW 缓存名合法且 ≥ v'+MIN_SW+': '+cacheMatch[1]);
    else bad('SW 缓存名异常或未递增: '+cacheMatch[1]);
  } else bad('SW 缓存名缺失');
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
    ["afSel.value=actFactor().toFixed(2)", '打开设置回填活动系数（补两位小数）'],
    ["if(afSel.selectedIndex<0) afSel.value='1.40'", '回填兜底：绝不留下空白下拉'],
    ['if(afRaw && af>=1.1 && af<=2.0) s.actFactor=af;', '设置保存写入活动系数（异常值保持不动）'],
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
  // v2026-10-14c：运动消耗可导出（原「训练打卡」表只有布尔值 + 过滤条件会丢掉未打卡但有运动的天）
  const exportTokens = [
    ["rows.push(['日期', '训练完成', '标记不训练', '运动明细', '运动消耗(kcal)'])", '训练打卡表补上运动明细与消耗'],
    ['if(!r.trainDone && !r.trainSkip && !exs.length) return;', '过滤条件放宽：有运动明细也算有效行'],
    ["} else if(mod === 'mana-exercise'){", '新增运动消耗明细导出分支'],
    ["rows.push(['日期', '运动项目', '时长(分钟)', 'MET', '消耗(kcal)', '当日合计(kcal)', '训练完成', '标记不训练'])", '明细表表头'],
    ["showCSVModal('exercise-' + td + '.csv'", '明细表文件名 exercise-*.csv'],
  ];
  for(const [token, desc] of exportTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // 回归锁：旧的三列表头 + 会把未打卡日整行丢弃的过滤条件，都不许回来
  if(!/rows\.push\(\['日期', '训练完成', '标记不训练'\]\);/.test(htmlJs)) ok('旧的三列训练表头已移除');
  else bad('旧的三列训练表头仍存在');
  if(!/if\(!r\.trainDone && !r\.trainSkip\) return;/.test(htmlJs)) ok('会丢弃未打卡日的旧过滤条件已移除');
  else bad('会丢弃未打卡日的旧过滤条件仍存在');
  // v2026-10-15a：产出池（写过的不再丢）+ 标签自由化（出口不预设为面试）
  const outTokens = [
    ['const OUTPUT_TAGS_BASE', '用途标签基础集（面试素材只是其一）'],
    ['function allOutTags(', '标签全集（预设 + 自定义去重）'],
    ['function addOutTagPrompt(', '自定义标签'],
    ['function migrateOutputs(', '历史产出迁移'],
    ['s.outputs = Array.isArray(s.outputs)', 'load 初始化 outputs'],
    ['migrateOutputs(s);', 'load 调用迁移'],
    ['function opId(', '产出 id 生成'],
    ['function outputsAll(', '产出池列表（时间倒序）'],
    ['function outputUpsert(', '产出写入/更新'],
    ['function outputRemove(', '产出删除'],
    ['function outputStats(', '产出统计'],
    ['function delOutput(', '单条删除'],
    ['function renderOutputs(', '我的产出页面'],
    ['function takeawayPick(', '顺手选标签'],
    ['__outputs\') renderOutputs()', 'render 分支'],
    ["view:'__outputs'", '侧栏入口'],
    ['remote.outputs||[]', '云同步合并产出池'],
    ['💡 我的产出', '产出页标题'],
    ['不会再被明天覆盖', '不再覆盖的提示文案'],
  ];
  for(const [token, desc] of outTokens){
    if(htmlJs.includes(token)) ok('存在：' + desc);
    else bad('缺失：' + desc + '（token: ' + token + '）');
  }
  // 关键回归锁：写想法必须同步进池，清除必须同步出池，否则两边不一致
  const setBody = htmlJs.match(/function setTakeaway\(kind,val\)\{[\s\S]*?\n\}/);
  if(setBody && /outputUpsert\(/.test(setBody[0])) ok('setTakeaway 已同步写入产出池');
  else bad('setTakeaway 未写入产出池');
  if(/function takeawayClear\(kind\)\{[^}]*outputRemove\(/.test(htmlJs)) ok('takeawayClear 已同步移出产出池');
  else bad('takeawayClear 未同步移出产出池');
  if(/function takeawayBlank\(kind\)\{[^}]*outputRemove\(/.test(htmlJs)) ok('takeawayBlank 已同步移出产出池');
  else bad('takeawayBlank 未同步移出产出池');
  // 标签 chip 必须渲染自定义标签，不能只剩原来 4 个 PM 角度
  if(/allOutTags\(\)\.map\(t=>/.test(htmlJs)) ok('标签 chip 渲染自定义标签全集');
  else bad('标签 chip 仍写死为固定角度');

  if(htmlRaw3.includes('<option value="mana-exercise">')) ok('设置页含运动消耗明细导出选项（HTML 属性）');
  else bad('设置页缺少 mana-exercise 导出选项');
  // v2026-10-14d 回归锁：活动系数下拉曾因 String(1.4)==="1.4" 匹配不上 option 的 "1.40"
  // 而被置成空白，且下次保存会被静默冲回 1.40。这两种写法都不许回来。
  if(!/setActFactor'\)\.value=String\(actFactor\(\)\)/.test(htmlJs)) ok('已移除会丢尾零的 String(actFactor()) 回填');
  else bad('会丢尾零的 String(actFactor()) 回填仍存在');
  if(!/s\.actFactor=\(af>=1\.1&&af<=2\.0\)\? af : 1\.40/.test(htmlJs)) ok('已移除会静默重置为默认的保存写法');
  else bad('会静默重置为默认的保存写法仍存在');
  // select 的 option value 必须都是两位小数，才能和 toFixed(2) 对上
  const optVals = [...htmlRaw3.matchAll(/<option value="(1\.\d+)">/g)].map(m=>m[1]);
  if(optVals.length===5 && optVals.every(v=>/^1\.\d{2}$/.test(v))) ok('活动系数 5 个 option value 均为两位小数');
  else bad('活动系数 option value 不是两位小数：' + JSON.stringify(optVals));
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
  if(homeBody3 && /kcalDriftHtml\(\)/.test(homeBody3[0]) && /homeReviewHtml\(\)/.test(homeBody3[0]) && !/weightEnergyCardHtml\(\)/.test(homeBody3[0])) ok('首页已挂漂移预警 + 数据速览（体重综合卡只在体重页）');
  else bad('首页未挂漂移预警 / 数据速览，或仍挂体重综合卡');
  const examRead = htmlJs.match(/s\.ieltsExamDate=\(document\.getElementById\('setIeltsExamDate'\)\.value\|\|''\)\.trim\(\);/);
  if(examRead) ok('设置保存时读取考试日期'); else bad('设置保存未读取考试日期');
}

// v2026-11-11b 行为级回归：真正执行 aiLearn()，捕获「语法校验 + 字符串断言抓不到」的运行时错误。
// 事故背景：aiLayerProgressHtml() 漏声明 all → ReferenceError → AI 模块点击后整块不渲染（白屏）。
// 维护提示：以下为最小化浏览器 API 桩；若日后顶层初始化新增 API 调用，需在此补桩。
(function runtimeChecks(){
  const vm = require('vm');
  const raw = fs.readFileSync(htmlPath, 'utf8');
  const blocks = raw.match(/<script>([\s\S]*?)<\/script>/g) || [];
  const appJs = blocks.length ? blocks[blocks.length-1].replace(/^<script>/,'').replace(/<\/script>$/,'') : '';
  if(!appJs){ bad('AI 视图运行时校验：未抽取到主脚本'); return; }
  const p0 = appJs.indexOf('function aiLayerProgressHtml()');
  const p1 = appJs.indexOf('function aiLearn()');
  const progBody = p0>=0 && p1>p0 ? appJs.slice(p0, p1) : '';
  if(/const all\s*=\s*aiTermIdxList\(\)/.test(progBody)) ok('aiLayerProgressHtml 已声明 all（防 ReferenceError 白屏回归）');
  else bad('aiLayerProgressHtml 缺少 all 声明（AI 视图会白屏）');
  const gen = t => new Proxy(t, {get:(o,k)=>k in o?o[k]:()=>undefined, set:(o,k,v)=>{o[k]=v;return true}});
  const mkEl = () => gen({
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    style:new Proxy({},{get:()=>'',set:()=>true}), dataset:{}, children:[], childNodes:[], options:[],
    value:'', innerHTML:'', textContent:'', checked:false,
    querySelectorAll:()=>[], querySelector:()=>mkEl(), getBoundingClientRect:()=>({top:0,left:0,width:0,height:0}),
    appendChild(){}, removeChild(){}, remove(){}, focus(){}, blur(){}, click(){}, setAttribute(){},
    getAttribute:()=>null, addEventListener(){}, removeEventListener(){}, insertAdjacentHTML(){},
    closest:()=>null, contains:()=>false, scrollIntoView(){}, cloneNode:()=>mkEl()
  });
  const store = {};
  const Notif = Object.assign(function(){}, {permission:'default', requestPermission:()=>Promise.resolve('default')});
  const win = {
    document: gen({getElementById:()=>mkEl(), querySelector:()=>mkEl(), querySelectorAll:()=>[],
      createElement:()=>mkEl(), body:mkEl(), documentElement:mkEl(), head:mkEl(),
      addEventListener(){}, removeEventListener(){}, createTextNode:()=>mkEl(), cookie:'', title:''}),
    localStorage:{getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v)},
      removeItem:k=>{delete store[k]}, clear:()=>{}, key:()=>null, length:0},
    console:{log(){},warn(){},error(){}}, addEventListener(){}, removeEventListener(){}, scrollY:0, scrollTo(){},
    matchMedia:()=>({matches:false,addListener(){},addEventListener(){}}),
    location: gen({href:'https://x/', protocol:'https:', search:'', reload(){}}),
    open:()=>null, requestAnimationFrame:()=>0, confirm:()=>true, prompt:()=>'', alert:()=>{},
    atob:s=>Buffer.from(s,'base64').toString('binary'), btoa:s=>Buffer.from(s,'binary').toString('base64'),
    Notification:Notif, setTimeout:()=>0, setInterval:()=>0, clearInterval:()=>{}, clearTimeout:()=>{},
    fetch:()=>Promise.reject(new Error('offline')),
    navigator: gen({serviceWorker:gen({register:()=>Promise.resolve({}), addEventListener(){}}), onLine:true,
      clipboard:{writeText:()=>Promise.resolve()}}),
    crypto: require('crypto').webcrypto, Blob:function(){}, FileReader:function(){},
    TextEncoder, TextDecoder, URL
  };
  win.window=win; win.self=win; win.globalThis=win;
  const ctx = vm.createContext(win);
  const tail = '\n;try{ globalThis.__R=aiLearn(); globalThis.__E=null; }catch(e){ globalThis.__E=e.name+": "+e.message; }'
             + '\n;try{ state.aiQueueTs={}; state.aiQueueTs[0]=Date.now(); globalThis.__R2=aiLearn(); globalThis.__E2=null; }catch(e){ globalThis.__E2=e.name+": "+e.message; }';
  // v2026-11-11c P0 行为级断言：在同一个 vm 上下文里真正调用数据链 / CSV / 合并 / 备份 / AI 判定函数，
  // 而不是只验「字符串在不在」。覆盖 Q1/Q7/Q14/Q15/Q16 的核心口径。
  const p0Script = `
;globalThis.__P0ERR=null;
;try{ (function(){
  const R={};
  try{
    state.settings.gistToken='SECRET_PAT_X'; state.settings.encPass='SECRET_PASS_X';
    R.backup=serializeBackup({stripSecrets:true,pretty:false});
  }catch(e){ R.backupErr=e.name+': '+e.message; }
  try{
    state.aiReviewRound=0; state.aiDailyQuizDone={}; state.aiDailyQuiz={}; state.aiDaily={}; state.readDaily={};
    mergeState({ aiReviewRound:3, aiReviewRoundStartTs:100, aiDailyQuizDone:{'2026-11-11':true},
      aiDailyQuiz:{'q1':{sel:{}}}, aiDaily:{'2026-11-11':[1,2]},
      readDaily:{'2026-11-10':{pages:{'A':10},total:{'A':100},ts:1}},
      readPages:{'2026-11':{bookStart:{'A':0},bookEnd:{'A':12}}} });
    R.mergeRound=state.aiReviewRound; R.mergeQuiz=!!state.aiDailyQuizDone['2026-11-11'];
    R.mergeDaily=!!state.aiDaily['2026-11-11']; R.mergeRead=!!state.readDaily['2026-11-10'];
    R.mergePages=(state.readPages['2026-11']||{}).bookEnd;
  }catch(e){ R.mergeErr=e.name+': '+e.message; }
  try{
    state.readPages={'2026-09':{bookStart:{'B':0},bookEnd:{'B':0}}};
    state.readDaily={'2026-09-01':{pages:{'B':0},total:{'B':100},ts:1},'2026-09-30':{pages:{'B':30},total:{'B':100},ts:2}};
    R.pages=computeMonthPages('2026-09').pages;
    state.readDaily['2026-09-15']={pages:{'B':5},total:{'B':100},ts:3};
    R.pagesAfterRegression=computeMonthPages('2026-09').pages;
    state.readPages={'2026-08':{bookStart:{'B':50},bookEnd:{'B':10}}};
    state.readDaily={'2026-08-02':{pages:{'B':10},total:{'B':100},ts:1}};
    R.negative=computeMonthPages('2026-08').pages;
  }catch(e){ R.pagesErr=e.name+': '+e.message; }
  globalThis.__CSV={};
  globalThis.showCSVModal=function(name,text){ globalThis.__CSV[name]=text; };
  try{
    state.modules.ielts={records:{'2026-11-11':{parts:{},menu:{picks:[1,6],done:{1:true}}}}};
    exportModuleCSV('ielts'); R.csvIelts=globalThis.__CSV['ielts-'+today()+'.csv']||'';
  }catch(e){ R.csvIeltsErr=e.name+': '+e.message; }
  try{
    state.aiMastered=[0]; state.aiMasteredTs={0:Date.now()}; state.aiMasteredDel={}; state.aiStudy={0:3};
    exportModuleCSV('ai'); R.csvAi=globalThis.__CSV['ai-terms-'+today()+'.csv']||'';
  }catch(e){ R.csvAiErr=e.name+': '+e.message; }
  try{
    state.readDaily={'2026-11-10':{pages:{'B':10},total:{'B':100},ts:1},'2026-11-11':{pages:{'B':30},total:{'B':100},ts:2}};
    state.modules.reading={records:{'2026-11-11':{done:true}}};
    exportModuleCSV('reading'); R.csvReading=globalThis.__CSV['reading-'+today()+'.csv']||'';
  }catch(e){ R.csvReadingErr=e.name+': '+e.message; }
  try{
    state.aiMastered=allAiTerms().map(x=>x.key);
    state.settings.aiKeepReview=true; state.settings.aiDailyQuiz=false;
    state.aiDaily={}; state.aiDaily[today()]=[0,1,2];
    state.aiDailyQuizDone={}; state.aiStudyTs={};
    R.aiDone=aiDayDone();
  }catch(e){ R.aiDoneErr=e.name+': '+e.message; }
  try{ renderReading(); R.renderReading='ok'; }catch(e){ R.renderReadingErr=e.name+': '+e.message; }
  try{ renderMonthly(); R.renderMonthly='ok'; }catch(e){ R.renderMonthlyErr=e.name+': '+e.message; }
  try{ ensurePageBaseline(); R.baseline='ok'; }catch(e){ R.baselineErr=e.name+': '+e.message; }
  // P1：人为让 aiLearn 抛错，验证 renderModule 会渲染兜底卡片而不是整页白屏
  try{
    var __mainEl=document.createElement('div');
    var __origGet=document.getElementById;
    document.getElementById=function(id){ return id==='main' ? __mainEl : __origGet(id); };
    var __origLearn=aiLearn;
    aiLearn=function(){ throw new Error('模拟模块渲染异常'); };
    try{ renderModule('ai'); }catch(e){ R.fallbackThrew=e.name+': '+e.message; }
    R.fallbackHtml=__mainEl.innerHTML;
    aiLearn=__origLearn;
    document.getElementById=__origGet;
  }catch(e){ R.fallbackErr=e.name+': '+e.message; }
  globalThis.__P0=R;
})(); }catch(e){ globalThis.__P0ERR=e.name+': '+e.message; }
`;
  // v2026-11-12 行为级断言：本轮遍数分层轮次、插队/出队、轮次基线、配置持久化
  const v7Script = `
;globalThis.__V7ERR=null;
;try{ (function(){
  const V={};
  const oList=aiTermIdxList, oRerender=aiRerender, oSave=save, oToast=toast, oCheck=aiCheckRound, oRenderModule=renderModule;
  aiRerender=function(){}; save=function(){}; toast=function(){}; renderModule=function(){};
  try{
    const idx=[0,1,2,3,4,5,6,7,8,9,10,11];
    aiTermIdxList=function(){ return idx.slice(); };
    let advance=0; aiCheckRound=function(){ if(aiRoundDone()) advance++; };
    state.aiRoundStudy={}; state.aiQueueTs={}; state.aiStudyTs={}; state.aiStudy={};
    state.aiMastered=[]; state.aiMasteredTs={}; state.aiMasteredDel={};
    state.aiReviewRound=0; state.aiDaily={};
    let day=0, dup=0;
    while(day<20 && !aiRoundDone()){
      day++; state.aiDaily={};
      const p=aiTodayPicks();
      if(new Set(p).size!==p.length) dup++;
      p.forEach(i=>aiStudyTerm(i));
    }
    V.days=day; V.dup=dup; V.full=aiRoundDone();
    V.counts=idx.map(i=>aiRoundCount(i));
    V.advance=advance;
    aiStudyTerm(0); V.extraCount=aiRoundCount(0);
    const masteredBefore=(state.aiMastered||[]).length;
    state.aiReviewRound=0; aiAdvanceRound();
    V.roundAfter=state.aiReviewRound; V.countsAfter=idx.map(i=>aiRoundCount(i));
    V.masteredKept=(state.aiMastered||[]).length===masteredBefore;
  }catch(e){ V.t43Err=e.name+': '+e.message; }
  try{
    state.aiRoundStudy={0:3}; state.aiStudy={0:3}; state.aiStudyTs={0:Date.now()};
    aiStudyUndo(0); V.undoCount=aiRoundCount(0); V.undoStudy=aiStudyCount(0);
  }catch(e){ V.t46Err=e.name+': '+e.message; }
  try{
    state.aiRoundStudy={}; state.aiQueueTs={}; state.aiStudyTs={}; state.aiStudy={}; state.aiDaily={};
    const n=Date.now(); state.aiQueueTs[3]=n; state.aiQueueTs[11]=n;
    const p=aiTodayPicks();
    V.priorBoth=p.indexOf(3)>=0 && p.indexOf(11)>=0;
    V.priorFront=p.slice(0,2).every(i=>i===3||i===11);
    aiStudyTerm(11); V.out=!aiQueuePending(11);
  }catch(e){ V.t47Err=e.name+': '+e.message; }
  try{
    const n=Date.now();
    state.aiQueueTs={0:n}; state.aiStudyTs={0:n-100000}; state.aiRoundStudy={0:1};
    mergeState({aiStudyTs:{0:n-200000}, aiQueueTs:{}, aiRoundStudy:{0:2}});
    V.antiPending=aiQueuePending(0); V.mRound=aiRoundCount(0);
  }catch(e){ V.t48Err=e.name+': '+e.message; }
  // T28：直接调用周测答错入口，验证不改掌握/不写复习时间/次日必进前 5
  try{
    aiTermIdxList=oList;
    const qs=aiQuizQuestions();
    if(!qs.length) V.t28Err='no questions';
    else{
      const q=qs[0], wrong=(q.correctOpt+1)%q.opts.length;
      state.aiRoundStudy={}; state.aiQueueTs={}; state.aiStudyTs={}; state.aiStudy={}; state.aiDaily={};
      state.aiMastered=[7,8]; state.aiMasteredTs={}; state.aiMasteredDel={};
      const before=(state.aiMastered||[]).slice().sort().join(',');
      aiQuizAnswer(0, wrong);
      V.q28Queue=!!(state.aiQueueTs||{})[q.correct];
      V.q28Mastered=(state.aiMastered||[]).slice().sort().join(',')===before;
      V.q28Ts=!((state.aiStudyTs||{})[q.correct]);
      const p2=aiTodayPicks(); V.q28Next=p2.indexOf(q.correct)===0;
      V.q28Wrong=wrong!==q.correctOpt;
    }
  }catch(e){ V.t28Err=e.name+': '+e.message; }
  try{
    state.settings={gistToken:'TK',gistId:'GID123',encPass:'PW',readGoal:9,reminderHour:7,actFactor:1.65};
    mergeState({settings:{readGoal:5,reminderHour:21}});
    V.cfgId=state.settings.gistId; V.cfgGoal=state.settings.readGoal; V.cfgHour=state.settings.reminderHour;
    V.cfgToken=state.settings.gistToken; V.cfgPass=state.settings.encPass; V.cfgAct=state.settings.actFactor;
  }catch(e){ V.cfgErr=e.name+': '+e.message; }
  aiTermIdxList=oList; aiRerender=oRerender; save=oSave; toast=oToast; aiCheckRound=oCheck; renderModule=oRenderModule;
  // T60-T62：轮次基线幂等（老用户 +1 / 重复不加 / 新设备不加）
  try{
    const legacy={aiPass1:[1,2], aiMastered:[1,2], aiStudy:{}, aiReviewRound:0};
    V.b60First=aiEnsureRoundBaseline(legacy); V.b60Round=legacy.aiReviewRound; V.b60Mark=legacy.aiRoundBaselineV2;
    V.b61Again=aiEnsureRoundBaseline(legacy); V.b61Round=legacy.aiReviewRound;
    const fresh={aiPass1:[], aiMastered:[], aiStudy:{}, aiReviewRound:0};
    V.b62First=aiEnsureRoundBaseline(fresh); V.b62Round=fresh.aiReviewRound; V.b62Mark=fresh.aiRoundBaselineV2;
  }catch(e){ V.t60Err=e.name+': '+e.message; }
  // T51：标题「本轮已完成 X/N 词」随本轮遍数变化
  try{
    state.aiRoundStudy={0:3,1:3}; state.aiReviewRound=1;
    V.titleHtml=aiLayerProgressHtml();
  }catch(e){ V.t51Err=e.name+': '+e.message; }
  // T63：跨端合并基线标记取 max，旧端数据不把已完成基线复活再加一次
  try{
    state.aiReviewRound=1; state.aiRoundBaselineV2=1;
    mergeState({aiReviewRound:0, aiRoundBaselineV2:0});
    V.mBaseRound=state.aiReviewRound; V.mBaseMark=state.aiRoundBaselineV2;
  }catch(e){ V.t63Err=e.name+': '+e.message; }
  // T65：真实 load() 路径下基线立即落盘，重复启动不重复 +1
  try{
    const base=defaultState();
    base.aiRoundBaselineV2=0; base.aiPass1=[1,2]; base.aiMastered=[1,2]; base.aiReviewRound=0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    const s1=load(); V.ld1=s1.aiReviewRound; V.ldMark1=s1.aiRoundBaselineV2;
    const raw1=JSON.parse(localStorage.getItem(STORAGE_KEY)); V.ldPersist=raw1.aiRoundBaselineV2;
    const s2=load(); V.ld2=s2.aiReviewRound;
  }catch(e){ V.t65Err=e.name+': '+e.message; }
  globalThis.__V7=V;
})(); }catch(e){ globalThis.__V7ERR=e.name+': '+e.message; }
`;
  // v2026-11-12c 首页精简行为级校验：真正执行 renderHome / homeReviewHtml / renderMonthly，
  // 而不只是查字符串在不在。覆盖空态、部分数据、老数据缺轮数、200 天历史不撑长首页。
  const homeScript = `
;globalThis.__HOMEERR=null;
;try{ (function(){
  const H={};
  const oGet=document.getElementById;
  const el=document.createElement('div');
  document.getElementById=function(id){ return id==='main'?el:oGet(id); };
  try{
    state.modules={}; state.aiDaily={}; state.aiStudyTs={}; state.aiReviewRound=0;
    state.readingFinished=[]; state.readDaily={}; state.readPages={};
    state.settings=Object.assign({}, state.settings||{}, {goal:{}});
    H.empty=homeReviewHtml();
    H.rateEmpty=[checkRate(7).rate, checkRate(30).rate];
    renderHome(); H.emptyHome=el.innerHTML;
  }catch(e){ H.emptyErr=e.name+': '+e.message; }
  try{
    state.modules.mana={records:{}}; state.modules.mana.records[today()]={done:true,weight:60};
    delete state.aiReviewRound;
    H.partial=homeReviewHtml();
    H.rateP=[checkRate(7).rate, checkRate(30).rate];
    renderHome(); H.partialHome=el.innerHTML;
  }catch(e){ H.partialErr=e.name+': '+e.message; }
  try{
    state.modules.mana={records:{}};
    for(let i=0;i<200;i++) state.modules.mana.records[addDays(today(),-i)]={done:true,weight:60,exercises:[],meals:{}};
    renderHome(); H.long=el.innerHTML;
    H.lenDiff=Math.abs(H.long.length-(H.partialHome||'').length);
    H.manaHistory=typeof manaHistoryHtml==='function' ? manaHistoryHtml().length : -1;
    H.recent=typeof recentCheckinsHtml==='function' ? recentCheckinsHtml('mana').length : -1;
  }catch(e){ H.longErr=e.name+': '+e.message; }
  try{
    renderMonthly(); H.monthly=el.innerHTML;
  }catch(e){ H.monthlyErr=e.name+': '+e.message; }
  document.getElementById=oGet;
  globalThis.__HOME=H;
})(); }catch(e){ globalThis.__HOMEERR=e.name+': '+e.message; }
`;
  // v2026-11-12d 体重页 P2 行为级校验：实跑 renderMana / renderMonthly / setManaTrend / closeSettings
  const p2Script = `
;globalThis.__P2ERR=null;
;try{ (function(){
  const P={};
  const oGet=document.getElementById;
  const el=document.createElement('div');
  const mk=(id)=>({ id:id||'', innerHTML:'', value:'', checked:false, textContent:'',
    style:{}, className:'', classList:{add(){},remove(){}},
    appendChild(){}, remove(){}, setAttribute(){}, getAttribute(){return null;}, addEventListener(){} });
  const nodes={main:el};
  document.getElementById=function(id){ if(!nodes[id]) nodes[id]=mk(id); return nodes[id]; };
  const emptyMeals=()=>({breakfast:[],lunch:[],snack:[],dinner:[]});
  try{
    state.modules={mana:{records:{}}, ielts:{records:{}}, reading:{records:{}}};
    state.settings=Object.assign({}, state.settings||{}, {goal:{weight:null,bodyFat:null,ielts:null}, autoEncrypt:false, encPass:''});
    state.readDaily={}; state.readPages={}; state.readingFinished=[];
    const ym=currentMonthKey();
    [['01',60,29.8],['05',59.5,29.2],['28',59,28.6]].forEach(function(a){
      state.modules.mana.records[ym+'-'+a[0]]={done:true,weight:a[1],bodyFat:a[2],exercises:[],meals:emptyMeals(),note:''};
    });
    P.series=manaTrendSeries().length;
    P.bf=bodyFatSeries(ym).map(function(p){return p.bf;}).join(',');
    renderMonthly(); P.monthly=el.innerHTML;
    // 补足能量域数据，让 7 日均卡与 8 周折线都能渲染，才能验证完整顺序
    for(let k=0;k<8;k++){
      const d=addDays(today(), -(k*7+1));
      const r=state.modules.mana.records[d]||{done:true,exercises:[],meals:emptyMeals(),note:''};
      r.weight=60+k*0.1; r.bodyFat=29;
      r.meals.breakfast=[{n:'测试餐',k:500,qty:1}];
      r.exercises=[{n:'测试运动',kcal:200}];
      state.modules.mana.records[d]=r;
    }
    renderMana(); P.mana=el.innerHTML;
    P.firstCard=(P.mana.split('<div class="dcard">')[1]||'').split('<div class="dcard">')[0];
  }catch(e){ P.baseErr=e.name+': '+e.message; }
  try{
    const keys=['⚖️ 记录今日身体指标','🍽️ 饮食（输入即算卡路里）','🍽️ 今日饮食指南',
      '🏃 运动（输入即算卡路里','🏋️ 训练计划（下班后）','📊 今日热量结算',
      '📈 趋势分析','⚖️ 体重趋势与能量收支','📈 近 8 周摄入','🏋️ 训练打卡周视图','📅 历史回顾'];
    P.order=keys.map(function(k){return (P.mana||'').indexOf(k);});
  }catch(e){ P.orderErr=e.name+': '+e.message; }
  try{
    let renders=0; const oRender=render;
    render=function(){ renders++; };
    setManaTrend('bodyFat');
    P.bDisp=nodes['manaTrendB']?nodes['manaTrendB'].style.display:'?';
    P.wDisp=nodes['manaTrendW']?nodes['manaTrendW'].style.display:'?';
    P.bBtn=nodes['manaTrendBtnB']?nodes['manaTrendBtnB'].className:'?';
    setManaTrend('weight');
    render=oRender; P.renders=renders;
  }catch(e){ P.switchErr=e.name+': '+e.message; }
  try{
    const ym=currentMonthKey();
    state.modules.mana.records={};
    state.modules.mana.records[ym+'-03']={done:true,weight:60,bodyFat:29.8,exercises:[],meals:emptyMeals(),note:''};
    renderMonthly(); P.oneBf=el.innerHTML;
    state.modules.mana.records={};
    renderMonthly(); P.zeroBf=el.innerHTML;
    const r={};
    r[ym+'-02']={done:true,weight:60,bodyFat:'',exercises:[],meals:emptyMeals(),note:''};
    r[ym+'-03']={done:true,weight:60,bodyFat:'abc',exercises:[],meals:emptyMeals(),note:''};
    r[ym+'-04']={done:true,weight:60,bodyFat:null,exercises:[],meals:emptyMeals(),note:''};
    r[ym+'-05']={done:true,weight:60,bodyFat:28.6,exercises:[],meals:emptyMeals(),note:''};
    state.modules.mana.records=r; P.dirty=bodyFatSeries(ym).length;
  }catch(e){ P.bfEdgeErr=e.name+': '+e.message; }
  try{
    const oSave=save, oR=render, oT=toast;
    save=function(){}; render=function(){}; toast=function(){};
    const vals={setGoalWeight:'60',setGoalBodyFat:'28',setGoalIelts:'6.5',setReadGoal:'5',
      setReminderHour:'21',setRemind:'on',setActFactor:'1.40',setBmrFormula:'mifflin'};
    const oGet2=document.getElementById;
    document.getElementById=function(id){ const n=mk(id); n.value=(vals[id]!=null)?vals[id]:''; n.checked=false; return n; };
    state.settings.goal={weight:null,bodyFat:null,ielts:null};
    closeSettings();
    P.goalBf=state.settings.goal.bodyFat; P.goalW=state.settings.goal.weight;
    document.getElementById=oGet2; save=oSave; render=oR; toast=oT;
  }catch(e){ P.settingsErr=e.name+': '+e.message; }
  try{
    const oS=save, oR=renderMana, oT=toast;
    save=function(){}; renderMana=function(){}; toast=function(){};
    const bvals={weightInput:'60.5',bodyFatInput:'28.0',bmiInput:'',bmrInput:''};
    const oGet3=document.getElementById;
    document.getElementById=function(id){ const n=mk(id); n.value=(bvals[id]!=null)?bvals[id]:''; return n; };
    bodyFieldsManual=false; saveBody();
    P.savedW=manaToday().weight; P.savedBf=manaToday().bodyFat;
    document.getElementById=oGet3; save=oS; renderMana=oR; toast=oT;
  }catch(e){ P.saveErr=e.name+': '+e.message; }
  document.getElementById=oGet;
  globalThis.__P2=P;
})(); }catch(e){ globalThis.__P2ERR=e.name+': '+e.message; }
`;
  try{
    vm.runInContext(appJs + tail + p0Script + v7Script + homeScript + p2Script, ctx, {filename:'index.html', timeout:15000});
    if(ctx.__E) bad('AI 视图 aiLearn() 运行时异常', ctx.__E);
    else if(typeof ctx.__R !== 'string' || !ctx.__R.length) bad('AI 视图 aiLearn() 未产出 HTML');
    else ok('AI 视图 aiLearn() 运行时无异常（默认态，'+ctx.__R.length+' 字符）');
    if(ctx.__E2) bad('AI 视图 aiLearn() 运行时异常（插队标记态）', ctx.__E2);
    else ok('AI 视图 aiLearn() 运行时无异常（插队标记态）');
  }catch(e){ bad('AI 视图运行时校验未能执行', e.message); }

  // ===== P0 静态锁（凭证外送 + 关键函数/字段存在性）=====
  const rawFn = htmlJs.match(/async function gistRawWithRetry\([\s\S]*?\n\}/);
  if(rawFn && !/headers\s*:\s*\{[^}]*Authorization/.test(rawFn[0])) ok('Q4 raw 域请求不再外送 PAT');
  else bad('Q4 gistRawWithRetry 仍携带 Authorization（凭证外送）');
  for(const [t,d] of [['recordReadProgress','阅读逐日单一数据源写入'],['computeMonthPages','月报统一页数口径'],
    ['requirePageProgress','打卡进度门禁'],['MERGE_EXPLICIT','mergeState 未登记字段兜底'],
    ['阅读后页','CSV 阅读后页码'],['已打卡项目','CSV 雅思中文项目名'],['新掌握明细','CSV AI 掌握明细']]){
    if(htmlJs.includes(t)) ok('存在：'+d); else bad('缺失：'+d);
  }

  // ===== P0 行为级判定 =====
  if(ctx.__P0ERR) bad('P0 行为校验脚本异常', ctx.__P0ERR);
  const R=ctx.__P0||{};
  if(R.backupErr) bad('备份序列化异常', R.backupErr);
  else if(/SECRET_PAT_X|SECRET_PASS_X/.test(R.backup||'')) bad('备份仍含明文密钥');
  else ok('serializeBackup 脱敏（备份不含 PAT / 加密口令）');
  if(R.mergeErr) bad('mergeState 执行异常', R.mergeErr);
  else{
    if(R.mergeRound===3) ok('mergeState 保留 aiReviewRound（新字段不再静默丢）'); else bad('mergeState 丢失 aiReviewRound', String(R.mergeRound));
    if(R.mergeQuiz&&R.mergeDaily&&R.mergeRead) ok('mergeState 保留自测记录/当日批次/逐日阅读进度');
    else bad('mergeState 丢失新增字段', JSON.stringify({quiz:R.mergeQuiz,daily:R.mergeDaily,read:R.mergeRead}));
    if(R.mergePages&&R.mergePages.A===12) ok('mergeState 保留 readPages 月末快照'); else bad('mergeState 丢失 readPages', JSON.stringify(R.mergePages));
  }
  if(R.pagesErr) bad('computeMonthPages 执行异常', R.pagesErr);
  else{
    if(R.pages===30) ok('本月阅读页数 = 月末30 − 月初0 = 30'); else bad('阅读页数口径错误', String(R.pages));
    if(R.pagesAfterRegression===30) ok('进度回退不抹历史增量（单调最大）'); else bad('进度回退抹掉历史增量', String(R.pagesAfterRegression));
    if(typeof R.negative==='number' && R.negative<0) ok('页数负差不再被夹成 0（走数据异常提示）'); else bad('负差仍被夹 0', String(R.negative));
  }
  if(R.csvIeltsErr) bad('雅思 CSV 执行异常', R.csvIeltsErr);
  else if(/听力·精听/.test(R.csvIelts||'') && /已打卡项目/.test(R.csvIelts||'')) ok('雅思 CSV 导出中文项目名（含已打卡项）');
  else bad('雅思 CSV 仍是数字 id 或缺少项目名', (R.csvIelts||'').slice(0,120));
  if(R.csvAiErr) bad('AI CSV 执行异常', R.csvAiErr);
  else if(/人工智能/.test(R.csvAi||'') && /新掌握明细/.test(R.csvAi||'') && !/undefined/.test(R.csvAi||'')) ok('AI CSV 含术语名/释义/新掌握明细');
  else bad('AI CSV 术语名为空或状态错误', (R.csvAi||'').slice(0,160));
  if(R.csvReadingErr) bad('阅读 CSV 执行异常', R.csvReadingErr);
  else if(/阅读后页/.test(R.csvReading||'') && /,30,/.test(R.csvReading||'')) ok('阅读 CSV 含「阅读后页」数值');
  else bad('阅读 CSV 缺阅读后页码', (R.csvReading||'').slice(0,160));
  if(R.aiDoneErr) bad('aiDayDone 执行异常', R.aiDoneErr);
  else if(R.aiDone===false) ok('全掌握后 AI 待办仍未完成（复习闭环生效，掌握不短路）');
  else bad('全掌握后 AI 待办被短路为已完成', String(R.aiDone));
  if(R.renderReadingErr) bad('renderReading 运行时异常', R.renderReadingErr);
  else ok('renderReading 运行时无异常（阅读视图）');
  if(R.renderMonthlyErr) bad('renderMonthly 运行时异常', R.renderMonthlyErr);
  else ok('renderMonthly 运行时无异常（月报视图）');
  if(R.baselineErr) bad('ensurePageBaseline 运行时异常', R.baselineErr);
  else ok('ensurePageBaseline 运行时无异常（基准派生）');
  if(R.fallbackErr) bad('模块渲染兜底自检异常', R.fallbackErr);
  else if(R.fallbackThrew) bad('renderModule 未吞掉渲染异常', R.fallbackThrew);
  else if(/这个模块暂时打不开/.test(R.fallbackHtml||'')) ok('模块渲染抛错时显示兜底卡片（不再白屏）');
  else bad('模块渲染异常未渲染兜底卡片', (R.fallbackHtml||'').slice(0,120));

  // ===== V7/V8 行为级判定 =====
  if(ctx.__V7ERR) bad('V7 行为校验脚本异常', ctx.__V7ERR);
  const V=ctx.__V7||{};
  if(V.t43Err) bad('T43 轮次模型执行异常', V.t43Err);
  else{
    if(V.full && Array.isArray(V.counts) && V.counts.every(x=>x===3)) ok('T43 一轮每卡正好刷满 3 遍（12 词 / '+V.days+' 天）');
    else bad('T43 一轮遍数不达标', JSON.stringify(V.counts));
    if(V.dup===0) ok('T43 每日抽卡零重复'); else bad('T43 抽卡出现重复', String(V.dup));
    if(V.advance===1) ok('T43 一轮完成后触发轮次推进'); else bad('T43 轮次推进未触发', String(V.advance));
    if(V.extraCount===3) ok('T44 已刷满 3 遍后再刷仍封顶 3'); else bad('T44 本轮遍数未封顶', String(V.extraCount));
    if(V.roundAfter===1 && Array.isArray(V.countsAfter) && V.countsAfter.every(x=>x===0) && V.masteredKept) ok('T45 轮次推进后遍数清零、掌握状态不清空');
    else bad('T45 轮次推进异常', JSON.stringify({r:V.roundAfter,c:V.countsAfter,m:V.masteredKept}));
  }
  if(V.t46Err) bad('T46 撤销执行异常', V.t46Err);
  else if(V.undoCount===2 && V.undoStudy===2) ok('T46 撤销回 2 遍、累计遍数同步 -1');
  else bad('T46 撤销口径错误', JSON.stringify({c:V.undoCount,s:V.undoStudy}));
  if(V.t47Err) bad('T47 插队执行异常', V.t47Err);
  else if(V.priorBoth && V.priorFront && V.out) ok('T47 答错/新词次日排最前，刷一次即出队');
  else bad('T47 插队或出队失效', JSON.stringify({b:V.priorBoth,f:V.priorFront,o:V.out}));
  if(V.t48Err) bad('T48 合并执行异常', V.t48Err);
  else if(V.antiPending && V.mRound===2) ok('T48 跨端合并不复活答错标记、遍数取较大值');
  else bad('T48 合并口径错误', JSON.stringify({p:V.antiPending,r:V.mRound}));
  if(V.t28Err) bad('T28 周测答错入口执行异常', V.t28Err);
  else if(V.q28Wrong && V.q28Queue && V.q28Mastered && V.q28Ts && V.q28Next) ok('T28 周测答错：不动掌握/不写复习时间，次日排最前');
  else bad('T28 周测答错口径错误', JSON.stringify({w:V.q28Wrong,q:V.q28Queue,m:V.q28Mastered,t:V.q28Ts,n:V.q28Next}));
  if(V.cfgErr) bad('FR-1 配置合并执行异常', V.cfgErr);
  else if(V.cfgId==='GID123' && V.cfgGoal===9 && V.cfgHour===7 && V.cfgToken==='TK' && V.cfgPass==='PW' && V.cfgAct===1.65) ok('FR-1 pull 后本机 settings 不被覆盖（Gist ID 免重填）');
  else bad('FR-1 配置仍被覆盖', JSON.stringify({id:V.cfgId,g:V.cfgGoal,h:V.cfgHour,t:V.cfgToken,p:V.cfgPass,a:V.cfgAct}));
  // ===== V8：进度卡精简 + 轮次基线 =====
  if(V.t60Err) bad('T60-T62 基线执行异常', V.t60Err);
  else{
    if(V.b60First===true && V.b60Round===1 && V.b60Mark===1) ok('T60 老用户基线：历史刷满 3 遍算完成 1 轮');
    else bad('T60 老用户基线错误', JSON.stringify({f:V.b60First,r:V.b60Round,m:V.b60Mark}));
    if(V.b61Again===false && V.b61Round===1) ok('T61 基线幂等：重复调用不重复 +1');
    else bad('T61 基线不幂等', JSON.stringify({a:V.b61Again,r:V.b61Round}));
    if(V.b62First===true && V.b62Round===0 && V.b62Mark===1) ok('T62 新设备基线：不加轮、标记置 1');
    else bad('T62 新设备基线错误', JSON.stringify({f:V.b62First,r:V.b62Round,m:V.b62Mark}));
  }
  if(V.t51Err) bad('T51 进度卡渲染异常', V.t51Err);
  else if(/第 2 轮 · 本轮已完成 2\/\d+ 词/.test(V.titleHtml||'') && /累计完成 <b>1<\/b> 轮/.test(V.titleHtml||'')) ok('T51 标题与累计轮数随本轮进度变化');
  else bad('T51 标题/轮数文案错误', (V.titleHtml||'').slice(0,180));
  if(V.t63Err) bad('T63 跨端合并基线执行异常', V.t63Err);
  else if(V.mBaseRound===1 && V.mBaseMark===1) ok('T63 跨端合并基线取 max，旧端不复活重复 +1');
  else bad('T63 跨端合并基线错误', JSON.stringify({r:V.mBaseRound,m:V.mBaseMark}));
  const aiHtml=ctx.__R||'';
  if(/第 \d+ 轮 · 本轮已完成 \d+\/\d+ 词/.test(aiHtml) && /🏁 累计完成/.test(aiHtml) && /答错排进优先复习，次日出现在今日卡片/.test(aiHtml)) ok('T50 AI 页含新轮次/词数/周测文案，渲染无异常');
  else bad('T50 AI 页新文案缺失', aiHtml.slice(0,160));
  const stale=['总刷卡遍数','累计达成','首轮已学完','下面按层级','刷满 3 遍的词','答错会自动把该术语标记为未掌握'].filter(t=>aiHtml.includes(t));
  if(!stale.length) ok('T64/T67 AI 页旧统计文案零残留');
  else bad('T64 AI 页仍有旧文案', stale.join(','));
  if(V.t65Err) bad('T65 真实 load 基线执行异常', V.t65Err);
  else if(V.ld1===1 && V.ldMark1===1 && V.ldPersist===1 && V.ld2===1) ok('T65 load() 基线立即落盘，重复启动不重复 +1');
  else bad('T65 基线落盘/幂等错误', JSON.stringify({a:V.ld1,m:V.ldMark1,p:V.ldPersist,b:V.ld2}));

  // ===== V9：首页精简（数据速览 / 历史回顾移除）行为级判定 =====
  if(ctx.__HOMEERR) bad('V9 首页行为校验脚本异常', ctx.__HOMEERR);
  const H=ctx.__HOME||{};
  if(H.emptyErr) bad('T6 空态渲染异常', H.emptyErr);
  else if(/还没有足够数据/.test(H.empty||'') && !/class="stat"/.test(H.empty||'')) ok('T6 全新用户显示数据速览空态，不摆 0% / — 误导数字');
  else bad('T6 空态文案或数字格错误', (H.empty||'').slice(0,160));
  if(H.partialErr) bad('T7/T9/T10 部分数据渲染异常', H.partialErr);
  else if(/本周打卡率/.test(H.partial||'') && /7 日均较上周/.test(H.partial||'') && /AI 累计完成轮数/.test(H.partial||'')
          && !/NaN|undefined/.test(H.partial||'') && /0 轮/.test(H.partial||'')) ok('T7/T9/T10 部分数据缺字段不白屏、老数据无轮数显示 0 轮');
  else bad('T7/T9/T10 部分数据或老数据异常', (H.partial||'').slice(0,200));
  if(H.rateEmpty && H.rateEmpty[0]===0 && H.rateEmpty[1]===0 && H.rateP && H.rateP[0]===3 && H.rateP[1]===1) ok('T2 统一口径：0 次打卡 0% / 0%，1 次打卡 → 近 7 天 3% / 近 30 天 1%');
  else bad('T2 打卡率口径错误', JSON.stringify({empty:H.rateEmpty,partial:H.rateP}));
  const homeStale=['历史回顾','还没有历史记录','查看月度复盘','体重趋势与能量收支','本周复盘','阅读本周复盘','月度复盘','<details class="fold">'].filter(t=>(H.partialHome||'').includes(t));
  if(!homeStale.length && /📊 数据速览/.test(H.partialHome||'') && /setView\('__monthly'\)/.test(H.partialHome||'')) ok('T13/T15 首页旧四块与历史长列表零残留，含数据速览与下钻入口');
  else bad('T15 首页仍有旧内容或缺新卡', homeStale.join(',')+' | '+(H.partialHome||'').slice(0,160));
  if(H.longErr) bad('T18 200 天历史渲染异常', H.longErr);
  else if(typeof H.lenDiff==='number' && H.lenDiff<400) ok('T18 首页长度不随 200 天历史增长（差值 '+H.lenDiff+' 字符）');
  else bad('T18 首页仍随历史记录变长', String(H.lenDiff));
  if(H.manaHistory>0 && H.recent>0) ok('T17 体重页 20 天明细 / 模块页打卡日期仍在（未误删）');
  else bad('T17 明细视图被误删', JSON.stringify({m:H.manaHistory,r:H.recent}));
  if(H.monthlyErr) bad('T5 每月统计渲染异常', H.monthlyErr);
  else if(/近 30 天整体打卡率/.test(H.monthly||'')) ok('T5 每月统计补上近 30 天整体打卡率，渲染无异常');
  else bad('T5 每月统计缺新增打卡率', (H.monthly||'').slice(0,160));

  // ===== P2：体重页两段重排 / 数据区精简 / 月报体脂率 行为级判定 =====
  if(ctx.__P2ERR) bad('P2 行为校验脚本异常', ctx.__P2ERR);
  const P2=ctx.__P2||{};
  if(P2.baseErr) bad('T1/T6/T8 体重页与月报实跑异常', P2.baseErr);
  else if(P2.series===3 && P2.bf==='29.8,29.2,28.6') ok('T3/T6 统一取数：3 天记录 / 体脂序列按日期升序且数值正确');
  else bad('T3 序列取数错误', JSON.stringify({s:P2.series,bf:P2.bf}));
  if(P2.orderErr) bad('P2 顺序取索引异常', P2.orderErr);
  else if(Array.isArray(P2.order) && P2.order.length===11 && P2.order.every(x=>x>=0)
     && P2.order.every((x,i)=>i===0||x>P2.order[i-1]) && P2.order[5]<P2.order[6]) ok('T1/AC1 录入区 6 项顺序严格，结算卡在全部 5 张数据卡之前');
  else bad('T1/AC1 体重页顺序错误', JSON.stringify(P2.order));
  if(P2.firstCard && /⚖️ 记录今日身体指标/.test(P2.firstCard) && !/<svg/.test(P2.firstCard)
     && /onclick="saveBody\(\)"/.test(P2.firstCard) && !/openAntafuImport/.test(P2.firstCard)) ok('T2/AC2 记录卡为第一张、无图表无导入按钮，仅 1 个记录按钮');
  else bad('T2/AC2 记录卡结构错误', (P2.firstCard||'').slice(0,180));
  if(P2.switchErr) bad('T5 趋势切换执行异常', P2.switchErr);
  else if(P2.renders===0 && P2.bDisp==='block' && P2.wDisp==='none' && P2.bBtn==='mini accent') ok('T5/AC5 体脂切换只改 DOM 显隐，render() 调用 0 次');
  else bad('T5 趋势切换口径错误', JSON.stringify({r:P2.renders,b:P2.bDisp,w:P2.wDisp,btn:P2.bBtn}));
  if(!P2.baseErr && /🎯 体脂率/.test(P2.monthly||'') && /29\.8%/.test(P2.monthly||'') && /28\.6%/.test(P2.monthly||'')
     && /1\.2%/.test(P2.monthly||'') && /var\(--good\)/.test(P2.monthly||'') && /最高 ·/.test(P2.monthly||'')) ok('T8/AC6 月报体脂：月初 29.8 / 月末 28.6 / Δ −1.2%（绿）/ 最高最低及日期');
  else bad('T8 月报体脂数值错误', (P2.monthly||'').slice(0,240));
  if(P2.bfEdgeErr) bad('T10/T12 体脂边界执行异常', P2.bfEdgeErr);
  else if(/本月暂无体脂记录/.test(P2.zeroBf||'') && /<b[^>]*>—<\/b><span>本月变化/.test(P2.oneBf||'') && P2.dirty===1) ok('T10/T12 0 条显示空态 / 1 条 Δ 为「—」/ 脏值被过滤');
  else bad('T10/T12 体脂边界错误', JSON.stringify({z:(P2.zeroBf||'').includes('本月暂无体脂记录'),one:/<b[^>]*>—<\/b><span>本月变化/.test(P2.oneBf||''),d:P2.dirty}));
  if(P2.settingsErr) bad('T13 设置保存执行异常', P2.settingsErr);
  else if(P2.goalBf===28 && P2.goalW===60) ok('T13/AC7 closeSettings() 重建 goal 不抹掉目标体脂');
  else bad('T13 目标体脂被抹掉', JSON.stringify({bf:P2.goalBf,w:P2.goalW}));
  if(P2.saveErr) bad('T7 记录身体指标执行异常', P2.saveErr);
  else if(P2.savedW===60.5 && P2.savedBf===28) ok('T7/AC4 无导入按钮下 saveBody() 仍可正常写入');
  else bad('T7 记录写入错误', JSON.stringify({w:P2.savedW,bf:P2.savedBf}));
})();

// ===== P1：CSP / 公共代理 / 错误边界 / bump 清单 =====
(function p1Checks(){
  const htmlRaw = fs.readFileSync(htmlPath, 'utf8');
  const cspM = htmlRaw.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
  if(!cspM) bad('P1 缺少 CSP meta');
  else{
    const c = cspM[1];
    ok('存在：CSP meta（最小可用策略）');
    if(/connect-src[^;]*api\.github\.com/.test(c) && /gist\.githubusercontent\.com/.test(c)) ok('CSP connect-src 覆盖 Gist 实际下载域');
    else bad('CSP 白名单缺少 gist.githubusercontent.com（会拦断云端同步）');
    if(/frame-ancestors|report-uri|report-to/.test(c)) bad('CSP 含 meta 无效指令');
    else ok('CSP 不含 meta 无效指令');
    if(/script-src[^;]*'unsafe-inline'/.test(c)) ok('CSP 保留 unsafe-inline（内联事件依赖，收紧列下一期）');
    else bad('CSP 误删 unsafe-inline（内联事件会全部失效）');
  }
  if(/allorigins|corsproxy|fetchViaProxy|tryFetchHuxiu|tryFetchIdictation|parseHuxiu|parseGeneric|parseRss/.test(htmlRaw)) bad('仍残留公共代理抓取代码/域名');
  else ok('Q5 公共代理与自动抓取已彻底移除');
  if(/自动抓取已停用/.test(htmlRaw)) ok('新闻页改为外链跳转提示'); else bad('缺新闻页停用提示');
  for(const [t,d] of [['__WB_BOOT_OK','启动标志'],['__wbFatal','全局错误横幅'],
    ['__wbModuleFail','模块兜底卡片'],['__wbRenderInner','render 包装'],['__wbRenderModuleInner','renderModule 包装'],
    ['workbench-emergency-','兜底导出文件名'],['window.onerror','全局错误捕获']]){
    if(htmlRaw.includes(t)) ok('存在：'+d); else bad('缺失：'+d);
  }
  if(!fs.existsSync(path.join(root,'bump.cjs'))) bad('缺失：bump.cjs 发布脚本');
  else ok('存在：bump.cjs 发布脚本');
  const swTxt = fs.readFileSync(swPath,'utf8');
  const fm = swTxt.match(/const FILES\s*=\s*\[([^\]]*)\]/);
  const listed = fm ? fm[1].split(',').map(s=>s.trim().replace(/^['"]|['"]$/g,'')).filter(Boolean) : [];
  const need = fs.readdirSync(root).filter(f=>{
    if(!fs.statSync(path.join(root,f)).isFile()) return false;
    return f==='index.html'||f==='data-notes.js'||f==='manifest.webmanifest'||/^icon.*\.(png|svg)$/.test(f)||/\.html$/.test(f);
  });
  const miss = need.filter(f=>!listed.includes(f));
  if(miss.length) bad('sw.js FILES 缺静态文件：'+miss.join(', '));
  else ok('sw.js FILES 含全部运行时静态文件（'+listed.length+' 项）');

  // 行为级：真正执行 head 内联错误边界脚本，验证横幅能挂载、导出入口存在
  const vm = require('vm');
  const blocks = htmlRaw.match(/<script>([\s\S]*?)<\/script>/g)||[];
  const headJs = blocks.length>1 ? blocks[0].replace(/^<script>/,'').replace(/<\/script>$/,'') : '';
  if(!headJs){ bad('未抽取到 head 错误边界脚本'); return; }
  let appended=0;
  const mk = () => new Proxy({style:{},children:[],textContent:'',id:'',innerHTML:''},{
    get(t,k){
      if(k==='appendChild') return c=>{ t.children.push(c); appended++; };
      if(k==='remove') return ()=>{};
      if(k==='setAttribute') return (a,v)=>{ t[a]=v; };
      if(k==='getAttribute') return ()=>null;
      if(k==='addEventListener') return ()=>{};
      return k in t ? t[k] : ()=>undefined;
    },
    set(t,k,v){ t[k]=v; return true; }
  });
  const body=mk();
  const doc={createElement:()=>mk(), body:body, documentElement:mk(),
    getElementById:()=>mk(), querySelector:()=>mk(), querySelectorAll:()=>[],
    addEventListener(){}, removeEventListener(){}};
  const win={document:doc, console:{log(){},warn(){},error(){}},
    addEventListener(){}, removeEventListener(){}, location:{reload(){}},
    localStorage:{getItem:()=>'{}'}, setTimeout:()=>0, Blob:function(){},
    URL:{createObjectURL:()=> 'blob:x'}, alert(){}};
  win.window=win; win.self=win; win.globalThis=win;
  const ctx2=vm.createContext(win);
  try{
    vm.runInContext(headJs,ctx2,{filename:'head-boot.js',timeout:5000});
    if(typeof win.__wbFatal!=='function') bad('head 脚本未注册 __wbFatal');
    else ok('head 错误边界脚本可执行（__wbFatal 已注册）');
    if(win.__WB_BOOT_OK===false) ok('启动标志初始为 false（主脚本挂掉可检出）');
    else bad('启动标志初始值错误');
    if(typeof win.onerror==='function') ok('window.onerror 已注册'); else bad('window.onerror 未注册');
    win.__wbFatal('模拟启动失败');
    if(appended>0 && body.style && body.style.paddingTop==='96px') ok('错误横幅可渲染且不遮挡内容（body 让位）');
    else bad('错误横幅未能挂载', 'appended='+appended+' pad='+JSON.stringify(body.style));
    if(/workbench-emergency-/.test(headJs)) ok('兜底导出读 localStorage，不依赖主脚本');
    else bad('兜底导出缺失');
  }catch(e){ bad('head 错误边界脚本运行时异常', e.message); }
})();

// ===== 首页精简静态锁（v2026-11-12c）：旧复盘/历史视图零残留，新视图与下钻入口齐全 =====
(function homeStaticChecks(){
  const stale=['historyByDate','historyByDateHtml','monthlyReviewHtml','weeklyReviewHtml','monthlyOpen',
    '查看月度复盘','阅读本周复盘','📅 月度复盘（近','还没有历史记录，从今天的打卡开始吧'];
  const hit=stale.filter(t=>htmlJs.includes(t));
  if(!hit.length) ok('T16 旧周/月复盘 / 首页历史回顾 / 折叠状态零残留');
  else bad('T16 仍有旧代码残留', hit.join(', '));
  for(const [t,d] of [['function homeReviewHtml','首页数据速览'],['function checkRate','统一打卡率口径'],
    ['function manaHistoryHtml','体重页历史明细'],['function recentCheckinsHtml','模块页打卡日期'],
    ['近 30 天整体打卡率','每月统计新增指标'],['⚖️ 体重明细','体重下钻入口'],['📅 每月统计','月度下钻入口']]){
    if(htmlJs.includes(t)) ok('存在：'+d); else bad('缺失：'+d);
  }
  const hb=htmlJs.match(/function renderHome\(\)\{[\s\S]*?\n\}/);
  if(hb && /homeReviewHtml\(\)/.test(hb[0]) && /kcalDriftHtml\(\)/.test(hb[0])
     && !/weightEnergyCardHtml\(\)/.test(hb[0]) && !/const hist|\$\{hist\}|historyByDateHtml/.test(hb[0])) ok('renderHome 只挂数据速览与条件提醒，不再挂体重综合卡 / 历史列表');
  else bad('renderHome 仍含已移除的视图调用');
})();

// ===== 体重页 P2 静态锁（v2026-11-12d）：删卡/删导入零残留，保留项与设置项齐全 =====
(function p2StaticChecks(){
  const stale=['weightWeekRows','periodLoss','manaMotivation','openAntafuImport','doAntafuImport',
    'importAntafu','导入蚂蚁阿福','体重周环比','不作趋势依据','最新单日'];
  const hit=stale.filter(t=>htmlJs.includes(t));
  if(!hit.length) ok('T3/AC3 周均体重 / 减重卡 / 阿福导入 / 单日噪声文案零残留');
  else bad('T3 仍有旧代码残留', hit.join(', '));
  for(const [t,d] of [['function manaTrendSeries','统一取数'],['function bodyFatSeries','体脂序列'],
    ['function setManaTrend','趋势切换'],['🎯 体脂率','月报体脂卡'],['setGoalBodyFat','目标体脂设置项'],
    ['bodyFat:null','默认 goal 体脂字段'],['bodyFat: document.getElementById','closeSettings 重建 goal 含体脂'],
    ['function weekGridHtml','训练打卡周视图'],['function manaHistoryHtml','历史明细'],
    ['function kcalWeeksHtml','8 周摄入'],['function weightEnergyCardHtml','体重能量卡'],
    ['btnImport','设置页备份导入'],['btnExportCsv','CSV 导出']]){
    if(htmlJs.includes(t)) ok('存在：'+d); else bad('缺失：'+d);
  }
  const mb=htmlJs.match(/function renderMana\(\)\{[\s\S]*?\n\}/);
  if(mb && /weightEnergyCardHtml\(\)/.test(mb[0]) && /kcalWeeksHtml\(\)/.test(mb[0])
     && /\$\{trendHtml\}/.test(mb[0]) && /\$\{hist\}/.test(mb[0])) ok('T4 体重页仍挂能量卡 / 8 周折线 / 趋势分析 / 历史明细');
  else bad('T4 体重页保留视图被误删');
})();

console.log('\n冒烟测试结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
