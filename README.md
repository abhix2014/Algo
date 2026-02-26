# $5,000 Prop Firm Trading Control System

Static GitHub Pages app that enforces a strict, rule-based workflow for a two-step prop firm challenge.

## Features
- One-time setup lock (Stage 1 or Stage 2 only).
- Fixed risk per trade: **$25** (0.5%).
- Mandatory screenshot for every trade entry.
- RR auto-calculation and hard rejection for RR below **1:2**.
- Auto-rejection if daily/total loss buffers are too small.
- Trade results restricted to **WIN** or **LOSS** only.
- Auto PnL application (+$50 for WIN, -$25 for LOSS).
- Dashboard with equity, progress, drawdown buffers, win rate, net R, and trading days.
- Daily lock after max daily loss and permanent lock after max total loss.

## Run locally
Open `index.html` directly, or serve it:

```bash
python3 -m http.server 4173
```

Then visit `http://localhost:4173`.

## Deploy to GitHub Pages
1. Create a new GitHub repository.
2. Push these files to the default branch.
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, set:
   - **Source**: Deploy from a branch
   - **Branch**: `main` (or your default branch), `/ (root)`
5. Save. GitHub provides a public Pages URL.

