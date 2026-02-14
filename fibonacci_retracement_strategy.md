# Fibonacci Retracement Uptrend Breakout Strategy

## 1) Strategy Objective
Trade pullbacks in a confirmed uptrend after a breakout above the previous day high (PDH), using Fibonacci retracement levels for structured entries, exits, and risk control.

---

## 2) Core Rules (as specified)
1. **Trend filter**: Market must be in an uptrend with a **higher-high (HH)** and **higher-low (HL)** structure.
2. **Swing anchors**: Use **previous day low (PDL)** as swing low and **previous day high (PDH)** as swing high.
3. **Trigger condition**: Wait for current price to **break and close above PDH**.
4. **Fibonacci setup**: After breakout, draw Fibonacci from **swing low (PDL)** to **swing high (PDH)**.
5. **Entry**: Buy at **0.386 retracement** only after bullish confirmation.
6. **Take profit**: Exit at **0.782 level**.
7. **Stop loss**: Place stop **below 0.618 level**.
8. **Risk management**: Risk exactly **1% of account equity** per trade.

---

## 3) Level Calculations
Let:
- `L = PDL` (swing low)
- `H = PDH` (swing high)
- `R = H - L`

### Retracement levels (for pullback entry and stop)
- `fib_0_386 = H - 0.386 * R`
- `fib_0_618 = H - 0.618 * R`

### Profit level interpretation
To keep the logic directionally consistent after a breakout-and-buy setup, treat `0.782` as an **upside Fibonacci extension** from the swing:
- `tp_0_782_ext = H + 0.782 * R`

### Practical placement
- **Entry price**: `fib_0_386` (or limit near it).
- **Stop price**: `fib_0_618 - stop_buffer` (buffer can be ATR fraction or fixed ticks).
- **Take profit**: `tp_0_782_ext`.

> If your platform labels 0.782 only as retracement, map this target to its equivalent extension tool setting so TP remains above entry for long trades.

---

## 4) Bullish Confirmation Definition (example)
At/near 0.386 retracement, require one of:
- A bullish engulfing candle,
- A hammer/pin bar with rejection wick,
- A close back above 0.386 after intrabar dip below,
- Optional momentum filter (e.g., RSI > 50 on entry bar).

This prevents blind limit fills and reduces low-quality pullback entries.

---

## 5) Uptrend Detection Logic
Use recent swing points (e.g., fractal pivots or rolling local extrema):
- Last swing high > prior swing high
- Last swing low > prior swing low

Only allow new entries while this structure remains valid.

---

## 6) Position Sizing (1% risk)
Let:
- `equity = current account equity`
- `risk_pct = 0.01`
- `risk_amount = equity * risk_pct`
- `entry = planned entry price`
- `stop = planned stop price`
- `per_unit_risk = abs(entry - stop)`

Then:
- `position_size_units = risk_amount / per_unit_risk`

For leveraged products, convert units to lots/contracts according to symbol contract size and tick value.

Add safeguards:
- Skip trade if `per_unit_risk <= 0`
- Respect min lot/contract increment
- Enforce max exposure cap if needed

---

## 7) Full End-to-End Logic
1. At start of session/day, record `PDH`, `PDL` from previous day.
2. Continuously evaluate uptrend structure (HH/HL).
3. If not uptrend, do nothing.
4. If uptrend and candle closes above `PDH`, mark breakout confirmed.
5. Compute Fibonacci levels from `PDL -> PDH`.
6. Wait for pullback to 0.386 zone.
7. On bullish confirmation at/near 0.386:
   - Set `entry = fib_0_386`
   - Set `stop = fib_0_618 - buffer`
   - Set `target = tp_0_782_ext`
   - Compute position size so max loss = 1% equity
8. Place order with bracket (entry/SL/TP).
9. Manage trade:
   - Exit at stop or target.
   - Optional: cancel setup if structure breaks (new low invalidates HL).
10. Log results (R multiple, win rate, expectancy).

---

## 8) Pseudocode
```pseudo
INPUTS:
  risk_pct = 0.01
  confirm_type = "bullish_candle"  // configurable
  stop_buffer = instrument_buffer     // ticks/points/ATR fraction

ON_NEW_DAY:
  PDH = previous_day_high
  PDL = previous_day_low
  breakout_confirmed = false
  setup_active = false

ON_EACH_BAR:
  update_swing_points()
  uptrend = (last_swing_high > prev_swing_high) AND (last_swing_low > prev_swing_low)

  IF NOT uptrend:
    breakout_confirmed = false
    setup_active = false
    CONTINUE

  // Step 1: breakout above PDH
  IF close > PDH AND previous_close <= PDH:
    breakout_confirmed = true
    setup_active = true

    L = PDL
    H = PDH
    R = H - L

    fib_0386 = H - 0.386 * R
    fib_0618 = H - 0.618 * R
    tp_0782_ext = H + 0.782 * R

  IF setup_active:
    // Step 2: wait for retracement to entry zone
    touched_entry_zone = (low <= fib_0386 AND high >= fib_0386)

    IF touched_entry_zone:
      bullish_ok = bullish_confirmation(confirm_type)

      IF bullish_ok:
        entry_price = fib_0386
        stop_price = fib_0618 - stop_buffer
        target_price = tp_0782_ext

        per_unit_risk = ABS(entry_price - stop_price)
        IF per_unit_risk <= 0:
          setup_active = false
          CONTINUE

        equity = get_account_equity()
        risk_amount = equity * risk_pct
        size_units = risk_amount / per_unit_risk
        size_units = round_to_lot_step(size_units)

        IF size_units < min_trade_size:
          setup_active = false
          CONTINUE

        place_bracket_order(
          side = BUY,
          qty = size_units,
          entry = entry_price,
          stop_loss = stop_price,
          take_profit = target_price
        )

        setup_active = false

  // Optional invalidation: break of structure
  IF uptrend_structure_broken():
    setup_active = false
    breakout_confirmed = false
```

---

## 9) Notes for Implementation
- Use session-consistent day boundaries (exchange timezone).
- Define what counts as a "close above PDH" (e.g., full candle close, not wick).
- Backtest with realistic slippage/fees.
- Validate robustness across instruments and volatility regimes.
