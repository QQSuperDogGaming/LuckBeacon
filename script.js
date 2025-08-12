/* 
  You’ll learn 3 things:
  1) Fair randomness with crypto.getRandomValues
  2) Animation+logic sync (promise-based)
  3) Tiny state machine with localStorage + CSV export
*/

const $ = sel => document.querySelector(sel);
const coin = $('#coin');
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

// --- state ---
const state = {
  heads: 0,
  tails: 0,
  history: [], // newest first for reversed <ol>
  streak: { side: null, len: 0, best: { side: null, len: 0 } },
  loaded: false,
  bias: 0.5, // heads probability
};

// load from localStorage if available
(function hydrate() {
  const raw = localStorage.getItem('coinlab');
  if (raw) {
    try {
      const s = JSON.parse(raw);
      Object.assign(state, s);
      renderAll();
    } catch {}
  }
  loadedToggle.checked = state.loaded;
  biasSlider.value = Math.round(state.bias * 100);
  biasVal.textContent = `${Math.round(state.bias * 100)}%`;
})();

function persist() {
  localStorage.setItem('coinlab', JSON.stringify(state));
}

function updateStats(side) {
  if (side === 'heads') state.heads++;
  else state.tails++;

  // streaks
  if (state.streak.side === side) {
    state.streak.len++;
  } else {
    state.streak.side = side;
    state.streak.len = 1;
  }
  if (state.streak.len > state.streak.best.len) {
    state.streak.best = { side, len: state.streak.len };
  }

  // history (newest first)
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

  const pct = total ? Math.round((state.heads / total) * 100) : 0;
  headsPctEl.textContent = `${pct}%`;

  if (state.streak.best.len) {
    streakEl.textContent = `${state.streak.best.len}× ${state.streak.best.side.toUpperCase()}`;
  } else {
    streakEl.textContent = '—';
  }

  // render last 20
  historyEl.innerHTML = '';
  state.history.slice(0, 20).forEach((h, i) => {
    const li = document.createElement('li');
    const time = new Date(h.t).toLocaleTimeString();
    li.innerHTML = `<strong>${h.side.toUpperCase()}</strong> <small>${time}</small>`;
    historyEl.appendChild(li);
  });
}

function fairCoin() {
  // crypto-safe unbiased bit
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  // Use the highest bit to get ~50/50 without modulo bias
  const bit = (buf[0] & 0b10000000) >>> 7;
  return bit ? 'heads' : 'tails';
}

function loadedCoin(probHeads) {
  // probHeads in [0,1]
  const v = crypto.getRandomValues(new Uint32Array(1))[0] / 2**32;
  return v < probHeads ? 'heads' : 'tails';
}

function flipOnce() {
  const side = state.loaded ? loadedCoin(state.bias) : fairCoin();
  return animateTo(side).then(() => {
    updateStats(side);
    resultEl.textContent = side.toUpperCase();
    return side;
  });
}

function animateTo(side) {
  // add a flipping animation and finish on the correct face
  return new Promise(resolve => {
    coin.classList.remove('flip');
    // force style recalc to allow re-triggering the animation
    void coin.offsetWidth;

    coin.classList.add('flip');

    // set the final transform to show the chosen face
    // we’ll wait for the animation to end
    const onEnd = () => {
      coin.classList.remove('flip');
      // show matching face by final rotation
      coin.style.transform = side === 'heads'
        ? 'rotateY(0deg)'
        : 'rotateY(180deg)';
      coin.removeEventListener('animationend', onEnd);
      resolve();
    };
    coin.addEventListener('animationend', onEnd);
  });
}

// --- events ---
flipBtn.addEventListener('click', flipOnce);
multiBtn.addEventListener('click', async () => {
  for (let i = 0; i < 10; i++) {
    // small pause so you actually see multiple flips
    /* eslint-disable no-await-in-loop */
    await flipOnce();
    await wait(120);
  }
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); flipOnce(); }
  if (e.code === 'Enter') { e.preventDefault(); multiBtn.click(); }
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset all stats and history?')) return;
  Object.assign(state, {
    heads: 0, tails: 0, history: [],
    streak: { side: null, len: 0, best: { side: null, len: 0 } }
  });
  persist();
  renderAll();
  resultEl.textContent = '—';
});

exportBtn.addEventListener('click', () => {
  const rows = [
    ['timestamp', 'iso', 'result'],
    ...state.history.map(h => [h.t, new Date(h.t).toISOString(), h.side]),
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'coin_history.csv';
  document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
});

// Web Share API if available
if (navigator.share) {
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async e => {
    e.preventDefault();
    const total = state.heads + state.tails;
    const txt = `I flipped ${total} times: ${state.heads} heads, ${state.tails} tails.`;
    try { await navigator.share({ title: 'Coin Flip Lab', text: txt }); }
    catch {}
  });
}

// Loaded mode controls
loadedToggle.addEventListener('change', e => {
  state.loaded = e.target.checked;
  persist();
});

biasSlider.addEventListener('input', e => {
  const pct = Number(e.target.value);
  state.bias = pct / 100;
  biasVal.textContent = `${pct}%`;
  persist();
});

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// first paint orientation (faces align to default)
coin.style.transform = 'rotateY(0deg)';
