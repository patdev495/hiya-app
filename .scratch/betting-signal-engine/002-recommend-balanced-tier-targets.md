# Recommend Balanced Tier Targets

Labels: ready-for-agent

## What to build

Extend the Betting Signal Engine so recommendations follow the balanced strategy agreed in the product discussion.

The engine should not simply recommend the top probability outcome. It should map playable outcomes into risk-aware target tiers. `x10` and `x15` are the main playable tiers when conditions support betting. `x25` is a smaller probe. `x45` is only a tiny-shot. The `x5` outcomes should not be recommended merely because they are frequent; they should require a stronger exact-slot signal that will be added in a later slice.

This slice should produce enough output for the UI to show the recommended action and target tier, even if the final reason/risk display comes later.

## Acceptance criteria

- [ ] Recommendations classify playable targets into balanced tier actions.
- [ ] `x10` and `x15` can be recommended as the main target tier when they pass the edge gate.
- [ ] `x25` is recommended only as a probe-level target when it passes the edge gate.
- [ ] `x45` is recommended only as a tiny-shot target when it passes the edge gate.
- [ ] `x5` outcomes are not recommended solely because of their base frequency.
- [ ] Tests cover the tier mapping for `x10`, `x15`, `x25`, and `x45`.

## Blocked by

- 001-add-no-bet-edge-gate.md
