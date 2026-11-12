# Evidence

Screenshots that support the CI/CD claims. The pipeline itself is described in
[`devtools/infra/ci/README.md`](../../devtools/infra/ci/README.md) and defined in
[`devtools/infra/ci/Jenkinsfile`](../../devtools/infra/ci/Jenkinsfile).

## Expected files

| File                                                                   | What it proves                                                                                                                                    | How to reproduce                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [jenkins-build2-green-pipeline.png](jenkins-build2-green-pipeline.png) | First green run on `main`: build #2, revision `e5848ca`, all 7 stages green.                                                                      | Run the job on `*/main` (Build Now) and open the stage view of the build.                                                                                   |
| [jenkins-build3-scm-trigger.png](jenkins-build3-scm-trigger.png)       | Build #3, "Started by an SCM change", revision `61d5f5e`: a push started the build by itself through Poll SCM.                                    | Merge or push a commit to `main`; within about two minutes build N+1 starts with the cause "Started by an SCM change".                                      |
| [jenkins-polling-log.png](jenkins-polling-log.png)                     | The Git Polling Log of the job, showing that Jenkins polled the repository and found the change.                                                  | Job page, "Git Polling Log".                                                                                                                                |
| [dockerhub-tags.png](dockerhub-tags.png)                               | Docker Hub repository `67070194/pethub` with tags `61d5f5e` and `ci-3` on the same digest (also `aff71a1` / `ci-1` and `e5848ca` / `ci-2`).       | Open the repository's Tags page on Docker Hub, or run `docker pull 67070194/pethub:61d5f5e` and `docker pull 67070194/pethub:ci-3` and compare the digests. |
| [jenkins-fail-pipeline.png](jenkins-fail-pipeline.png)                 | Deliberate failing run (job `pethub-ci-fail-demo`, branch `ci-demo-fail`, commit `379e1d6`): Test is red; Push, Deploy and Smoke are skipped.     | See "Reproduce the failing run" below.                                                                                                                      |
| [jenkins-fail-console.png](jenkins-fail-console.png)                   | End of that console log: the failed test and `PIPELINE FAILED in stage 'Test'. Deploy was not reached; the previous deployment was left running.` | Same run, "Console Output", last lines.                                                                                                                     |

## Pipeline stages

As defined in `devtools/infra/ci/Jenkinsfile` (run on the Jenkins controller, which has no Docker; every
Docker and npm command runs on the course box `devtools` over ssh through `remote.sh`):

| Stage             | What it does                                                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Connect           | `ssh root@devtools hostname && docker --version`; reads the Docker Hub user name from the `dockerhub` credential.                                                  |
| Checkout and ship | `checkout scm`, records the commit, and sends the source (without `.git`, `node_modules`, `.next`) to `/root/ci-work/pethub` on the box.                           |
| Build             | `docker compose build app setup`; the app image is tagged `<user>/pethub:<7-char commit>` and `<user>/pethub:ci-<build number>` and labelled with the full commit. |
| Test              | On the box: `npm ci`, `npm run db:generate`, `npm run lint`, `npm run typecheck`, `npx vitest run`.                                                                |
| Push              | `docker login --password-stdin` in a throwaway Docker config, pushes both tags, pulls the commit tag back and compares digests.                                    |
| Deploy            | `docker compose up -d --no-build` with `compose.demo.yml` and `compose.ci.yml`, so the app and worker run the pushed image.                                        |
| Smoke             | Waits for `/api/health/ready` = 200, runs `infra/scripts/smoke-demo.sh`, and checks that the running container carries the revision label of the commit.           |

Post actions: `always` removes the temporary Docker config on the box; `success` prints `PIPELINE PASSED`;
`failure` prints which stage failed and whether the previous deployment was left running; `aborted` prints
the stage in which it was stopped.

Settings used by the pipeline:

- Trigger: Poll SCM `H/2 * * * *`, declared in the `Jenkinsfile`.
- Credential IDs: `devtools-ssh` (SSH key for `root@devtools`) and `dockerhub` (user name and access token).
- Image tags: `<dockerhub user>/pethub:<7-char commit>` and `<dockerhub user>/pethub:ci-<BUILD_NUMBER>`.
- Job: Pipeline script from SCM, repository `https://github.com/Bestmymint/pethub.git`, script path
  `devtools/infra/ci/Jenkinsfile`.

## Reproduce the failing run

The branch `ci-demo-fail` exists on purpose and is never merged. Its only change from `main` is commit
`379e1d6`, which changes one assertion in `devtools/tests/unit/form-validation.test.ts` (the expected
minimum password length is changed from 10 to 11).

```bash
git clone https://github.com/Bestmymint/pethub.git
cd pethub
git checkout ci-demo-fail
git show 379e1d6          # the one-line change
```

To see the pipeline fail, create a Pipeline job (for example `pethub-ci-fail-demo`) with the same settings as
above and the branch specifier `*/ci-demo-fail`, then press Build Now. Expected result: Connect, Checkout and
ship and Build are green, Test is red, and Push, Deploy and Smoke are skipped. To see the same failure
without Jenkins, run `npm ci && npx vitest run tests/unit/form-validation.test.ts` in `devtools/` on that
branch.
