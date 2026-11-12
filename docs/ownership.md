# Ownership and contribution summary

This page is a factual summary of the git history of the `main` branch. It adds no roles and says nothing
about people beyond what git records. The course expects each team member to be able to explain their own
part of the project; this page only shows what the history contains.

Reproduce the numbers with:

```bash
git shortlog -s -n --no-merges main
git log --merges --format='%an' main | sort | uniq -c
gh pr list --state merged --json number,title,author,mergedAt
```

## Commits on `main`

| Author name in git        | Commits | What they are                                                           |
| ------------------------- | ------- | ----------------------------------------------------------------------- |
| `athikarn5678`            | 34      | Non-merge commits (features, fixes, docs, chores).                      |
| `Athikarn Chinjirattikan` | 10      | The ten merge commits created when pull requests #1 to #10 were merged. |
| `Bestmymint`              | 2       | The initial commit and the upload of the original source.               |

The GitHub login that opened and merged pull requests #1 to #10 is `athikarn5678`.

## Merged pull requests

| PR  | Title                                                                                        | Author         | Area                                                              |
| --- | -------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------- |
| #1  | fix(deps): update next, zod and nodemailer to fix vulnerabilities, fix package-lock.json     | `athikarn5678` | Dependencies, docs (agent guide, architecture, setup guide, ADRs) |
| #2  | Add one-command demo stack (docker compose)                                                  | `athikarn5678` | Demo stack, S3 storage, rate-limit switch                         |
| #3  | Fix form validation, submission flow and notification icons                                  | `athikarn5678` | Validation, submissions, notifications                            |
| #4  | Add a course-style Jenkins pipeline (build, test, push, deploy, smoke)                       | `athikarn5678` | CI/CD pipeline                                                    |
| #5  | Redesign the meetup chat: message menu, composer and pinned messages                         | `athikarn5678` | Meetup chat                                                       |
| #6  | Style the admin Meetup tabs and require admin access                                         | `athikarn5678` | Admin console                                                     |
| #7  | Admin polish: readable report reasons and what was reported in Meetup reports                | `athikarn5678` | Admin console                                                     |
| #8  | Demo tools: one shared demo password and admin sample-data buttons                           | `athikarn5678` | Demo tools                                                        |
| #9  | Demo: third login account for two-person chat tests, and pets for every demo account         | `athikarn5678` | Demo accounts                                                     |
| #10 | Repository cleanup: remove unused code, packages and assets, and fix the source-policy gates | `athikarn5678` | Cleanup, source-policy checks                                     |

PR #1 was titled in Thai; the title above is a translation. The branch `ci-demo-fail` is a deliberate
failing-test demo for Jenkins and was never merged (see [evidence/README.md](evidence/README.md)).

## Where to look

- Per-commit detail: `git log --format='%h %an %ad %s' --date=short`
- AI tool usage: [ai-usage.md](ai-usage.md)
- Requirement-to-code-to-test links: [traceability.md](traceability.md)
