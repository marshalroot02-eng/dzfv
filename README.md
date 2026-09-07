# TikTok Mobile App Live Stream Multi-Viewer & Auto-Liker (In-Memory Cloud Architecture)

> [!IMPORTANT]
> **Gaming Incentive Program Rule**: Web automation is strictly excluded. **Only live stream engagement generated through the official TikTok Mobile App counts.**
> This system deploys genuine Android environments running the TikTok Mobile App on GitHub Actions runners, automated via high-speed ADB and native touch simulation.
> **Zero External Storage Overhead**: The system operates with pure in-memory state management, with zero Google Sheets, zero Google Drive, and zero database dependencies.

---

## 🌟 Architecture Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                      ZERO-DB / ZERO-SHEETS CONTROL PLANE ARCHITECTURE                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

 [ 1. Operator Dashboard & Control Center ]
 ──────────────────────────────────────────
  React Web UI (Port 5173) ──► Node.js / Express In-Memory API (Port 3005)
           │                                 │
           │                                 ├──► AES-256-GCM In-Memory Credential Vault
           │                                 ├──► Real-Time Runner Telemetry & Heartbeats
           │                                 └──► Live Video Stream Forwarding (WebSocket + Scrcpy)
           ▼
 [ 2. Automated Cloud & Local Runners ]
 ──────────────────────────────────────────
  Runner 0..N (GitHub Actions / Cloud VMs / Local LDPlayer)
           │
           ├──► 1. Fetches assigned account via /api/accounts/runner-assignment/{runner_key}
           ├──► 2. Bootstraps Android environment & injects credentials safely
           ├──► 3. Deep-links into Live Stream: snssdk1233://live?room_id=...
           ├──► 4. Native Auto-Tapper sends 120–240 likes/min continuously
           └──► 5. Sends live telemetry & state updates directly to backend API
```

---

## 1. Fast Start

### Backend API (In-Memory)
```bash
cd backend
npm install
npm start
# Listens on port 3005 with WebSocket support
```

### Control Center Dashboard
```bash
cd frontend
npm install
npm run dev
# Dashboard available at http://localhost:5173
```

---

## 2. GitHub Secrets Configuration

In your GitHub repository, configure:
**Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**:

| Secret Name | Description | Required? |
|---|---|---|
| `TIKTOK_BOOSTER_BACKEND_URL` | Control Center API URL (e.g. `https://api.fgos.site/tiktok`) | Yes |
| `VPN_TOKEN` | NordVPN Token (if using NordVPN) | Optional |
| `PIA_USER` / `PIA_PASS` | PIA VPN Credentials (if using PIA) | Optional |
| `TIKTOK_APK_URL` | Download link to x86_64 TikTok Mobile APK | Optional |

---

## 3. How to Run via GitHub Actions

1. Go to the **Actions** tab in your repository.
2. Select **TikTok Mobile App Live Stream Multi-Viewer & Auto-Liker**.
3. Click **Run workflow** and enter:
   - **Target TikTok Live Stream URL / @username**: e.g. `https://www.tiktok.com/@username/live` or `@username`
   - **Duration in minutes**: e.g. `60` (up to 360 min)
   - **Likes per minute**: e.g. `120`
   - **VPN Provider**: `none`, `nordvpn`, or `pia`
4. Click **Run workflow**.

---

## 4. File Structure

```
├── backend/
│   ├── server.js                  # In-memory REST & WebSocket API engine
│   ├── fleet_worker.js            # Fleet orchestration worker
│   ├── ecosystem.config.js        # PM2 cluster configuration
│   └── package.json               # Backend dependencies (zero DB drivers)
├── frontend/
│   ├── src/                       # React Control Center Dashboard
│   └── package.json               # Frontend dependencies
├── .github/workflows/
│   ├── tiktok-app-booster.yml     # Main parallel matrix workflow
│   ├── manual-ldplayer-test.yml   # LDPlayer diagnostic workflow
│   └── test-connection.yml        # System & module diagnostic workflow
├── scripts/
│   ├── setup_emulator.sh          # Android SDK & AVD bootstrap script
│   ├── setup_vpn.sh               # VPN setup helper
│   ├── fast_tap.sh                # High-speed on-device native touch script
│   └── github_manager.py          # GitHub dispatch & secret manager
├── src/
│   ├── config.py                  # App configuration & CLI args
│   ├── models.py                  # Account & stream data models
│   ├── auto_login.py              # Autonomous login manager
│   ├── adb_controller.py          # Android ADB automation & touch engine
│   ├── vpn_service.py             # VPN routing service
│   └── main.py                    # Master orchestrator
├── requirements.txt               # Python dependencies
└── README.md                      # Documentation
```
