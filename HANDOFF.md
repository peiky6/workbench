# 祈·自律工作台 — 交接手册

> 供外部工具 / 协作者 / 手机云端任务修改本工作台时参考。
> 最新线上版本：**APP_VERSION `2026-11-18c` / SW `qi-workbench-v111`**（GitHub Pages，仓库 `peiky6/workbench`，分支 `main`，最近线上提交：本次 `fix: 自定义条目脏名防御与解析边界加固` 提交）。
> ⚠️ 本文档于 2026-11-17 按线上 `origin/main` 与本地实测全量重写。行号随版本漂移，检索请优先用函数名。改完请同步更新本手册顶部版本号。

## 1. 项目定位
- 个人自律 PWA（纯静态单页，无后端）：整合雅思 / 减脂 / AI 知识 / 每日阅读 / 产出池 / 笔记问答 / 求职面试等模块。数据留在自己手里（`localStorage` + 可选 Gist 加密同步）。
- 线上地址：`https://peiky6.github.io/workbench/`
- 本地源码（当前工作副本，已对齐 `origin/main`）：`E:/workbuddy-data/project-workbench/`
- 手机云端改码：全程走 GitHub clone → 改 → push，云端沙箱**看不到本地路径**。完整流程见项目资产 `MOBILE-WORKFLOW.md`。

## 2. 技术栈与架构
- 核心逻辑在 `index.html`（428,464 字节）；**内置 AI 笔记外置为 `data-notes.js`（255,119 字节）**，通过 `<script src="data-notes.js"></script>` 注入全局 `BUILTIN_NOTES`——无构建多文件方案，**不是 fetch**。
- PWA：`manifest.webmanifest` + `sw.js`（2,731 字节；离线缓存，导航网络优先、失败回退缓存；预缓存含 `index.html` / `data-notes.js` / 图标 / manifest）。
- 持久化：主存键 `qi_workbench_v2`；凭证独立键 `qi_wb_creds` + IndexedDB 密文副本 `qi_history/creds`（设备密钥 `qi_wb_dk`）；可选 Gist 云同步（AES ENC2，Gist 1MB 截断自愈）。
- CSP：`form-action 'none'` 已补；`script-src`/`style-src` 保留 `unsafe-inline`（本期刻意不收紧，避免白屏）。
- ⚠️ **拆分警告**：用户明确**不引入打包工具**。允许「无构建 `<script src>` 多文件」或外置静态数据，不能上 Vite 等。

## 3. 文件结构
```
workbench/
├── index.html            # 核心逻辑（约 410KB，改这里）
├── data-notes.js         # 内置 AI 笔记（约 249KB），<script src> 注入 BUILTIN_NOTES
├── sw.js                 # Service Worker，仅做版本/缓存控制
├── manifest.webmanifest  # PWA 清单
├── smoke.cjs             # 固化冒烟测试（约 107KB，node 跑，改完必跑，当前 549 项断言）
├── icon.svg / *.png      # 图标（含 maskable）
├── .nojekyll             # 禁用 Jekyll
├── README.md / README-en.md / START.md / Experience.md / Preferences.md / HANDOFF.md / schema.md
├── ai-terms-feed-2026-08-17.json  # 周更术语 feed 本地副本（真源在 Gist）
├── 1-input/ 2-agent-room/ 3-build/ 4-test/   # 治理目录（见 schema.md）
└── supabase_setup.js     # 保留文件，但 Supabase 死代码已清理
```

## 4. 部署 / 发布
- GitHub Pages 从 `origin/main` 发布，`git push` 即自动上线。
- 本机 remote 是 SSH（`ssh://git@ssh.github.com:443/peiky6/workbench.git`），本机可推送。
- **手机云端沙箱没有本机 SSH key**：云端改码须用 HTTPS + fine-grained PAT（仅给 `workbench` 仓库 Contents 写权限，短期有效，用完撤销）。PAT 在任务对话里单独提供，禁止写进公开仓库或提交历史。
- 每次改完 `index.html` / `data-notes.js` / `sw.js` 必须：
  1. 递增 `sw.js` 的 `const CACHE`（当前 `qi-workbench-v111`，否则用户看不到更新）；
  2. 递增 `index.html` 的 `APP_VERSION`（当前 `2026-11-18c`，格式 `YYYY-MM-DD[a-z]`）；
  3. 跑 `node smoke.cjs` 全绿（当前 549 项）再推；
  4. 更新本手册顶部版本号。

## 5. 测试
- `node smoke.cjs`：抽取 `<script>` + `data-notes.js` 跑 `node --check` + 关键函数/常量/行为级判定 + 静态锁。**当前 549 项断言，全绿才准推。**
- 版本号断言已解耦：`APP_VERSION` 走格式校验、`SW 缓存名` 走「≥ 历史基线」floor 检查，部署时无需改断言（升缓存时把 `MIN_SW` 同步调高即可继续防「忘了升缓存」，当前 `MIN_SW=111`）。
- 单文件无构建兜底，一个语法错误整页白屏，靠 smoke 兜底。

## 6. 数据模型与关键约定
- 状态键、同步机制（Gist AES ENC2）、术语库版本等以代码为准；行号随漂移，检索用函数名（`renderXxx` / `openXxx` / `seedNotes` / `save` / `persistSafe`）。
- **内置笔记（`BUILTIN_NOTES`）不上传云端**——云端只存用户数据，避免大文件超 Gist 截断线。
- **凭证三层加固（v2026-11-16a）**：①写空保护（三项清空不抹已有凭证、回灌内存）；②IndexedDB AES-GCM 密文冗余副本 + 设备密钥；③启动自愈恢复（独立键为空时从副本解密恢复）。主存 / 云端载荷 / 导出备份 / 快照 / 回滚备份均零凭证明文。
- **自定义条目基准模型（v2026-11-18b，v18c 加固）**：`customFoods` / `customExercises` 条目统一为 `{n, k, u}`——`k` 是**每基准单位**热量（食物 `u:'100g'|'100ml'` → k=每100克/毫升；运动 `u:'分钟'` → k=每分钟），名字只存纯名、不带数字单位。`parseCustomUnit` 从「腰果42g / 椭圆机42分钟」剥离数字单位，`migrateCustomEntries` 在 load 链**及 mergeState（拉取/导入/快照恢复三出口共用）**幂等迁移老脏条目（只改联想库、**不动 `modules.mana.records` 历史流水**；`amount<=0` 的非法条目跳过、不产生 `null`）。自由输入由 `matchFood` / `matchExercise` 按基准换算；显式热量写法（`蛋白粉 120` / `椭圆机 250大卡`）优先级最高。**v18c 解析防御**：库内残留脏条目（如「腰果42g」与「腰果」共存）时输入整串按记录热量记 1 份、绝不乘数字；按克/毫升换算返回 `shownAmt` 供预览显示实际数量（腰果50g→50g，不再 ×0.5）；负号、中文量词、按克食物的整数份数均做钳制。

## 7. 本周功能变更（2026-11-03 ~ 11-18，按时间）
| 日期 | 版本 | 变更摘要 |
|---|---|---|
| 11-03 | 11-03a | 按饮食指南&训练计划更新体重模块（工作日 1760kcal/101g + 每周课表） |
| 11-11 | 11-11a | 备份脱敏+真实下载、AI 持续复习闭环、清理 Supabase 死代码 |
| 11-11 | 11-11b | 修复 AI 知识模块点击打不开（`aiLayerProgressHtml` 漏声明 `all`） |
| 11-11 | 11-11c | P0 数据可信链修复 |
| 11-11 | 11-11d | P1 错误边界 + CSP + 移除公共代理 + 发布脚本 |
| 11-12 | 11-12a/b | AI 本轮遍数分层轮次 + 配置持久化 + 移除每日自测；进度卡精简为轮次口径 |
| 11-12 | 11-12c/d | 首页精简为行动区+数据速览；体重页重排为录入区+数据回顾区，移除阿福导入与冗余体重口径，月报新增体脂率 |
| 11-13 | 11-13a/b | 安全 P1 落盘副本脱敏 + 内置笔记数据格式化；P2 凭证拆键 + 老设备静默迁移，全落盘出口零凭证 |
| 11-16 | 11-16a | P4 凭证持久化三层加固（写空保护 / 密文冗余 / 启动自愈，SW v107） |
| 11-17 | 11-17a | 清理全部 16+8 饮食文案（代码 4 处 + 三份文档 6 处），SW v108；文档同步规则确立 |
| 11-18 | 11-18a | 修复饮食录入：食物名带重量/容积单位（如 50g 鸡胸肉）不再被当份数乘（曾 133×50=6650 kcal）；按食物库基准（100g/250ml/30g）换算，对不上按 1 份记；smoke 新增 9 条 T19 回归断言（522→531），SW v109 |
| 11-18 | 11-18b | 自定义食物/运动「名字+基准」归一化：自定义录入把「腰果42g+250 / 椭圆机42分钟+250」存为纯名字+基准（595kcal/100g / 5.95kcal/分钟），再输入自动换算、不再 250×42；`migrateCustomEntries` 幂等迁移老脏条目（只改联想库、不动历史流水）；smoke 新增 8 条 T20 断言（531→539），SW v110 |
| 11-18 | 11-18c | 解析防御与边界加固：库内残留脏条目（腰果42g+腰果共存）输入整串按记录热量记 1 份、杜绝 250×42=10500；显式热量混写优先（腰果42g300kcal→300）；按克/毫升换算显示实际数量（腰果50g→50g·298 而非 ×0.5）；负号/中文量词/按克整数份数钳制；迁移跳过 amount<=0 非法条目避免 null；迁移收口 mergeState（拉取/导入/恢复）；smoke 新增 10 条 T21 断言（539→549），SW v111 |

## 8. 用户偏好与约定（长期记忆）
- 身份：IT 软件项目经理，转型 **AI PM**。术语库 / 学习计划 / 书单围绕此。
- 内容取向：AI 资讯要落到「对项目经理有什么用」（交付 / 选型 / 成本 / 合规 / 团队）。
- 日常：乐刻周课表（周六 Zumba）；每日阅读目标 5 分钟。
- 隐私：公开仓库只放**匿名化代码**；用户数据存手机 localStorage + secret Gist（密文）。
- 风格：手机端优先；砍掉花哨无用之物；虚拟激励换现实激励（微信读书领书币）。
- ⚠️ 轻量自动化偏好：不引入改变现有操作路径的重工具；提效方案先评估是否改变用户操作方式。

## 9. 未做 / 暂缓 / 已否决事项追踪表（勿重复提议）

状态定义：**暂缓**＝方向认可但本期不动；**不做**＝用户明确否决；**已否决**＝工程评估负收益；**替代交付**＝换了更轻方案。
本表原存本地 `.workbuddy/memory/MEMORY.md`（gitignore、云端不可见），2026-11-17 并入本手册供本地 + 云端任务共享。

| 事项 | 状态 | 原因（摘要） | 重启 / 触发条件 |
|---|---|---|---|
| Q2 随机盐（ENC3 载荷升级） | 暂缓（11-11/12/13 三次确认） | 载荷格式一变旧设备解不开，须全端同窗口升级；成本风险不匹配 | 用户主动解禁并接受多端升级窗口 |
| APP 化评估（第三方评说明书） | 不做（11-13） | 用户决定不做；旧产物已归档，基于过期版本 | 用户重提时按当时版本重做 |
| PAT 撤销 / 轮换 | 不做（11-13） | 「不撤销，每次重建费劲，不外露即可」；已核验仓库零真实 token | 疑似泄露或用户主动要求 |
| PAT 会话记录清理 | 不做 | 本机 WorkBuddy 数据、不在 git 内，不会 push / 上云 | 用户改变「不外露」定义 |
| CSP 完全收紧（去 unsafe-inline） | 本期不做，另立项目 | 单文件全内联，改 ≥300 处、白屏风险最高；本期仅补 `form-action 'none'` | 单独立项且接受改架构 |
| Q8：170 处内联 style 改 class | 永久取消（P3 v2） | 需新增约 89 个一次性类、样式表变大、视觉回归风险；零安全收益 | 不建议重启 |
| Q9：126 处 onclick 全量改造 | 收窄为 4 处（已完成），其余不做 | 其余拼内部 id / 常量、无注入面；全改白屏风险高收益零 | 不建议重启 |
| D7：明文 localStorage 真加密 | 替代交付，真加密未做 | 用户「操作方式不变、不想重填凭证」；已交付拆键 + 全出口脱敏；**残留：主存与独立键仍明文** | 用户接受风险并主动要求 |
| FR-3「设置页不回填完整值」 | 主动撤销 | 留空＝清凭证，改别的设置会被迫重填；用户「操作方式不变」 | 勿再提出 |
| 静态数据拆分 / 死代码清理 / 打包工具 | 已否决 | 收益递减；单文件无构建是刻意选择 | 勿再提出 |

**暂缓（未列上表）**：第三梯队——①弹性补卡（每月 2 次或微量打卡标灰）；②绑定 AI PM 目标的推荐书单（本周未复核）。

移动端云端改码流程见项目资产 `MOBILE-WORKFLOW.md`。

## 10. 踩坑清单（给协作者）
1. **改完必须升 SW 缓存名 + 跑 smoke.cjs**（当前 v111 / 549 项），否则用户看不到更新。
2. **本地工作副本可能落后于线上**：动手前先 `git fetch` + 比对 `origin/main`，确认基线再改。11-16 曾因本机与远程分叉（内容一致、历史不同）导致 push 被拒，用 `git reset --mixed origin/main` 对齐解决——**绝不强推覆盖**。
3. **笔记外置已完成**（data-notes.js），别再重复拆 `BUILTIN_NOTES`。
4. **Supabase 死代码已清理**，保留 `supabase_setup.js` 仅为兼容，不要基于旧文档恢复 Supabase 同步链路。
5. **token 传递**：本机 SSH 可推；云端沙箱须 HTTPS + 短期 PAT；PAT/口令禁止写进公开仓库、提交历史或主存。
6. **沙箱内 `raw.githubusercontent.com` 可能不通**，验证走 `api.github.com` 或本地 `node smoke.cjs`。
7. **云端改码无法真机预览 PWA**，最终效果须手机浏览器打开线上地址强制刷新验证。
8. **`github.com` 被阻断时用 Git Data API 推送（11-17 实战验证）**：
   - 症状：`git push` 报 `Connection reset by 20.205.243.160 port 443`；curl `github.com` / `raw.githubusercontent.com` 均 000；SSH 443 重置；换 IP 直连也 TLS 失败（exit 35，TCP 通而 TLS 被掐）。**不是代码或权限问题，别改仓库配置、别强推。**
   - 判定：`curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token <PAT>" -H "User-Agent: x" https://api.github.com/rate_limit` 返回 **200** 即可用备用通道（000 说明 api 也不通，只能等）。
   - 做法：`TOK=<PAT> CMSG="<提交说明>" node 3-build/private/deploy-scripts/deploy-api.cjs <文件1> <文件2> ...`
     走 GET ref → POST blob（内容取 `git show HEAD:file`，保住行尾格式）→ POST tree(base_tree) → POST commit(parent=远端HEAD) → PATCH ref，**N 个文件只产生 1 个提交**。
   - **api 端点自身也会抖动**（实测约半数请求 TLS 被掐，报 `socket disconnected before secure TLS connection`）：脚本已内置最多 10 次指数退避重试，看到 `· 第 N 次失败…后重试` 属正常，**别中断、别误判失败就放弃**。
   - 为什么不用 `deploy.cjs`：它走 Contents API 逐文件提交，N 个文件 = N 个 deploy 提交，正是 11-16 分叉的成因。
   - 推完：远端历史被压缩成 1 个提交，本地仍有多提交。网络恢复后 `git fetch origin && git reset --mixed origin/main` 对齐，**绝不 force push**。
   - 脚本与 token 都在 `3-build/private/`（已 gitignore），不要移进公开目录、不要硬编码 token。
