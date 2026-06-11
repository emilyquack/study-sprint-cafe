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
const LOYALTY_CARD_SIZE = 10;
const LOYALTY_REWARDS = ['Free cozy refill', 'Tiny cake coupon', 'Golden mango stamp', 'VIP window seat'];
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
  loyaltyCards: 0,
  log: []
};

let tickHandle = null;
let mascotAction = 'idle';
let mascotActionHandle = null;
let completionAudio = null;

const MASCOT_ACTION_LABELS = {
  idle: 'Barista apron on. Ready to make your drink.',
  prep: 'Tiny paws are measuring syrup and fluffing foam.',
  making: 'Kiwi is actively making your drink while you focus.',
  pour: 'Pouring a tiny victory drink with dramatic cafe flair.',
  celebrate: 'Order complete! Kiwi is doing a barista victory wiggle.'
};

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
      state.loyaltyCards = Number.isFinite(state.loyaltyCards)
        ? state.loyaltyCards
        : Math.floor((Number(state.sessions) || 0) / LOYALTY_CARD_SIZE);
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

function setMascotAction(action = 'idle', duration = 0) {
  mascotAction = MASCOT_ACTION_LABELS[action] ? action : 'idle';
  if (mascotActionHandle) clearTimeout(mascotActionHandle);
  mascotActionHandle = null;
  if (duration > 0) {
    mascotActionHandle = setTimeout(() => {
      mascotAction = state.running ? 'making' : 'idle';
      mascotActionHandle = null;
      render();
    }, duration);
  }
}

function getMascotActionLabel() {
  return MASCOT_ACTION_LABELS[mascotAction === 'idle' && state.running ? 'making' : mascotAction];
}

function getCompletionAudio() {
  const AudioCtx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AudioCtx) return null;
  if (!completionAudio) completionAudio = new AudioCtx();
  if (completionAudio.state === 'suspended' && typeof completionAudio.resume === 'function') {
    completionAudio.resume().catch(() => {});
  }
  return completionAudio;
}

function unlockCompletionChime() {
  try {
    getCompletionAudio();
  } catch (error) {
    console.warn('Completion chime could not unlock', error);
  }
}

function playCompletionChime() {
  try {
    const audio = getCompletionAudio();
    if (!audio) return;
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.13, now + 0.04);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
    master.connect(audio.destination);

    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const start = now + index * 0.18;
      const osc = audio.createOscillator();
      const noteGain = audio.createGain();
      osc.type = index === 3 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(frequency, start);
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(0.18, start + 0.035);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.78);
      osc.connect(noteGain).connect(master);
      osc.start(start);
      osc.stop(start + 0.9);
    });
  } catch (error) {
    console.warn('Completion chime could not play', error);
  }
}

function getStampCount() {
  return state.sessions % LOYALTY_CARD_SIZE;
}

function getLoyaltyReward(cardNumber = state.loyaltyCards + 1) {
  return LOYALTY_REWARDS[(cardNumber - 1) % LOYALTY_REWARDS.length];
}

function renderStamps() {
  const stampCard = $('stamp-card');
  stampCard.innerHTML = '';
  const filled = getStampCount();
  for (let i = 0; i < LOYALTY_CARD_SIZE; i += 1) {
    const stamp = document.createElement('div');
    const isFilled = i < filled;
    stamp.className = `stamp ${isFilled ? 'filled' : ''}`;
    stamp.textContent = isFilled ? '✓' : i + 1;
    stampCard.appendChild(stamp);
  }
}

function renderLoyaltyMessage() {
  const message = $('loyalty-message');
  const stamps = getStampCount();
  if (state.sessions > 0 && stamps === 0) {
    const reward = getLoyaltyReward(state.loyaltyCards || Math.floor(state.sessions / LOYALTY_CARD_SIZE));
    message.className = 'loyalty-message complete';
    message.textContent = `Loyalty card complete! Kiwi served a ${reward}. New 10-stamp card started.`;
    return;
  }
  message.className = 'loyalty-message';
  message.textContent = `${stamps}/${LOYALTY_CARD_SIZE} stamps on this card. ${LOYALTY_CARD_SIZE - stamps} more until a tiny cafe reward.`;
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
  const progress = getProgressPercent();
  const activeMascotAction = mascotAction === 'idle' && state.running ? 'making' : mascotAction;
  document.body.dataset.drink = state.selectedDrink;
  document.body.dataset.making = activeMascotAction;
  $('timer-heading').textContent = mode.label;
  $('mode-badge').textContent = `${mode.minutes} min`;
  $('timer-display').textContent = formatTime(state.remainingSeconds);
  $('timer-caption').textContent = state.running ? 'Sprint in progress. Your drink is filling — keep going, tiny cafe champion.' : mode.caption;
  $('drink-fill').style.height = `${progress}%`;
  $('mascot-drink-fill').style.height = `${progress}%`;
  $('mascot-action-label').textContent = getMascotActionLabel();
  $('start-pause-btn').textContent = state.running ? 'Pause' : 'Start Sprint';
  $('goal-input').value = state.currentGoal;
  $('goal-ticket').textContent = state.currentGoal ? `Order ticket: ${state.currentGoal}` : 'No order yet — choose one tiny study target.';
  $('session-count').textContent = state.sessions;
  $('minutes-focused').textContent = state.minutesFocused;
  $('sticker-count').textContent = state.stickers.length;
  $('treat-count').textContent = state.loyaltyCards;

  document.querySelectorAll('.mode-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === state.mode);
  });
  document.querySelectorAll('.drink-option').forEach(button => {
    const active = button.dataset.drink === state.selectedDrink;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });

  renderStamps();
  renderLoyaltyMessage();
  renderStickers();
  renderLog();
}

function setMode(modeName) {
  if (!MODES[modeName]) return;
  stopTimer();
  setMascotAction('idle');
  state.mode = modeName;
  state.remainingSeconds = MODES[modeName].minutes * 60;
  setKiwiLine(`${MODES[modeName].label} queued. I have prepared one tiny motivational napkin.`);
  saveState();
  render();
}

function setDrink(drinkName) {
  if (!DRINK_LINES[drinkName]) return;
  state.selectedDrink = drinkName;
  setMascotAction('prep', 1600);
  setKiwiLine(`${DRINK_LINES[drinkName]} Apron tied, tiny paws prepping the order.`);
  saveState();
  render();
}

function startTimer() {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();
  unlockCompletionChime();
  tickHandle = setInterval(tick, 1000);
  setMascotAction('making');
  setKiwiLine('Timer started. Apron tied. I am making your drink with extremely serious tiny paws.');
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
  setMascotAction('idle');
  setKiwiLine('Paused. Kiwi sets the pitcher down gently. No guilt allowed in this cafe.');
  saveState();
  render();
}

function toggleTimer() {
  if (state.running) pauseTimer();
  else startTimer();
}

function resetTimer() {
  stopTimer();
  setMascotAction('idle');
  state.remainingSeconds = MODES[state.mode].minutes * 60;
  setKiwiLine('Reset complete. Fresh cup, fresh vibes, apron still adorable.');
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
  playCompletionChime();
  setMascotAction('celebrate', 2600);
  state.remainingSeconds = mode.minutes * 60;
  state.sessions += 1;
  state.minutesFocused += mode.minutes;
  const completedLoyaltyCard = state.sessions % LOYALTY_CARD_SIZE === 0;
  const sticker = STICKERS[(state.sessions - 1) % STICKERS.length];
  state.stickers.push(sticker);
  const goal = state.currentGoal || 'mystery study quest';

  if (completedLoyaltyCard) {
    state.loyaltyCards += 1;
    const reward = getLoyaltyReward(state.loyaltyCards);
    state.stickers.push('🎟️');
    state.log.unshift({
      title: `🎟️ Loyalty card ${state.loyaltyCards} complete`,
      detail: `10/10 stamps! Kiwi awarded a ${reward}, reset the card, and slid over a fresh blank one.`
    });
    setKiwiLine(`Loyalty card complete! Chill chime played. You earned a ${reward}, and Kiwi reset your stamp card for the next round.`);
  } else {
    state.log.unshift({
      title: `${sticker} ${mode.label} complete`,
      detail: `${mode.minutes} minutes for “${goal}”. Kiwi stamped the loyalty card with great ceremony. ${getStampCount()}/${LOYALTY_CARD_SIZE} stamps filled.`
    });
    setKiwiLine(`Sprint complete! Chill chime played. You earned ${sticker}. ${getStampCount()}/${LOYALTY_CARD_SIZE} loyalty stamps filled.`);
  }
  state.log = state.log.slice(0, 8);
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
    LOYALTY_CARD_SIZE,
    formatTime,
    getProgressPercent,
    getStampCount,
    unlockCompletionChime,
    playCompletionChime,
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
