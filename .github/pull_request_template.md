## Summary

- What changed?
- Why is it needed?

## Target branch

- [ ] `staging` for normal work
- [ ] `main` only for approved promotion from `staging`

## Checklist

- [ ] Branch was created from `staging`
- [ ] This PR keeps history linear
- [ ] No manual merge from `main` into `staging`
- [ ] No sync branch was used
- [ ] QA/demo impact was considered

## Frontend architecture (when applicable)

- [ ] The page archetype and canonical primitives are identified
- [ ] No new deprecated UI consumer or raw operational table/domain badge was added
- [ ] Loading, empty, error, responsive and keyboard states were verified
- [ ] Any UI exception is documented with route, UX reason and follow-up
- [ ] Visual changes do not alter queries, mutations, permissions or business rules
- [ ] Authenticated screenshots are attached for affected routes, or pending QA is explicit
