# Context

## Glossary

### Outcome

One of the eight distinct wheel slots that can occur on a spin: `x5_1`, `x5_2`, `x5_3`, `x5_4`, `x10`, `x15`, `x25`, or `x45`.

An outcome is slot-specific. The four `x5` slots are not collapsed into a single `x5` result because their positions may carry different transition behavior.

### Base Probability

The fixed prior probability assigned to each outcome before considering spin history.

Base probability is derived from `1 / multiplier` and then normalized across the eight outcomes so the probabilities sum to 100%. The four `x5` outcomes each receive the same base probability.

### Prior Strength

The weight given to base probability when estimating the next outcome from historical patterns.

The configured prior strength is `20`, meaning base probability contributes the equivalent of 20 virtual spins before real historical counts are added.

### Outcome Regime

A recent-history phase where outcome frequency appears materially different from the base probability mix.

A cold regime is dominated by `x5` outcomes, while a hot regime has more frequent large outcomes (`x10`, `x15`, `x25`, or `x45`) interleaved with `x5` outcomes. Regime labels describe observed recent-history behavior, not a guarantee that the next spin is controlled by that phase.

### Approximate Spin Cadence

A new spin result becomes available roughly every 40 seconds.

Prediction should be updated after each new spin result is recorded, using the most recent available history. The cadence is an estimate, so prediction logic should be event-driven by recorded outcomes rather than tied to an exact 40-second timer.

### Manual Outcome Entry

Spin outcomes are entered manually by the user.

The system should treat the recorded outcome as the source of truth and should support correction-oriented workflows rather than assuming an automatic feed.

### History Correction

The user can correct any recorded outcome inside the active history window, not only undo the latest entry.

Prediction should be recomputed from the current recorded history after a correction so edited rows are reflected consistently.

### History Window

The model uses a configurable number of most recent outcomes when estimating the next outcome.

The default history window is `100` outcomes, but it should remain configurable so different windows such as `50`, `100`, or `200` can be compared later. Full history should be retained separately from the active history window used for prediction.

### Markov Order

The model uses a configurable maximum number of immediately preceding outcomes as the transition pattern.

The default should be selected from the active history window: use `max_order = 2` when the history window is below `200`; consider `max_order = 3` only when the history window is at least `500`. Advanced configuration may expose this value directly.

### Blended Backoff

When higher-order transition patterns have weak support, the model should blend them with lower-order transition estimates instead of discarding them completely.

Blending lets weak sequence signals influence the prediction without allowing sparse counts to dominate the base probability or lower-order evidence.

### Minimum Support

The default minimum support is `5` observations for a transition pattern.

Minimum support should be used as a confidence and warning threshold, not as a hard cutoff. Sparse patterns may still contribute through blended backoff, but the UI should make weak evidence visible.

### Prediction Confidence Display

Prediction output should show probabilities for all eight outcomes plus one overall confidence indicator for the prediction.

The UI should avoid attaching detailed confidence explanations to every outcome by default, because that would make the prediction harder to scan during repeated manual entry.

### Top Outcome Display

Prediction output may highlight the outcome with the highest current probability.

The highlighted outcome should be described as the current highest-probability outcome, not as a guaranteed or certain next result.

### Pattern Mode

Pattern mode predicts from an ensemble of abstract recent-history pattern families instead of requiring an exact repeated outcome sequence.

The pattern families include tier transitions, tier/gap buckets, regime/gap buckets, wheel-step movement, tier alternation, exact-outcome gap buckets, and exact-outcome direction. Each family contributes a weighted probability distribution so broad pattern families cannot dominate only because they match more historical positions. Pattern strength multiplies this ensemble signal before it is blended with prior probability, making pattern mode more conservative at low values and more decisive at high values. Pattern evidence should expose matched families, match counts, top family outcome, and contribution so the user can see which abstract pattern is driving the choice.

Pattern mode replaces global decay as the third prediction mode.

### Playable Outcome

An outcome is playable only when its predicted probability exceeds its break-even probability by at least the configured safety margin.

High probability alone does not make an outcome playable.

### Skip Recommendation

A skip recommendation means no outcome is currently playable.

Skipping a spin is a normal betting signal state, not an error or missing prediction.

### Exact-Slot Support

Exact-slot support means evidence for one specific outcome, such as `x5_1`, rather than evidence for a collapsed multiplier group such as generic `x5`.

The four `x5` outcomes require exact-slot support before they are playable.

### Target Tier

A target tier is the risk class assigned to a playable outcome. `x10` and `x15` are main targets, `x25` is a probe target, and `x45` is a tiny-shot target.

### Target Limit

The default recommendation should select at most one target per spin. A second target is only acceptable when both targets are `x10` or `x15` and both have strong edge.

### Strong Edge

Strong edge means a playable outcome exceeds its break-even probability by at least three percentage points.

Strong edge is required before a second `x10` or `x15` target can be recommended on the same spin.

### Cooldown

Cooldown is a forced skip state after a losing streak of resolved betting spins. It counts only spins where the system recommended an actual bet, not prior skip recommendations.

The default cooldown starts after three consecutive losing betting spins and lasts for the next three spins.
