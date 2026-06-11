const MODES = {
  focus: { label: 'Focus Sprint', minutes: 25, caption: 'Ready when you are. Your drink is empty and full of potential.' },
  short: { label: 'Cafe Break', minutes: 5, caption: 'A tiny break counts. Stretch, water, breathe, return gently.' },
  long: { label: 'Deep Work Roast', minutes: 50, caption: 'Big cozy sprint. Kiwi will guard the door from chaos goblins.' }
};

const DRINK_LINES = {
  matcha: 'Matcha Cloud selected. Calm academic forest creature mode engaged.',
  boba: 'Mango Boba selected. Sweet momentum, chewy little victory pearls.',
  latte: 'Cozy Latte selected. Soft grind, warm brain, no panic foam.',
  tea: 'Peach Tea selected. Gentle reset energy with a tiny porcelain crown.'
};

const SUGGESTIONS = [
  'Review one lecture slide section, not the whole universe.',
  'Do three practice questions and check the answer key.',
  'Rewrite one confusing concept in your own words.',
  'Make a tiny formula sheet for one topic.',
  'Read for 10 minutes, then write a 3-bullet summary.',
  'Clean up one assignment file name and submit/download/check it.'
];

const STICKERS = ['🥐', '🍓', '🍵', '🧋', '🥭', '🐈', '✨', '🍰', '☕', '🌸'];
const STORAGE_KEY = 'study_sprint_cafe_state_v1';

let state = {
  mode: 'focus',
  selectedDrink: 'matcha',
  remainingSeconds: MODES.focus.minutes * 60,
  running: false,
  startedAt: null,
  currentGoal: '',
  sessions: 0,
  minutesFocused: 0,
  stickers: [],
  log: []
};

let tickHandle = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') {
      state = { ...state, ...saved, running: false, startedAt: null };
      if (!MODES[state.mode]) state.mode = 'focus';
      if (!DRINK_LINES[state.selectedDrink]) state.selectedDrink = 'matcha';
      if (!Number.isFinite(state.remainingSeconds) || state.remainingSeconds <= 0) {
        state.remainingSeconds = MODES[state.mode].minutes * 60;
      }
      state.stickers = Array.isArray(state.stickers) ? state.stickers : [];
      state.log = Array.isArray(state.log) ? state.log.slice(0, 8) : [];
    }
  } catch (error) {
    console.warn('Could not load cafe state', error);
  }
}

function saveState() {
  const snapshot = { ...state, running: false, startedAt: null };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function $(id) {
  return document.getElementById(id);
}

function formatTime(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60).toString().padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getProgressPercent() {
  const total = MODES[state.mode].minutes * 60;
  return Math.min(100, Math.max(0, ((total - state.remainingSeconds) / total) * 100));
}

function setKiwiLine(message) {
  $('kiwi-line').innerHTML = `<strong>Kiwi:</strong> ${message}`;
}

function renderStamps() {
  const stampCard = $('stamp-card');
  stampCard.innerHTML = '';
  const filled = state.sessions % 10;
  for (let i = 0; i < 10; i += 1) {
    const stamp = document.createElement('div');
    stamp.className = `stamp ${i < filled || (filled === 0 && state.sessions > 0) ? 'filled' : ''}`;
    stamp.textContent = i < filled || (filled === 0 && state.sessions > 0) ? '✓' : i + 1;
    stampCard.appendChild(stamp);
  }
}

function renderStickers() {
  const shelf = $('sticker-shelf');
  shelf.innerHTML = '';
  if (state.stickers.length === 0) {
    shelf.innerHTML = '<span style="color: var(--muted); font-size: 0.9rem;">Finish a sprint to earn your first cafe sticker.</span>';
    return;
  }
  state.stickers.slice(-12).forEach(sticker => {
    const el = document.createElement('span');
    el.className = 'sticker';
    el.textContent = sticker;
    shelf.appendChild(el);
  });
}

function renderLog() {
  const log = $('cafe-log');
  log.innerHTML = '';
  if (state.log.length === 0) {
    const item = document.createElement('li');
    item.innerHTML = '<strong>No wins logged yet.</strong> Start a sprint and the cafe will remember it.';
    log.appendChild(item);
    return;
  }
  state.log.forEach(entry => {
    const item = document.createElement('li');
    item.innerHTML = `<strong>${entry.title}</strong><br>${entry.detail}`;
    log.appendChild(item);
  });
}

function render() {
  const mode = MODES[state.mode];
  document.body.dataset.drink = state.selectedDrink;
  $('timer-heading').textContent = mode.label;
  $('mode-badge').textContent = `${mode.minutes} min`;
  $('timer-display').textContent = formatTime(state.remainingSeconds);
  $('timer-caption').textContent = state.running ? 'Sprint in progress. Your drink is filling — keep going, tiny cafe champion.' : mode.caption;
  $('drink-fill').style.height = `${getProgressPercent()}%`;
  $('start-pause-btn').textContent = state.running ? 'Pause' : 'Start Sprint';
  $('goal-input').value = state.currentGoal;
  $('goal-ticket').textContent = state.currentGoal ? `Order ticket: ${state.currentGoal}` : 'No order yet — choose one tiny study target.';
  $('session-count').textContent = state.sessions;
  $('minutes-focused').textContent = state.minutesFocused;
  $('sticker-count').textContent = state.stickers.length;

  document.querySelectorAll('.mode-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  });
  document.querySelectorAll('.drink-option').forEach(button => {
    const active = button.dataset.drink === state.selectedDrink;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  renderStamps();
  renderStickers();
  renderLog();
}

function setMode(modeName) {
  if (!MODES[modeName]) return;
  stopTimer();
  state.mode = modeName;
  state.remainingSeconds = MODES[modeName].minutes * 60;
  setKiwiLine(`${MODES[modeName].label} queued. I have prepared one tiny motivational napkin.`);
  saveState();
  render();
}

function setDrink(drinkName) {
  if (!DRINK_LINES[drinkName]) return;
  state.selectedDrink = drinkName;
  setKiwiLine(DRINK_LINES[drinkName]);
  saveState();
  render();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();
  tickHandle = setInterval(tick, 1000);
  setKiwiLine('Timer started. I am wearing my most serious little apron.');
  render();
}

function stopTimer() {
  state.running = false;
  state.startedAt = null;
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

function pauseTimer() {
  if (!state.running) return;
  stopTimer();
  setKiwiLine('Paused. No guilt allowed in this cafe.');
  saveState();
  render();
}

function toggleTimer() {
  if (state.running) pauseTimer();
  else startTimer();
}

function resetTimer() {
  stopTimer();
  state.remainingSeconds = MODES[state.mode].minutes * 60;
  setKiwiLine('Reset complete. Fresh cup, fresh vibes.');
  saveState();
  render();
}

function tick() {
  if (!state.running) return;
  state.remainingSeconds -= 1;
  if (state.remainingSeconds <= 0) {
    completeSprint();
    return;
  }
  render();
}

function completeSprint() {
  const mode = MODES[state.mode];
  stopTimer();
  state.remainingSeconds = mode.minutes * 60;
  state.sessions += 1;
  state.minutesFocused += mode.minutes;
  const sticker = STICKERS[(state.sessions - 1) % STICKERS.length];
  state.stickers.push(sticker);
  const goal = state.currentGoal || 'mystery study quest';
  state.log.unshift({
    title: `${sticker} ${mode.label} complete`,
    detail: `${mode.minutes} minutes for “${goal}”. Kiwi stamped the loyalty card with great ceremony.`
  });
  state.log = state.log.slice(0, 8);
  setKiwiLine(`Sprint complete! You earned ${sticker}. Please accept one tiny forehead bonk of academic approval.`);
  saveState();
  render();
}

function saveGoal() {
  state.currentGoal = $('goal-input').value.trim();
  setKiwiLine(state.currentGoal ? `Order ticket saved: “${state.currentGoal}”.` : 'Blank ticket saved. Mysterious, but valid.');
  saveState();
  render();
}

function suggestTinyGoal() {
  const next = SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
  $('goal-input').value = next;
  state.currentGoal = next;
  setKiwiLine('I suggested a tiny goal. It is legally small enough to begin.');
  saveState();
  render();
}

function clearLog() {
  state.log = [];
  setKiwiLine('Cafe log cleared. The emotional crumbs remain, but privately.');
  saveState();
  render();
}

function bindEvents() {
  document.querySelectorAll('.mode-btn').forEach(button => {
    button.addEventListener('click', () => setMode(button.dataset.mode));
  });
  document.querySelectorAll('.drink-option').forEach(button => {
    button.addEventListener('click', () => setDrink(button.dataset.drink));
  });
  $('start-pause-btn').addEventListener('click', toggleTimer);
  $('reset-btn').addEventListener('click', resetTimer);
  $('save-goal-btn').addEventListener('click', saveGoal);
  $('tiny-suggestion-btn').addEventListener('click', suggestTinyGoal);
  $('clear-log-btn').addEventListener('click', clearLog);
  $('goal-input').addEventListener('keydown', event => {
    if (event.key === 'Enter') saveGoal();
  });
}

function init() {
  loadState();
  bindEvents();
  render();
  setKiwiLine(DRINK_LINES[state.selectedDrink]);
}

if (typeof window !== 'undefined') {
  window.StudySprintCafe = {
    get state() { return state; },
    MODES,
    formatTime,
    getProgressPercent,
    setMode,
    setDrink,
    startTimer,
    pauseTimer,
    resetTimer,
    completeSprint,
    saveGoal,
    suggestTinyGoal,
    clearLog,
    init
  };
  window.addEventListener('DOMContentLoaded', init);
}
