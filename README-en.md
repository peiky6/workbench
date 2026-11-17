# 🧠 Qi Self-Discipline Workbench — An All-in-One PWA for Personal Growth

> A single, private, mobile-first workspace that unifies IELTS prep, fat-loss tracking, AI knowledge building, study plans, daily reading, and news intake.

**`PWA / Mobile`** · **`All Rights Reserved`** · **`Local-first & private data`**

[English](./README-en.md) | [中文](./README.md)

## 📌 Table of Contents

- [Motivation](#motivation)
- [Design Principles](#design-principles)
- [Core Mechanisms](#core-mechanisms)
- [How to Use](#how-to-use)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [License](#license)

## 💡 Motivation

IELTS, fat-loss, learning AI, reading — these goals live in separate apps. You stay busy every day yet see no trend and keep no own data.

**Core insight**: consolidating multiple self-improvement goals into one portable, data-private, trackable workspace is easier to stick with than juggling several apps.

Three pain points:

1. **Scattered data**: weight, check-ins, and study progress sit in different places, impossible to review together.
2. **No long-term view**: you know what you did today, not whether this week or month moved the needle.
3. **Poor personal fit**: generic apps don't care about your "AI PM transition path" or "Loctek class schedule".

## 🧭 Design Principles

1. **Single file is the app**: zero dependencies, zero build — one `index.html` is everything. Simple to deploy, hard to break wholesale.
2. **Data belongs to you**: local `localStorage` first, optional Gist / Supabase sync; cloud never holds Token / secrets, with optional passphrase encryption.
3. **Light daily, cyclic review**: daily tasks capped at ~30 minutes; heatmap and weekly review supply the long-term view.
4. **Content-first, personally tuned**: term bank customized for AI PM, study plan from your August plan, diet / training from the Loctek schedule.
5. **Loss prevention first**: key writes carry timestamps; multi-device merge is last-write-wins.

## ⚙️ Core Mechanisms

| Mechanism | What it does | Where it applies |
| --- | --- | --- |
| Daily snapshot | At 00:00 each day, assigns a fixed batch by date seed; stable within the day | AI term cards rotation, study plan display |
| Sequential unlock | Next item opens only after the current one is done, matched by date | 24-day AI transition plan |
| Review gate | A term card unlocks "mastered" only after 3 reads | Review phase after first pass |
| Auto-compute | BMI / BMR computed from profile, manually overridable | Weight entry |
| Fuzzy search | Local food library 200+ entries, exercise library, type-to-suggest | Diet / exercise logging |
| Blind-merge safe | Last-write-wins by record `ts` | Multi-device Gist sync |
| Offline cache | SW forces navigation reload; version bump forces refresh | PWA offline use |

## 🚀 How to Use

### Quick start

1. Open: `https://peiky6.github.io/workbench/` (first load needs network; offline afterwards).
2. On mobile, "Add to Home Screen" for a native-like app.

> [!NOTE]
> Data lives in your current browser by default. Before switching devices or clearing cache, configure Gist or Supabase in "Settings → Sync" for backup.

### Configure cloud sync

1. Create a GitHub Gist (any filename, e.g. `workbench.json`).
2. Generate a Personal Access Token with `gist` scope.
3. Paste Gist ID and Token in "Settings → Sync"; it auto-uploads on save and auto-downloads on open.

> [!IMPORTANT]
> Synced data **excludes** Token / secrets (the `settings` field is stripped before upload). With "local passphrase encryption" on, the cloud stores AES ciphertext; the passphrase never leaves your device.

### Example: a day

1. Morning: homepage "Today's to-do" → weight module applies the training-day diet plan → log weight (BMI / BMR auto-computed).
2. Commute: IELTS menu picks 1–2 items → AI term cards read 3 times.
3. Evening: eat dinner → check in training per the Loctek schedule.
4. Evening: weekly review + news reading + study-plan progress.

## 📦 Tech Stack

- **Language**: HTML / CSS / JavaScript (no framework, no build step)
- **Offline**: PWA (`manifest.webmanifest` + `sw.js`)
- **Deploy**: GitHub Pages (static hosting, no backend) — `git push` to `main` goes live
- **Test**: Node `smoke.cjs` (extracts script, runs `node --check` + key-function checks)

> Drifting details — current version, assertion count, cache name — are maintained in [`HANDOFF.md`](./HANDOFF.md), not repeated here.

## 📁 Project Structure

The app lives at the root (single-file PWA + external `data-notes.js`), plus a few governance folders (`/1-input` `/2-agent-room` `/3-build` `/4-test`). See [`schema.md`](./schema.md).

> [!WARNING]
> Staying single-file is a deliberate architectural choice. If you must split, prefer a "no-build multi-file `<script src>`" approach over a bundler, to avoid breaking production.

## 🔧 Maintenance & Release

For contributors / AI: version numbers, release steps, tests, known pitfalls, and change log are all in [`HANDOFF.md`](./HANDOFF.md). This document covers only "what it is and how to use it".

## 📄 License

This project is for **personal use only**. No open-source license is applied; **all rights reserved**. Code and docs are for the owner's use only; no rights to use, modify, or distribute are granted to others.
