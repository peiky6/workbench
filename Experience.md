---
type: reference
title: "踩坑经验"
summary: "本项目专属的失败教训——尝试→失败→根因→正确做法。仅记录具有泛化价值的因果性教训，不记录偶发故障。"
created: 2026-08-24
updated: 2026-08-24 10:45
---

> 如果一条记录不能让下次任务做得更好，就不要写进去。

## 部署与缓存

1. **改完不升缓存名 = 用户看不到更新**。`sw.js` 的 `const CACHE = 'qi-workbench-v1X'` 必须递增；改完必跑 `node smoke.cjs`。
2. **token 传递**：管道 `TOK=... node ... | curl` 右侧 curl 拿不到左值，必须用 `export TOK=` 或整段同侧。
3. **单文件风险**：`index.html` 一个语法错误 = 整页白屏（无构建兜底），靠 smoke.cjs 兜底。
4. **token 纪律**：PAT 曾出现于 HANDOFF/对话中，但绝不要写进 `index.html`、公开文件或提交历史（公开仓库 peiky6/workbench 是公开的）。迁移时用 `grep -rl "ghp_"` 全盘扫描验证。
5. **沙箱网络**：`raw.githubusercontent.com` 被墙（http=000），验证部署一律走 `api.github.com` Contents API 解码。

## 数据模型

6. **术语库版本陷阱**：清空 `aiMastered` 时必须同时写 `aiMasteredDel` 并删除 `aiMasteredTs`，否则云端旧 ts 会在同步时复活掌握状态（last-write-wins 的坑）。
7. **同步数据唯一写入点**：周更自动化只 PATCH `ai-terms-feed.json`，**绝不触碰 `workbench.json`**（用户加密同步数据，碰了会清空）。

## 交互 bug（已修）

8. 训练「套用计划」曾误判完成 → 拆出 `trainDone` 显式打卡 + 取消可恢复（`trainCancel`）。
9. 阅读弹窗曾误显示 AI 术语卡 → 改内置金句池；文字溢出 → 修 CSS。

## 环境与工具

10. **Node 路径**：Windows 下 Node 不认 `/e/...` 路径，脚本内一律写 `E:/...`。
11. **沙箱 /tmp 不可写**（curl 退出码 23）：临时文件写工作区目录。
12. **磁盘迁移前先只读扫描**：用户对敏感操作（C→E 盘迁移）要求先扫描再提方案，不直接动。
