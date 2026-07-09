# Add No-Bet Edge Gate

Labels: ready-for-agent

## What to build

Add the first vertical slice of the Betting Signal Engine: a recommendation path that can explicitly tell the user to skip a spin when no outcome clears the break-even threshold by a safety margin.

The feature should turn existing outcome probabilities into a user-facing betting action. A high-probability outcome is not enough by itself; an outcome should only be considered playable when its predicted probability is greater than its break-even probability (`1 / multiplier`) plus a configurable safety margin. If no outcome clears that gate, the recommendation should be `skip`.

This slice should keep the behavior narrow. It does not need full signal agreement, tier strategy, or backtesting yet. It only needs the edge gate and a minimal UI path showing that "no bet" is a valid recommendation.

## Acceptance criteria

- [ ] The app can derive a betting recommendation from the current prediction output.
- [ ] The recommendation returns `skip` when no outcome probability exceeds break-even plus the safety margin.
- [ ] Break-even is computed from the outcome multiplier, including the four separate `x5` outcomes.
- [ ] The UI displays a clear no-bet recommendation when the action is `skip`.
- [ ] Tests cover histories where the prediction is below the edge gate and therefore recommends skipping.
- [ ] Tests cover at least one history where an outcome clears the edge gate and is not skipped.

## Blocked by

None - can start immediately.
