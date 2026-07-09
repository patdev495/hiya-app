# Detect Exact x5 Slot Patterns Separately

Labels: ready-for-agent

## What to build

Add exact-slot handling for the four `x5` outcomes so the engine can distinguish `x5_1`, `x5_2`, `x5_3`, and `x5_4` when there is enough evidence.

The domain model treats the four `x5` slots as separate outcomes because their positions may carry different transition behavior. The Betting Signal Engine should preserve that distinction. However, because the combined `x5` tier is naturally frequent, an `x5` recommendation should require stronger exact-slot evidence than larger multiplier recommendations.

This slice should allow `x5` recommendations only when exact-slot pattern support and edge gating both pass.

## Acceptance criteria

- [ ] The engine evaluates `x5_1`, `x5_2`, `x5_3`, and `x5_4` separately for recommendation purposes.
- [ ] Combined `x5` frequency alone does not produce an `x5` recommendation.
- [ ] An exact `x5` slot can be recommended when it has strong supported evidence and clears the edge gate.
- [ ] Weak exact-slot evidence keeps `x5` recommendations at `skip` or no target.
- [ ] Tests cover a strong exact-slot pattern for one `x5` slot.
- [ ] Tests cover a history with frequent generic `x5` outcomes but no exact-slot recommendation.

## Blocked by

- 003-add-signal-agreement-scoring.md
