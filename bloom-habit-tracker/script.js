"use strict";

/* ============================================================
   Bloom — Habit Tracker
   Plain HTML/CSS/JS · data persisted in localStorage
   ============================================================ */

const STORAGE_KEY = "bloom.habits.v1";
const DEFAULT_EMOJI = "🌟";
const EMOJI_CHOICES = [
  "💧", "📚", "🧘", "🏃", "🥗", "😴",
  "✍️", "🎨", "🎵", "🌱", "🦷", "🙏",
  "💰", "🧹", "☀️", "🍬",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DOW_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ---------------- date helpers ---------------- */

function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayKey() {
  return dateKey(new Date());
}

function addDays(d, n) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

function lastNDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(new Date(), -i));
  return out;
}

function parseKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/* ---------------- state ---------------- */

let habits = [];
let calCursor = (() => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
})();
let selectedDay = null;   // dateKey shown in the day-detail panel
let editingId = null;     // habit id being edited
let pendingDeleteId = null;

/* ---------------- storage ---------------- */

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ habits }));
  } catch (e) {
    console.warn("Bloom: could not save to localStorage", e);
  }
}

function isValidHabit(h) {
  return (
    h &&
    typeof h.id === "string" &&
    typeof h.name === "string" &&
    typeof h.emoji === "string" &&
    Array.isArray(h.completions)
  );
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.habits)) {
        habits = parsed.habits
          .filter(isValidHabit)
          .map((h) => ({
            ...h,
            completions: h.completions.filter(
              (c) => typeof c === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c)
            ),
          }));
        return;
      }
    }
  } catch (e) {
    console.warn("Bloom: could not read saved data", e);
  }
  // First run: seed a few example habits with realistic history
  habits = seedHabits();
  save();
}

function seedHabits() {
  const today = new Date();
  const k = (n) => dateKey(addDays(today, -n));
  return [
    {
      id: uid(),
      name: "Drink 2L of water",
      emoji: "💧",
      createdAt: k(20),
      completions: [k(0), k(1), k(2), k(3), k(4), k(6), k(8), k(9), k(11)],
    },
    {
      id: uid(),
      name: "Read 20 minutes",
      emoji: "📚",
      createdAt: k(14),
      completions: [k(1), k(2), k(4), k(5), k(7), k(10), k(12), k(13)],
    },
    {
      id: uid(),
      name: "Morning stretch",
      emoji: "🧘",
      createdAt: k(9),
      completions: [k(0), k(2), k(3), k(5), k(6)],
    },
    {
      id: uid(),
      name: "Exercise",
      emoji: "🏃",
      createdAt: k(30),
      completions: [k(1), k(3), k(6), k(8), k(13), k(15)],
    },
    {
      id: uid(),
      name: "No sugary snacks",
      emoji: "🍬",
      createdAt: k(3),
      completions: [k(1), k(2)],
    },
  ];
}

/* ---------------- core logic ---------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function normalizeEmoji(raw) {
  const v = (raw || "").trim();
  if (!v) return DEFAULT_EMOJI;
  const cps = Array.from(v);
  if (cps.length <= 8 && cps.some((ch) => /\p{Extended_Pictographic}/u.test(ch))) {
    return v;
  }
  return DEFAULT_EMOJI;
}

function isCompletedOn(habit, key) {
  return habit.completions.includes(key);
}

/** Current streak: consecutive completed days ending today (or yesterday, if today is still pending). */
function getStreak(habit) {
  const set = new Set(habit.completions);
  let cursor = new Date();
  if (!set.has(dateKey(cursor))) {
    cursor = addDays(cursor, -1);
    if (!set.has(dateKey(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(dateKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest streak across all recorded completions. */
function getBestStreak(habit) {
  const days = [...habit.completions].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of days) {
    if (prev && key === dateKey(addDays(parseKey(prev), 1))) {
      run++;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

function computeStats() {
  const total = habits.length;
  const today = todayKey();
  const doneToday = habits.filter((h) => isCompletedOn(h, today)).length;
  const weekKeys = new Set(lastNDays(7).map(dateKey));
  let weekDone = 0;
  for (const h of habits) {
    for (const c of h.completions) {
      if (weekKeys.has(c)) weekDone++;
    }
  }
  const bestStreak = habits.reduce((m, h) => Math.max(m, getStreak(h)), 0);
  return {
    total,
    doneToday,
    pct: total ? Math.round((doneToday / total) * 100) : 0,
    weekDone,
    bestStreak,
  };
}

/* ---------------- mutations ---------------- */

function addHabit(name, emojiRaw) {
  const cleanName = (name || "").trim().replace(/\s+/g, " ");
  if (!cleanName) return { ok: false, error: "Please give your habit a name." };
  if (cleanName.length > 50) return { ok: false, error: "Keep the name under 50 characters." };
  const habit = {
    id: uid(),
    name: cleanName,
    emoji: normalizeEmoji(emojiRaw),
    createdAt: todayKey(),
    completions: [],
  };
  habits.unshift(habit);
  save();
  renderAll();
  return { ok: true, habit };
}

function toggleToday(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  const key = todayKey();
  const idx = habit.completions.indexOf(key);
  if (idx === -1) {
    habit.completions.push(key);
    save();
    renderAll();
    toast(`${habit.emoji} ${habit.name} — done for today! 🎉`);
    const s = computeStats();
    if (s.total > 0 && s.doneToday === s.total) celebrate();
  } else {
    habit.completions.splice(idx, 1);
    save();
    renderAll();
    toast(`Completion removed for “${habit.name}”.`);
  }
}

function updateHabit(id, name, emojiRaw) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return { ok: false, error: "Habit not found." };
  const cleanName = (name || "").trim().replace(/\s+/g, " ");
  if (!cleanName) return { ok: false, error: "Please give your habit a name." };
  habit.name = cleanName;
  habit.emoji = normalizeEmoji(emojiRaw);
  save();
  renderAll();
  return { ok: true };
}

function deleteHabit(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;
  habits = habits.filter((h) => h.id !== id);
  save();
  renderAll();
  toast(`Deleted “${habit.name}”.`);
}

/* ---------------- rendering ---------------- */

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderAll() {
  renderHeader();
  renderStats();
  renderHabits();
  renderWeekChart();
  renderCalendar();
  renderDayDetail();
}

function renderHeader() {
  const now = new Date();
  $("dateChip").textContent = `${DOW_FULL[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;
}

function renderStats() {
  const s = computeStats();
  const CIRC = 2 * Math.PI * 52; // r = 52
  const ringFill = $("ringFill");
  ringFill.style.strokeDasharray = CIRC;
  ringFill.style.strokeDashoffset = CIRC * (1 - s.pct / 100);
  $("ringPercent").textContent = `${s.pct}%`;
  $("ringCaption").textContent = s.total
    ? `${s.doneToday} of ${s.total} habits completed today`
    : "No habits yet — add your first one below 👇";
  $("statBestStreak").textContent = s.bestStreak;
  $("statWeekDone").textContent = s.weekDone;
  $("statActive").textContent = s.total;
}

function renderHabits() {
  const grid = $("habitsGrid");
  const empty = $("emptyState");
  const s = computeStats();
  $("todayCount").textContent = s.total ? `${s.doneToday}/${s.total} done today` : "";

  if (!habits.length) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const week = lastNDays(7).map(dateKey);
  const today = todayKey();

  grid.innerHTML = habits
    .map((h) => {
      const done = isCompletedOn(h, today);
      const streak = getStreak(h);
      const best = getBestStreak(h);
      const dots = week
        .map((k) => {
          const filled = isCompletedOn(h, k);
          const isToday = k === today;
          return `<div class="dot-col${isToday ? " today" : ""}" title="${DOW_FULL[parseKey(k).getDay()]}">
            <span class="dot${filled ? " filled" : ""}"></span>
            <span class="dot-label">${DOW_SHORT[parseKey(k).getDay()]}</span>
          </div>`;
        })
        .join("");
      return `<article class="habit-card${done ? " done" : ""}" data-id="${h.id}">
        <div class="habit-top">
          <span class="habit-emoji">${h.emoji}</span>
          <div class="habit-info">
            <h3>${escapeHtml(h.name)}</h3>
            <span class="streak-chip${streak ? "" : " zero"}" title="Best streak: ${best} day${best === 1 ? "" : "s"}">
              ${streak ? `🔥 ${streak} day${streak === 1 ? "" : "s"}` : "No streak yet"}
            </span>
          </div>
          <div class="habit-actions">
            <button class="icon-btn edit-btn" title="Edit habit" aria-label="Edit ${escapeHtml(h.name)}">✏️</button>
            <button class="icon-btn danger delete-btn" title="Delete habit" aria-label="Delete ${escapeHtml(h.name)}">🗑️</button>
          </div>
        </div>
        <div class="week-dots">${dots}</div>
        <button class="complete-btn${done ? " done" : ""}">
          ${done ? "✓ Done today — tap to undo" : "Mark done for today"}
        </button>
      </article>`;
    })
    .join("");
}

function renderWeekChart() {
  const chart = $("weekChart");
  const sub = $("weekSub");
  const week = lastNDays(7);
  const today = todayKey();

  if (!habits.length) {
    chart.innerHTML = `<div class="chart-empty">Add a habit to see your weekly progress 📈</div>`;
    sub.textContent = "";
    return;
  }

  const total = habits.length;
  const counts = week.map((d) => {
    const k = dateKey(d);
    return habits.reduce((n, h) => n + (isCompletedOn(h, k) ? 1 : 0), 0);
  });
  const maxCount = Math.max(...counts);

  chart.innerHTML = counts
    .map((c, i) => {
      const d = week[i];
      const isToday = dateKey(d) === today;
      const pct = Math.round((c / total) * 100);
      return `<div class="chart-col${isToday ? " today" : ""}" title="${DOW_FULL[d.getDay()]}: ${c} of ${total} habits (${pct}%)">
        <span class="chart-value">${c}</span>
        <div class="chart-bar" style="height:${Math.max(pct, 6)}%"></div>
        <span class="chart-label">${DOW_SHORT[d.getDay()]}</span>
      </div>`;
    })
    .join("");

  if (maxCount === 0) {
    sub.textContent = "No completions yet this week — you've got this! 💪";
  } else {
    const bestDay = week[counts.indexOf(maxCount)];
    sub.textContent = `${computeStats().weekDone} completions over the last 7 days · best day: ${DOW_FULL[bestDay.getDay()]} (${maxCount})`;
  }
}

function renderCalendar() {
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  $("calTitle").textContent = `${MONTHS[m]} ${y}`;

  const today = todayKey();
  const first = new Date(y, m, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  let html = DOW_MON.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < offset; i++) html += `<div class="cal-day blank"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const key = dateKey(new Date(y, m, d));
    const done = habits.filter((h) => isCompletedOn(h, key));
    const ratio = habits.length ? done.length / habits.length : 0;
    const lvl = ratio === 0 ? "" : ratio <= 0.34 ? " lvl-1" : ratio <= 0.67 ? " lvl-2" : " lvl-3";
    const isToday = key === today;
    const isFuture = key > today;
    const isSelected = key === selectedDay;
    const emojis = done.slice(0, 3).map((h) => h.emoji).join("");
    const more = done.length > 3 ? `+${done.length - 3}` : "";
    const tip = done.length
      ? `${done.length} completed: ${done.map((h) => h.name).join(", ")}`
      : "Nothing completed";
    html += `<div class="cal-day${lvl}${isToday ? " today" : ""}${isFuture ? " future" : ""}${isSelected ? " selected" : ""}" data-key="${key}" title="${escapeHtml(tip)}">
      <span>${d}</span>
      <span class="cal-emojis">${emojis}${more}</span>
    </div>`;
  }

  $("calGrid").innerHTML = html;
}

function renderDayDetail() {
  const el = $("dayDetail");
  if (!selectedDay) {
    el.innerHTML = `<p class="day-detail-hint">👆 Click a day to see which habits you completed.</p>`;
    return;
  }
  const date = parseKey(selectedDay);
  const done = habits.filter((h) => isCompletedOn(h, selectedDay));
  const label = `${DOW_FULL[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;

  if (!done.length) {
    el.innerHTML = `<h4>${label}</h4><p class="day-detail-hint">${habits.length ? "No habits completed on this day." : "You had no habits yet."}</p>`;
    return;
  }
  el.innerHTML = `<h4>${label} — ${done.length} completed</h4>
    <ul>${done.map((h) => `<li><span>${h.emoji}</span><span>${escapeHtml(h.name)}</span></li>`).join("")}</ul>`;
}

/* ---------------- emoji pickers ---------------- */

function buildEmojiRow(container, input) {
  container.innerHTML = "";
  EMOJI_CHOICES.forEach((e) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emoji-choice";
    b.textContent = e;
    b.addEventListener("click", () => {
      input.value = e;
      markSelectedEmoji(container, e);
    });
    container.appendChild(b);
  });
}

function markSelectedEmoji(container, emoji) {
  container.querySelectorAll(".emoji-choice").forEach((b) => {
    b.classList.toggle("selected", b.textContent === emoji);
  });
}

/* ---------------- modals / toasts / confetti ---------------- */

function closeModal(id) {
  $(id).hidden = true;
}

function openEdit(id) {
  const h = habits.find((x) => x.id === id);
  if (!h) return;
  editingId = id;
  $("editName").value = h.name;
  $("editEmoji").value = h.emoji;
  $("editError").textContent = "";
  markSelectedEmoji($("editEmojiRow"), h.emoji);
  $("editModal").hidden = false;
  $("editName").focus();
}

function openConfirmDelete(id) {
  const h = habits.find((x) => x.id === id);
  if (!h) return;
  pendingDeleteId = id;
  $("confirmText").textContent = `“${h.name}” and its completion history will be permanently removed.`;
  $("confirmModal").hidden = false;
}

function toast(msg, kind) {
  const wrap = $("toastWrap");
  const t = document.createElement("div");
  t.className = "toast" + (kind === "error" ? " error" : "");
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => {
    t.classList.add("hide");
    setTimeout(() => t.remove(), 350);
  }, 2600);
}

function celebrate() {
  const wrap = $("confettiWrap");
  const emojis = ["🎉", "✨", "🌸", "💜", "🌺", "⭐"];
  for (let i = 0; i < 28; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    s.style.left = Math.random() * 100 + "vw";
    s.style.animationDuration = 2.2 + Math.random() * 2 + "s";
    s.style.animationDelay = Math.random() * 0.4 + "s";
    s.style.fontSize = 0.9 + Math.random() * 1.1 + "rem";
    wrap.appendChild(s);
    setTimeout(() => s.remove(), 5200);
  }
}

/* ---------------- events & init ---------------- */

function setupListeners() {
  // Add habit form
  $("addForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nameEl = $("habitName");
    const errEl = $("formError");
    errEl.textContent = "";
    nameEl.classList.remove("invalid");
    const res = addHabit(nameEl.value, $("habitEmoji").value);
    if (!res.ok) {
      errEl.textContent = res.error;
      nameEl.classList.add("invalid");
      nameEl.focus();
      return;
    }
    toast(`${res.habit.emoji} “${res.habit.name}” added — let's go!`);
    nameEl.value = "";
    $("habitEmoji").value = "";
    markSelectedEmoji($("emojiRow"), "");
    nameEl.focus();
  });

  // Keep emoji picker selection in sync when typing a custom emoji
  $("habitEmoji").addEventListener("input", () => {
    markSelectedEmoji($("emojiRow"), $("habitEmoji").value.trim());
  });

  // Habit card actions (event delegation)
  $("habitsGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".habit-card");
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest(".complete-btn")) toggleToday(id);
    else if (e.target.closest(".edit-btn")) openEdit(id);
    else if (e.target.closest(".delete-btn")) openConfirmDelete(id);
  });

  // Calendar navigation
  $("calPrev").addEventListener("click", () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() - 1, 1);
    renderCalendar();
    renderDayDetail();
  });
  $("calNext").addEventListener("click", () => {
    calCursor = new Date(calCursor.getFullYear(), calCursor.getMonth() + 1, 1);
    renderCalendar();
    renderDayDetail();
  });

  // Calendar day selection
  $("calGrid").addEventListener("click", (e) => {
    const cell = e.target.closest(".cal-day");
    if (!cell || cell.classList.contains("blank") || cell.classList.contains("future")) return;
    selectedDay = cell.dataset.key;
    renderCalendar();
    renderDayDetail();
  });

  // Edit modal
  $("editSave").addEventListener("click", () => {
    const nameEl = $("editName");
    const errEl = $("editError");
    errEl.textContent = "";
    nameEl.classList.remove("invalid");
    const res = updateHabit(editingId, nameEl.value, $("editEmoji").value);
    if (!res.ok) {
      errEl.textContent = res.error;
      nameEl.classList.add("invalid");
      return;
    }
    closeModal("editModal");
    toast("Habit updated ✓");
  });
  $("editCancel").addEventListener("click", () => closeModal("editModal"));
  $("editEmoji").addEventListener("input", () => {
    markSelectedEmoji($("editEmojiRow"), $("editEmoji").value.trim());
  });

  // Delete confirmation
  $("confirmDelete").addEventListener("click", () => {
    deleteHabit(pendingDeleteId);
    pendingDeleteId = null;
    closeModal("confirmModal");
  });
  $("confirmCancel").addEventListener("click", () => {
    pendingDeleteId = null;
    closeModal("confirmModal");
  });

  // Close modals via backdrop click or Escape
  ["editModal", "confirmModal"].forEach((id) => {
    $(id).addEventListener("click", (e) => {
      if (e.target === $(id)) closeModal(id);
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("editModal");
      closeModal("confirmModal");
    }
  });
}

function init() {
  load();
  buildEmojiRow($("emojiRow"), $("habitEmoji"));
  buildEmojiRow($("editEmojiRow"), $("editEmoji"));
  setupListeners();
  renderAll();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

/* Exported for automated testing (ignored in the browser). */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    addHabit,
    toggleToday,
    updateHabit,
    deleteHabit,
    load,
    save,
    init,
    renderAll,
    getStreak,
    getBestStreak,
    computeStats,
    normalizeEmoji,
    dateKey,
    addDays,
    todayKey,
    parseKey,
    STORAGE_KEY,
    getHabits: () => habits,
  };
}
