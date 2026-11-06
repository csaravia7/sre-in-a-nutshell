<div align="center">

<img src="ui/assets/icon.svg" alt="SRE in a Nutshell logo" width="96" height="96" />

# SRE in a Nutshell

**Namespace-level service health for on-call SRE teams — without the noise of a full dashboard.**

![Status](https://img.shields.io/badge/status-beta-orange?style=flat-square)
![Dynatrace](https://img.shields.io/badge/Dynatrace-AppEngine-1496FF?style=flat-square&logo=dynatrace&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/node-%3E%3D20.19-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)

[Features](#-features) · [Quick start](#-quick-start) · [Scopes](#-required-scopes) · [Scripts](#-scripts) · [Structure](#-project-structure) · [Troubleshooting](#-troubleshooting)

</div>

---

## ✨ Features

Surfaces the metrics that matter during an incident or a daily review: **availability**, **error rate**, **throughput** and **latency**, compared across time windows.

The default **Analysis** view (`/analysis`) works in two steps:

| Step | What you get |
|---|---|
| 🧭 **Namespace overview** | Every Kubernetes namespace with its key SRE indicators for the last 24 hours |
| 🔎 **Namespace drill-down** | Pick a namespace to analyze its services in three tabs (below) |

| Tab | Description |
|---|---|
| 📊 **Comparison** | Current value next to *yesterday* and *7 days ago*, with % change. Filter by name or availability range, sort by availability |
| 🟩 **Heatmap** | Daily availability per service |
| 📈 **Time series** | p50 / p90 / p99 latency and failures over time |

**Also included**

- 🎯 Global **segment selector** (Grail filter segments), remembered between visits
- 🌐 English and Spanish UI
- 🌗 Light and dark theme
- ⚡ Sections load independently — one slow query never blocks the page

> 💡 The `/today` and `/week` routes exist in the code but are not linked from the navigation yet.

---

## 📋 Prerequisites

- 🟢 **Node.js** `>= 20.19.0` and npm
- ☁️ A **Dynatrace environment** with AppEngine, where you can deploy apps
- ☸️ Kubernetes services monitored with Smartscape, so `dt.service.request.*` metrics are available
- 🔑 A Dynatrace user allowed to install apps, with the [scopes](#-required-scopes) below

---

## 🚀 Quick start

```bash
git clone <repository-url>
cd sre-in-a-nutshell
npm install
```

### 1️⃣ Point the app to your environment

Edit `environmentUrl` in [app.config.json](app.config.json) with the `apps` domain of your environment:

```json
{
  "environmentUrl": "https://<your-environment-id>.apps.dynatrace.com/"
}
```

### 2️⃣ Run locally

```bash
npm run start
```

Starts the dev server with hot reload and opens the browser. On first run, `dt-app` asks you to sign in to your environment.

### 3️⃣ Build and deploy

```bash
npm run lint      # must pass
npm run build     # compiles and bundles into dist/
npm run deploy    # builds and deploys to the environment in app.config.json
```

Then open the **App Launcher** in Dynatrace and look for **SRE in a nutshell** 🎉

> ⚠️ **App ID** — the app uses `my.sre.in.a.nutshell`. If another app with that ID already exists in your environment, change `app.id` in [app.config.json](app.config.json) before deploying. To remove a deployed app, run `npm run uninstall`.

---

## 🔐 Required scopes

Declared in [app.config.json](app.config.json). The user running the app needs the matching permissions.

| Scope | Purpose |
|---|---|
| 📉 `storage:metrics:read` | Service metrics (DQL `timeseries`) |
| 🕸️ `storage:smartscape:read` | Service and namespace lookups (`smartscapeNodes`) |
| 🏷️ `storage:entities:read` | Entity name resolution |
| 🎛️ `storage:filter-segments:read` | Global segment selector |
| 📜 `storage:logs:read` | Log queries |
| 🔔 `storage:events:read` | Change events |
| 🪣 `storage:buckets:read` | Bucket metadata |
| 👤 `state:user-app-states:read` | Per-user preferences (read) |
| 💾 `state:user-app-states:write` | Per-user preferences (write) |

---

## 🧰 Scripts

| Command | Description |
|---|---|
| ▶️ `npm run start` | Dev server with hot reload |
| 📦 `npm run build` | Production build into `dist/` |
| 🚢 `npm run deploy` | Build and deploy to the configured environment |
| 🧹 `npm run lint` | ESLint across the project |
| 🗑️ `npm run uninstall` | Remove the app from the environment |
| 🔄 `npm run update` | Update `dt-app` and SDK dependencies |
| ℹ️ `npm run info` | Show app and environment information |

---

## 🗂️ Project structure

```text
app.config.json          App metadata, scopes, icon path, environment URL
ui/
├── main.tsx             React entry point
├── styles.css           Custom styles (CSS variables for light/dark)
├── assets/              Icons and logos
└── app/
    ├── App.tsx          Router, segments and theme wiring
    ├── components/      Shared UI (Header, SectionCard, ...)
    ├── pages/           Route-level components (Analysis, Today, Week)
    ├── sections/
    │   ├── analysis/    Namespace cards, comparison, heatmap, time series
    │   └── today/       Problems and change events
    ├── queries/         All DQL queries as named exports
    ├── hooks/           Progressive loading, per-user state
    └── i18n/            EN/ES translations and language provider
```

---

## 🧑‍💻 Development conventions

- 🔍 **DQL lives in [ui/app/queries/](ui/app/queries/)** — never inline a query in a component. Always set an explicit timeframe and `limit`.
- 🎨 Use **[Strato Design System](https://dt-url.net/strato)** components, imported from subcategory paths (`/layouts`, `/typography`, ...), never from the package root.
- ✅ `npm run lint` and `npm run build` must both pass before merging or deploying.
- 🔒 Never commit tokens or secrets — ESLint scans for them.

---

## 🩺 Troubleshooting

| Symptom | Likely cause |
|---|---|
| 🈳 Empty namespace list | No Kubernetes services in Smartscape, or an active segment filters everything out |
| 🚫 Permission errors in a section | Your user is missing one of the [required scopes](#-required-scopes) |
| 💥 `deploy` fails with an app ID conflict | Another app already uses the same `app.id` — change it in `app.config.json` |
| 🧱 Engine or syntax errors on `npm install` | Use Node.js `>= 20.19.0` |

---

## 📚 Resources

- 🧑‍🏫 [Dynatrace Developer Portal](https://dt-url.net/developers)
- 🎨 [Strato Design System](https://dt-url.net/strato)
- 🔎 [DQL reference](https://dt-url.net/dql)
