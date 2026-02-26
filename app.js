const STORAGE_KEY = 'prop-firm-control-v1';

const CONFIG = {
  initialBalance: 5000,
  fixedRisk: 25,
  rewardPerWin: 50,
  lossPerLoss: 25,
  minRR: 2,
  maxDailyLoss: 250,
  maxTotalLoss: 500,
  leverage: '1:100',
  stages: {
    1: { targetProfit: 400, minTradingDays: 5 },
    2: { targetProfit: 250, minTradingDays: 5 }
  }
};

const $ = (id) => document.getElementById(id);

const elements = {
  stageSelector: $('stageSelector'),
  startEvaluationBtn: $('startEvaluationBtn'),
  setupStatus: $('setupStatus'),
  tradeNumber: $('tradeNumber'),
  screenshot: $('screenshot'),
  entryPrice: $('entryPrice'),
  stopPrice: $('stopPrice'),
  targetPrice: $('targetPrice'),
  riskAmount: $('riskAmount'),
  rrValue: $('rrValue'),
  validationMessage: $('validationMessage'),
  confirmTradeBtn: $('confirmTradeBtn'),
  activeTradeStatus: $('activeTradeStatus'),
  winBtn: $('winBtn'),
  lossBtn: $('lossBtn'),
  statsGrid: $('statsGrid'),
  targetProgress: $('targetProgress'),
  progressText: $('progressText'),
  lockNotice: $('lockNotice'),
  tradeLog: $('tradeLog')
};

let state = loadState();

function defaultState() {
  return {
    initialized: false,
    stage: null,
    startedAt: null,
    equity: CONFIG.initialBalance,
    tradeCounter: 0,
    wins: 0,
    losses: 0,
    activeTrade: null,
    trades: [],
    dailyLossByDate: {},
    tradingDays: [],
    dayLockedDates: [],
    accountLocked: false
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(raw) };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function stageConfig() {
  return CONFIG.stages[state.stage] || CONFIG.stages[1];
}

function totalDrawdownUsed() {
  return Math.max(0, CONFIG.initialBalance - state.equity);
}

function dailyLossUsed(dateKey = getTodayKey()) {
  return state.dailyLossByDate[dateKey] || 0;
}

function remainingDailyBuffer() {
  return Math.max(0, CONFIG.maxDailyLoss - dailyLossUsed());
}

function remainingTotalBuffer() {
  return Math.max(0, CONFIG.maxTotalLoss - totalDrawdownUsed());
}

function targetEquity() {
  return CONFIG.initialBalance + stageConfig().targetProfit;
}

function remainingToTarget() {
  return Math.max(0, targetEquity() - state.equity);
}

function isDayLocked() {
  return state.dayLockedDates.includes(getTodayKey()) || remainingDailyBuffer() < CONFIG.fixedRisk;
}

function evaluationPassed() {
  return state.equity >= targetEquity() && state.tradingDays.length >= stageConfig().minTradingDays;
}

function updateSetupUI() {
  if (!state.initialized) {
    elements.stageSelector.disabled = false;
    elements.startEvaluationBtn.disabled = false;
    elements.setupStatus.textContent = 'Evaluation not started.';
    elements.setupStatus.className = 'note';
    return;
  }

  elements.stageSelector.value = String(state.stage);
  elements.stageSelector.disabled = true;
  elements.startEvaluationBtn.disabled = true;
  elements.setupStatus.textContent = `Evaluation started on ${new Date(state.startedAt).toLocaleString()} — Stage ${state.stage} locked.`;
  elements.setupStatus.className = 'note good';
}

function validateTradeEntry() {
  if (!state.initialized) {
    return { ok: false, message: 'Start evaluation first.' };
  }
  if (state.accountLocked) {
    return { ok: false, message: 'Account permanently locked (total loss limit hit).' };
  }
  if (evaluationPassed()) {
    return { ok: false, message: 'Stage already passed. Trading disabled.' };
  }
  if (state.activeTrade) {
    return { ok: false, message: 'Resolve active trade result first.' };
  }
  if (isDayLocked()) {
    return { ok: false, message: 'Daily loss limit reached. Trading locked for today.' };
  }

  const entry = Number(elements.entryPrice.value);
  const stop = Number(elements.stopPrice.value);
  const target = Number(elements.targetPrice.value);

  if (!elements.screenshot.files.length) {
    return { ok: false, message: 'Screenshot upload is mandatory.' };
  }
  if (![entry, stop, target].every((v) => Number.isFinite(v) && v > 0)) {
    return { ok: false, message: 'Entry, stop, and target prices must be valid and > 0.' };
  }
  if (entry === stop || entry === target || stop === target) {
    return { ok: false, message: 'Entry/Stop/Target prices must be distinct.' };
  }

  const riskDistance = Math.abs(entry - stop);
  const rewardDistance = Math.abs(target - entry);
  const rr = rewardDistance / riskDistance;

  if (!Number.isFinite(rr) || rr < CONFIG.minRR) {
    return { ok: false, rr, message: `Trade rejected: RR ${rr.toFixed(2)} is below 1:${CONFIG.minRR}.` };
  }
  if (remainingDailyBuffer() < CONFIG.fixedRisk) {
    return { ok: false, rr, message: 'Trade rejected: daily loss buffer would be violated.' };
  }
  if (remainingTotalBuffer() < CONFIG.fixedRisk) {
    return { ok: false, rr, message: 'Trade rejected: total drawdown buffer would be violated.' };
  }

  return { ok: true, rr, message: 'All checks passed. You may confirm trade.' };
}

function refreshTradeValidationUI() {
  const validation = validateTradeEntry();
  elements.tradeNumber.value = state.initialized ? `#${state.tradeCounter + 1}` : '';
  elements.riskAmount.textContent = `$${CONFIG.fixedRisk.toFixed(2)} (locked)`;
  elements.rrValue.textContent = Number.isFinite(validation.rr) ? `1:${validation.rr.toFixed(2)}` : '-';
  elements.validationMessage.textContent = validation.message;
  elements.validationMessage.className = validation.ok ? 'good' : 'bad';
  elements.confirmTradeBtn.disabled = !validation.ok;
}

function updateTradeResultUI() {
  if (!state.activeTrade) {
    elements.activeTradeStatus.textContent = 'No active trade.';
    elements.winBtn.disabled = true;
    elements.lossBtn.disabled = true;
    return;
  }

  elements.activeTradeStatus.textContent = `Active Trade #${state.activeTrade.id} awaiting result.`;
  elements.winBtn.disabled = false;
  elements.lossBtn.disabled = false;
}

function renderDashboard() {
  const winRate = state.tradeCounter ? (state.wins / state.tradeCounter) * 100 : 0;
  const netR = ((state.wins * 2) - state.losses).toFixed(2);
  const progressPct = ((state.equity - CONFIG.initialBalance) / stageConfig().targetProfit) * 100;
  const boundedProgress = Math.max(0, Math.min(100, progressPct));

  const stats = [
    ['Current Equity', `$${state.equity.toFixed(2)} (${(((state.equity / CONFIG.initialBalance) - 1) * 100).toFixed(2)}%)`],
    ['Remaining $ to Pass Stage', `$${remainingToTarget().toFixed(2)}`],
    ['Remaining $ Before Total Loss Violation', `$${remainingTotalBuffer().toFixed(2)}`],
    ['Remaining $ Before Daily Loss Violation', `$${remainingDailyBuffer().toFixed(2)}`],
    ['Trading Days Completed', `${state.tradingDays.length}/${stageConfig().minTradingDays}`],
    ['Wins / Losses', `${state.wins} / ${state.losses}`],
    ['Win Rate', `${winRate.toFixed(2)}%`],
    ['Net R', `${netR}R`],
    ['Stage', `Stage ${state.stage || '-'} Target: $${stageConfig().targetProfit}`]
  ];

  elements.statsGrid.innerHTML = stats
    .map(([title, value]) => `<article class="stat"><h3>${title}</h3><p>${value}</p></article>`)
    .join('');

  elements.targetProgress.value = boundedProgress;
  elements.progressText.textContent = `${boundedProgress.toFixed(2)}%`;

  if (state.accountLocked) {
    elements.lockNotice.textContent = 'ACCOUNT LOCKED: total loss limit violated.';
    elements.lockNotice.className = 'lock bad';
  } else if (isDayLocked()) {
    elements.lockNotice.textContent = 'DAILY LOCK: max daily loss hit. Trading disabled until next day.';
    elements.lockNotice.className = 'lock warn';
  } else if (evaluationPassed()) {
    elements.lockNotice.textContent = 'STAGE PASSED: target reached and minimum trading days met.';
    elements.lockNotice.className = 'lock good';
  } else {
    elements.lockNotice.textContent = 'Account active.';
    elements.lockNotice.className = 'lock good';
  }
}

function renderTradeLog() {
  if (!state.trades.length) {
    elements.tradeLog.innerHTML = '<p class="note">No trades recorded.</p>';
    return;
  }

  elements.tradeLog.innerHTML = state.trades
    .slice()
    .reverse()
    .map((t) => `
      <div class="log-item">
        <strong>#${t.id}</strong> — ${t.result} — RR ${t.rr.toFixed(2)} — ${t.date}
      </div>
    `)
    .join('');
}

function markTradingDay(dateKey) {
  if (!state.tradingDays.includes(dateKey)) {
    state.tradingDays.push(dateKey);
  }
}

function lockDayIfNeeded(dateKey) {
  if ((state.dailyLossByDate[dateKey] || 0) >= CONFIG.maxDailyLoss && !state.dayLockedDates.includes(dateKey)) {
    state.dayLockedDates.push(dateKey);
  }
}

function registerResult(result) {
  if (!state.activeTrade || state.accountLocked) return;

  const today = getTodayKey();
  markTradingDay(today);

  if (result === 'WIN') {
    state.equity += CONFIG.rewardPerWin;
    state.wins += 1;
  } else {
    state.equity -= CONFIG.lossPerLoss;
    state.losses += 1;
    state.dailyLossByDate[today] = (state.dailyLossByDate[today] || 0) + CONFIG.lossPerLoss;
    lockDayIfNeeded(today);
  }

  if (totalDrawdownUsed() >= CONFIG.maxTotalLoss || state.equity <= CONFIG.initialBalance - CONFIG.maxTotalLoss) {
    state.accountLocked = true;
  }

  state.trades.push({
    ...state.activeTrade,
    result,
    date: new Date().toLocaleString()
  });

  state.activeTrade = null;
  saveState();
  rerender();
}

function confirmTrade() {
  const validation = validateTradeEntry();
  if (!validation.ok) return;

  state.tradeCounter += 1;
  state.activeTrade = {
    id: state.tradeCounter,
    entry: Number(elements.entryPrice.value),
    stop: Number(elements.stopPrice.value),
    target: Number(elements.targetPrice.value),
    rr: validation.rr,
    screenshotName: elements.screenshot.files[0].name
  };

  elements.entryPrice.value = '';
  elements.stopPrice.value = '';
  elements.targetPrice.value = '';
  elements.screenshot.value = '';

  saveState();
  rerender();
}

function startEvaluation() {
  if (state.initialized) return;
  const selectedStage = Number(elements.stageSelector.value);

  state = {
    ...defaultState(),
    initialized: true,
    stage: selectedStage,
    startedAt: Date.now()
  };

  saveState();
  rerender();
}

function attachEvents() {
  elements.startEvaluationBtn.addEventListener('click', startEvaluation);
  elements.confirmTradeBtn.addEventListener('click', confirmTrade);
  elements.winBtn.addEventListener('click', () => registerResult('WIN'));
  elements.lossBtn.addEventListener('click', () => registerResult('LOSS'));

  [elements.screenshot, elements.entryPrice, elements.stopPrice, elements.targetPrice].forEach((el) => {
    el.addEventListener('input', refreshTradeValidationUI);
    el.addEventListener('change', refreshTradeValidationUI);
  });
}

function rerender() {
  updateSetupUI();
  refreshTradeValidationUI();
  updateTradeResultUI();
  renderDashboard();
  renderTradeLog();
}

attachEvents();
rerender();
