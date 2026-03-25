# Git Workflow

This project uses two long-lived branches:

- `main`: production
- `staging`: demo / QA / pre-production

All day-to-day work happens in short-lived branches created from `staging`.

## Branch naming

- `feat/<short-name>`
- `fix/<short-name>`
- `chore/<short-name>`

Examples:

- `feat/customer-discounts`
- `fix/remito-stock-validation`
- `chore/update-readme`

## Standard flow

1. Start from `staging`

```sh
git checkout staging
git pull origin staging
```

2. Create a work branch

```sh
git checkout -b feat/my-change
```

3. Commit and push

```sh
git push -u origin feat/my-change
```

4. Open a PR into `staging`

- Use a linear strategy
- Prefer `Squash and merge` or `Rebase and merge`
- Avoid merge commits

5. Validate in demo / QA

6. Open a promotion PR from `staging` to `main`

- Keep it linear
- Do not create manual sync branches

## Rules of the repo

- Never work directly on `main`
- Avoid long-lived feature branches
- Do not merge `main` into `staging` manually
- Do not create branches like `sync/main-into-staging`
- If a production hotfix is needed, create a short-lived branch, merge it cleanly, and then bring it back to `staging` with another PR

## After a promotion

Refresh your local branches:

```sh
git checkout main
git pull origin main
git checkout staging
git pull origin staging
```

## Troubleshooting

### `main` and `staging` have different commits

That alone is not a problem. First check whether the content is actually different:

```sh
git diff --stat main..staging
```

If the diff is empty, the branches may only differ in history. In this repository, the correct fix is usually a clean PR-based promotion, not a manual merge between long-lived branches.

### A hotfix went directly to production

Do not merge `main` back into `staging` manually. Instead:

1. Identify the hotfix commit
2. Create a short-lived branch from `staging`
3. Cherry-pick the hotfix if needed
4. Open a PR back into `staging`
