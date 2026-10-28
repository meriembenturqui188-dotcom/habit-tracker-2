# 🌸 Bloom — Habit Tracker

A complete habit tracking web app built with plain HTML, CSS, and JavaScript.
No frameworks, no backend, no login — everything is saved in your browser's
`localStorage`.

## Features

- **Add habits** with a name and emoji (16 preset emojis or type your own)
- **Dashboard** with all habits, daily progress ring (%), top streak, weekly
  completions, and active habit count
- **Complete / undo** habits for today with a single tap
- **Streaks** — current consecutive-day streak per habit (with best-streak tooltip)
- **Weekly chart** — completions per day for the last 7 days
- **Calendar** — month view with completion intensity and per-day emoji; click any
  day to see exactly which habits were completed
- **Edit & delete** habits via modals (delete asks for confirmation)
- **Persistent** — habits and full completion history survive page refreshes
- **Example habits** are seeded on first launch so charts and streaks have real data
- Responsive layout for desktop and phones, dark purple / lavender / soft pink theme

## How to run locally

The app is static — no build step needed.

**Option A — just open it**

Double-click `index.html` (or drag it into your browser). Everything works over
`file://` in most browsers.

**Option B — serve it (recommended)**

From the folder containing the three files:

```bash
# Python 3
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000> in your browser.

## Files

| File        | Purpose                                   |
| ----------- | ----------------------------------------- |
| `index.html` | Page structure (stats, habits, chart, calendar, modals) |
| `style.css`  | Theme, cards, charts, calendar, animations, responsive rules |
| `script.js`  | State, streaks, stats, rendering, localStorage persistence |

## How it works

- Dates are stored as `YYYY-MM-DD` strings; each habit keeps its own list of
  completion dates, so streaks and percentages are always computed from real data.
- A streak counts consecutive completed days ending today (or yesterday if today is
  still pending — the streak stays alive until you miss a full day).
- Data lives under the `bloom.habits.v1` key in `localStorage`. To reset the app,
  clear site data or run `localStorage.clear()` in the browser console, then reload.
