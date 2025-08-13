// script.js — your existing app logic, now calling into coin3d.js

import { createCoinScene } from './coin3d.js';

const $ = (s) => document.querySelector(s);
const resultEl = $('#result');
const flipBtn = $('#flipBtn');
const multiBtn = $('#multiBtn');
const headsCountEl = $('#headsCount');
const tailsCountEl = $('#tailsCount');
const totalCountEl = $('#totalCount');
const headsPctEl = $('#headsPct');
const streakEl = $('#streak');
const historyEl = $('#history');
const resetBtn = $('#resetBtn');
const exportBtn = $('#exportBtn');
const shareBtn = $('#shareBtn');
const loadedToggle = $('#loadedToggle');
const biasSlider = $('#bias');
const biasVal = $('#biasVal');

// 3D coin init
const coin3d = createCoinScene($('#coinCanvas'));

// --- state ---
const state = {
  heads: 0,
  tails: 0,
  history: [],
  streak: { side: null, len: 0, best: { side: null, len: 0 } },
  loaded: false,
  bias: 0.5,
};

// hydrate
(function hydrate() {
  const raw = localStorage.getItem('coinlab');
  if (raw) {
    try { Object.assign(state, JSON.parse(raw)); } catch {}
  }
  renderAll();
  loadedToggle.checked = state.loaded;
  biasSlider.value = Math.round(state.bias * 100);
  biasVal.textContent = `${Math.round(state.bias * 100)}%`;

  // set coin pose to last result so UI feels consistent
  const last = state.history[0]?.side ?? 'heads';
  coin3d.setOrientation(last);
})();

function persist() { localStorage.setItem('coinlab', JSON.stringify(state)); }

function updateStats(side) {
  if (side === 'heads') state.heads++; else state.tails++;

  if (state.streak.side === side) state.streak.len++;
  else { state.streak.side = side; state.streak.len = 1; }
  if (state.streak.len > state.streak.best.len) {
    state.streak.best = { side, len: state.streak.len };
  }

  state.history.unshift({ side, t: Date.now() });
  if (state.history.length > 200) state.history.pop();

  persist();
  renderAll();
}

function renderAll() {
  headsCountEl.textContent = state.heads;
  tailsCountEl.textContent = state.tails;
  const total = state.heads + state.tails;
  totalCountEl.textContent = total;
  headsPctEl.textContent = total ? `${Math.round((state.heads / total) * 100)}%` : '0%';

  if (state.streak.best.len) {
    streakEl.textContent = `${state.streak.best.len}× ${state.streak.best.side.toUpperCase()}`;
  } else { streakEl.textContent = '—'; }

  historyEl.innerHTML = '';
  state.history.slice(0, 20).forEach(h => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${h.side.toUpperCase()}</strong> <small>${new Date(h.t).toLocaleTimeString()}</small>`;
    historyEl.appendChild(li);
  });
}

function fairCoin() {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  const bit = (buf[0] & 0b10000000) >>> 7;
  return bit ? 'heads' : 'tails';
}
function loadedCoin(probHeads) {
  const v = crypto.getRandomValues(new Uint32Array(1))[0] / 2**32;
  return v < probHeads ? 'heads' : 'tails';
}

async function flipOnce() {
  const side = state.loaded ? loadedCoin(state.bias) : fairCoin();
  await coin3d.flipTo(side, { spins: 3 + Math.floor(Math.random() * 2), duration: 900 });
  updateStats(side);
  resultEl.textContent = side.toUpperCase();
  return side;
}

// events
flipBtn.addEventListener('click', flipOnce);
multiBtn.addEventListener('click', async () => {
  for (let i = 0; i < 10; i++) { await flipOnce(); await wait(120); }
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); flipOnce(); }
  if (e.code === 'Enter') { e.preventDefault(); multiBtn.click(); }
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset all stats and history?')) return;
  Object.assign(state, { heads: 0, tails: 0, history: [], streak: { side: null, len: 0, best: { side: null, len: 0 } } });
  persist(); renderAll(); resultEl.textContent = '—';
  coin3d.setOrientation('heads');
});

exportBtn.addEventListener('click', () => {
  const rows = [['timestamp','iso','result'], ...state.history.map(h => [h.t, new Date(h.t).toISOString(), h.side])];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'coin_history.csv';
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});

if (navigator.share) {
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async e => {
    e.preventDefault();
    const total = state.heads + state.tails;
    const txt = `I flipped ${total} times: ${state.heads} heads, ${state.tails} tails.`;
    try { await navigator.share({ title: 'Coin Flip Lab', text: txt }); } catch {}
  });
}

loadedToggle.addEventListener('change', e => { state.loaded = e.target.checked; persist(); });
biasSlider.addEventListener('input', e => {
  const pct = Number(e.target.value);
  state.bias = pct / 100; biasVal.textContent = `${pct}%`; persist();
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
