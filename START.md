---
type: index
title: 项目交接文档
summary: "祈·自律工作台：个人自律 PWA（雅思/减脂/AI 知识/学习计划/阅读/资讯），单文件 index.html 零构建，GitHub Pages + Gist 同步，数据私有。"
created: 2026-08-24
updated: 2026-08-24 10:45
---

# 祈·自律工作台（workbench）

[[wiki/concepts/schema|项目目录管理规范]]  |  [[preferences|用户偏好]]  |  [[experience|踩坑经验]]

## 项目概述

**当前状态**：执行中（已上线 GitHub Pages，持续迭代优化）

个人自律与自我提升一站式 PWA：把雅思备考、减脂塑形、AI 知识积累、学习计划、每日阅读与资讯输入整合进一个数据私有、手机单端随时打开的随身工作台。核心洞察是多目标整合 + 周期复盘比用好几个 App 更容易坚持。单文件即应用（`index.html` 约 496KB，零依赖零构建），数据本地 localStorage + 可选 Gist/Supabase 同步（AES 加密），部署于 GitHub Pages（`peiky6/workbench`）。2026-08-24 起源码与全部搭建资料迁移至本目录，按 project-init 规范维护。

**入口**：
- 线上地址：`https://peiky6.github.io/workbench/`
- 源码主文件：`index.html`
- 需求与设计：`1-input/rd/workbench-需求与设计.md`
- 交接手册（脱敏）：`2-agent-room/HANDOFF.md`；完整版（含凭证）：`3-build/private/HANDOFF.md`

## 参考 wiki

- 无 Obsidian Wiki。外部参考文档：
  - 原始对话记录：`2-agent-room/conversations/`
  - 长期记忆（跨项目）：`C:/Users/005566/.workbuddy/memory/`

## 执行记录

<!--
  层级：Agent → 会话 → 任务
  会话 ID：有则填 ID，无则填平台名（如 Trae、OpenCode）
-->

### WorkBuddy - Qclaw（Claude） - 2026-07-27 会话（原 `C:/Users/005566/WorkBuddy/.../workbench`）

#### 1. **搭建祈·自律工作台 PWA** - 已完成

- 当前进展：全部模块开发完成并上线 GitHub Pages，6 大模块（雅思/体重/新闻/AI 术语/学习计划/阅读）。
- 关键产出：`index.html`（496KB）、`sw.js`、`smoke.cjs`（68 项断言）、`README.md`。
- 放弃产物：阅读币虚拟激励（改为微信读书书币提醒）、封面图/首页阅读大卡/专注计时（精简）。
- 下一步：见 `1-input/rd/workbench-需求与设计.md` §9 已知待办。

#### 2. **AI 术语卡周更自动化** - 已完成（每周一执行）

- 当前进展：已执行 3 次（8/13、8/17、8/24），feed 7 → 14 → 21 条。
- 关键产出：执行记忆在 `2-agent-room/automations/automation-1786585875202/memory.md`，本地快照 `ai-terms-feed-2026-08-17.json`。
- 下一步：下周一自动执行；凭证在 `3-build/private/DEPLOY_SECRETS.md`。

### WorkBuddy - CodeBuddy - 2026-08-24 会话（本会话）

#### 1. **迁移全部搭建资料到 project-workbench** - 已完成

- 当前进展：源码 + 对话记录 + 需求文档 + 治理文件全部就位，git 仓库迁移完成。
- 关键产出：本目录骨架、`1-input/rd/workbench-需求与设计.md`。
- 下一步：后续开发/维护均在本目录进行；需发布时用 `3-build/private/deploy-scripts/deploy.cjs`。
