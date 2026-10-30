# 祈·自律工作台 — 交接手册

> 供外部工具 / 协作者修改本工作台时参考。最新线上版本：**APP_VERSION `2026-10-29a` / SW `qi-workbench-v94`**（GitHub Pages，仓库 `peiky6/workbench`，分支 `main`）。
> ⚠️ 本文档曾严重漂移（写过 v16 / v54 / v55），于 2026-10-30 按线上 `origin/main` 实际状态重写。行号随版本漂移，检索请优先用函数名。

## 1. 项目定位
- 个人自律 PWA（纯静态单页，无后端）：整合雅思 / 减脂 / AI 知识 / 学习计划 / 每日阅读 / 产出池。数据留在自己手里（`localStorage` + 可选 Gist / Supabase 加密同步）。
- 线上地址：`https://peiky6.github.io/workbench/`
- 本地源码（本会话工作副本，已 `git reset --hard origin/main` 对齐线上）：`C:/Users/005566/WorkBuddy/2026-07-27-16-13-17/workbench/`

## 2. 技术栈与架构
- 核心逻辑在 `index.html`（约 388KB）；**内置 AI 学习笔记已外置为 `data-notes.js`（约 244KB）**，通过 `<script src="data-notes.js"></script>`（index.html 第 641 行）注入全局 `BUILTIN_NOTES`——**2026-09-04 已完成，是「无构建 `<script src>` 多文件」方案，不是 fetch**。
- PWA：`manifest.webmanifest` + `sw.js`（离线缓存；导航网络优先、失败回退缓存；预缓存清单含 `index.html` / `data-notes.js` / 图标 / manifest）。
- 持久化：`localStorage`（键 `qi_workbench_v2`，index.html 第 644 行）；可选 Gist / Supabase 云同步（AES 加密，ENC2 二进制载体，Gist 1MB 截断自愈）。
- ⚠️ **拆分警告**：用户明确**不引入打包工具**。允许「无构建 `<script src>` 多文件」（如 data-notes.js）或外置静态数据，不能上 Vite 等。

## 3. 文件结构
```
workbench/
├── index.html            # 核心逻辑（约 388KB，改这里）
├── data-notes.js         # 内置 AI 学习笔记（约 244KB），<script src> 注入 BUILTIN_NOTES
├── sw.js                 # Service Worker，仅做版本/缓存控制（预缓存含 data-notes.js）
├── manifest.webmanifest  # PWA 清单
├── smoke.cjs             # 固化冒烟测试（node 跑，改完必跑，299 项断言，版本号已解耦）
├── supabase_setup.js     # Supabase 建表脚本（可选同步用）
├── icon.svg / *.png      # 图标（含 maskable）
├── .nojekyll             # 禁用 Jekyll
├── README.md / README-en.md / START.md / Experience.md / Preferences.md / schema.md
├── ai-terms-feed-2026-08-17.json  # 周更术语 feed 本地副本（真源在 Gist）
└── 4-test/               # 测试/验证页（如 ai-notes-qa-check.html）
```

## 4. 部署 / 发布
- GitHub Pages 从 `origin/main` 发布。
- 历史上通过 **GitHub Contents API（PAT）** 或 **git push** 提交到 `main`。
- ⚠️ **当前文档记载的 PAT 已失效（401 Bad credentials）**。本机 git 凭据可读取远程（`git ls-remote` 已验证）；如需推送部署，用 `git push origin main`——**只提交改动文件，切勿把本地临时文件（patch_*/gist_verify*/feed_patch_* 等）带上去**。
- 每次改完 `index.html` / `data-notes.js` / `sw.js` 必须：
  1. 递增 `sw.js` 的 `const CACHE`（否则用户看不到更新；当前 `qi-workbench-v94`）。
  2. （建议）递增 `index.html` 的 `APP_VERSION`（当前 `2026-10-29a`）。
  3. 跑 `node smoke.cjs` 全绿再推。

## 5. 测试
- `node smoke.cjs`：抽取 `<script>` + `data-notes.js` 跑 `node --check` + 校验关键函数/常量/数据存在性。**当前 299 项断言。**
  - 2026-10-30 修复：`APP_VERSION` 改为格式校验（`/^20\d{2}-\d{2}-\d{2}[a-z]?$/`），`SW 缓存名` 改为「≥ 历史基线 v94」的 floor 检查——**不再写死具体版本，部署无需再改断言**（升缓存时把 `MIN_SW` 同步调高即可继续防「忘了升缓存」）。
- 单文件无构建兜底，一个语法错误整页白屏，靠 smoke 兜底。

## 6. 数据模型与关键约定
- 状态键、同步机制（Gist / Supabase AES ENC2）、术语库版本等以代码为准；行号随版本漂移，检索请用函数名（`renderXxx` / `openXxx` / `seedNotes` / `save`）。
- **内置笔记（`BUILTIN_NOTES`，来自 data-notes.js）不上传云端**——云端只存用户数据，避免大文件超过 Gist 截断线导致下载失败。

## 7. 用户偏好与约定（长期记忆）
- 身份：IT 软件项目经理，转型 **AI PM**。术语库 / 学习计划 / 书单都围绕此。
- 内容取向：AI 资讯要落到「对项目经理有什么用」（交付 / 选型 / 成本 / 合规 / 团队）。
- 日常：乐刻周课表（周六 Zumba）；16+8 轻断食（工作日 + 周末均 17:00 前吃完）；每日阅读目标 5 分钟。
- 隐私：公开仓库只放**匿名化代码**，不含用户数据；用户数据存手机 localStorage + secret Gist（密文）。
- 风格：手机端优先（不撑长页面）；砍掉花哨无用之物（曾砍封面图、首页阅读大卡、专注计时）；虚拟激励换现实激励（微信读书领书币）。
- ⚠️ 轻量自动化偏好：不引入改变现有操作路径的重工具；提效方案先评估是否改变用户操作方式。

## 8. 已知待办 / 未做
- **第三梯队（用户已列未做）**：①弹性补卡（每月 2 次或「微量打卡」标灰）；②绑定 AI PM 目标的推荐书单。
- **16+8 到点提醒**：目前仅文案，未做浏览器 / PWA 定时通知。
- **调试残留**：2026-10-30 已清 3 处 `console.log`（快照清理 / 笔记同步 / 历史快照）；保留 `console.warn` / `console.error` 容错日志。

## 9. 踩坑清单（给协作者）
1. **改完必须升 SW 缓存名 + 跑 smoke.cjs**，否则用户看不到更新。
2. **本地工作副本可能严重落后于线上**：本会话初就曾拿一份 7 月旧快照当源，差点把线上 v94 回退。动手前先 `git fetch` + 比对 `origin/main`，确认本地是线上当前版再改。
3. **笔记外置已完成**：别再重复「拆 BUILTIN_NOTES」——它早在 data-notes.js 里。
4. **token 传递**：Contents API 部署需有效 PAT（当前文档 token 已失效），勿写进公开仓库 / 提交历史。
5. **别把 token / 用户数据写进 index.html 或提交**，保持公开仓库匿名。
6. 沙箱内 `raw.githubusercontent.com` 被墙，验证走 `api.github.com` 或本地 `node smoke.cjs`。
