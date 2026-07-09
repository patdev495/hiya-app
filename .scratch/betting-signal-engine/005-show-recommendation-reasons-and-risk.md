# Show Recommendation Reasons and Risk

Labels: ready-for-agent

## What to build

Expose the Betting Signal Engine output in the UI with an action, target, stake level, risk level, and short reasons.

The user should be able to understand why the app recommends betting, probing, tiny-shotting, or skipping. Reasons should be concise and tied to the domain language: hot/cold regime, edge above break-even, exact-slot support, exhaustion, transition evidence, or signal disagreement.

The UI should avoid presenting recommendations as guarantees. It should frame them as current signal-based guidance.

## Acceptance criteria

- [ ] The UI shows the current recommendation action.
- [ ] The UI shows the target tier or exact outcome when applicable.
- [ ] The UI shows stake level, such as skip, probe, normal, or tiny-shot.
- [ ] The UI shows risk level.
- [ ] The UI shows two or three concise reasons when available.
- [ ] Skip recommendations are presented clearly and not treated as an error state.
- [ ] Tests or component-level checks cover rendering of skip and non-skip recommendations.

## Blocked by

- 003-add-signal-agreement-scoring.md
