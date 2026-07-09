# Backtest Signal Outcomes on Recorded History

Labels: ready-for-agent

## What to build

Add a backtest path that replays recorded history through the Betting Signal Engine and summarizes how the recommendations would have performed.

The backtest should help the user judge whether the signal engine is doing better than guesswork. It should report recommendation counts, hit rate by target tier, skipped spins, and an estimated return based on the actual next outcomes and multipliers. The goal is not to promise future profit; it is to make the model falsifiable against the user's recorded history.

This slice should reuse the same engine behavior as live recommendations instead of implementing separate backtest-only logic.

## Acceptance criteria

- [ ] The app can replay recorded history and generate historical recommendations.
- [ ] The backtest reports counts for skip, probe, normal, and tiny-shot actions.
- [ ] The backtest reports hit rate by target tier or outcome group.
- [ ] The backtest estimates return using actual next outcomes and configured multipliers.
- [ ] The backtest uses the same Betting Signal Engine logic as live recommendations.
- [ ] Tests cover a small deterministic history and verify the backtest summary.

## Blocked by

- 005-show-recommendation-reasons-and-risk.md
