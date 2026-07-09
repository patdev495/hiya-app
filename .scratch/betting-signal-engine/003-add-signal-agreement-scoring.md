# Add Signal Agreement Scoring

Labels: ready-for-agent

## What to build

Add signal agreement scoring so the Betting Signal Engine only recommends a stronger bet when multiple independent signals point in the same direction.

The engine should evaluate agreement across the existing prediction evidence: outcome probabilities, regime behavior, transition evidence, deck exhaustion, and decay or recent-history behavior where available. A single noisy pattern should not be enough to produce a strong recommendation. When signals disagree, the engine should downgrade the action to `skip` or `probe`.

This slice should keep the scoring explainable. It does not need machine learning or hidden weights. Use deterministic scoring rules that are easy to test and easy to explain in the UI later.

## Acceptance criteria

- [ ] The recommendation includes an agreement score or equivalent internal confidence signal.
- [ ] Stronger actions require more than one supporting signal.
- [ ] Contradictory signals downgrade the recommendation to `skip` or `probe`.
- [ ] Regime, transition, and exhaustion evidence can each contribute to the score when available.
- [ ] Tests cover a case where aligned signals upgrade a recommendation.
- [ ] Tests cover a case where conflicting signals downgrade or skip a recommendation.

## Blocked by

- 002-recommend-balanced-tier-targets.md
