# Course-style Jenkins pipeline

A pipeline in the pattern of the course lab: Jenkins runs no docker itself. It checks the code out, ships it
over ssh to the course box `devtools`, and every docker and npm command runs there. This is separate from the
blue/green `devtools/Jenkinsfile` and `compose.yml` next to it, which are not touched.

## What it does

Files: `Jenkinsfile`, `compose.ci.yml` (override for `../compose.demo.yml`), `remote.sh` (the commands that run
on the box).

| Stage             | What happens                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect           | `ssh root@devtools hostname && docker --version`; reads the Docker Hub user name from the `dockerhub` credential.                                                                                         |
| Checkout and ship | `checkout scm`, takes the commit (7 and 40 characters), then `tar` (without `.git`, `node_modules`, `.next`) over ssh into `/root/ci-work/pethub` on the box.                                             |
| Build             | `docker compose build app setup` with `compose.ci.yml`: the app image is tagged `<user>/pethub:<commit>` and `<user>/pethub:ci-<build>` and labelled `org.opencontainers.image.revision=<full commit>`.   |
| Test              | On the box: `npm ci`, `npm run db:generate`, lint, typecheck and `npx vitest run --reporter=default`.                                                                                                     |
| Push              | `docker login --password-stdin` into a throwaway `DOCKER_CONFIG` directory, pushes both tags, pulls the commit tag back and compares the digest with the pushed one. The directory is removed afterwards. |
| Deploy            | `docker compose up -d --no-build` with `compose.demo.yml` + `compose.ci.yml`, so the app and the worker run the image that was just pushed. The one-shot `setup` service re-runs (it is idempotent).      |
| Smoke             | Waits for `http://127.0.0.1:3000/api/health/ready` = 200 on the box, runs `infra/scripts/smoke-demo.sh`, and checks that the running app container carries the revision label of the commit being built.  |

A failure in any stage stops the pipeline. Because Build and Test come before Push and Deploy, a red build or
test leaves the previous deployment running. The `post` block always removes the temporary docker config and, on
failure, prints one line naming the failed stage and whether the previous deployment was left running.

The trigger is Poll SCM (`H/2 * * * *`, declared in the file): no webhook and no ngrok are needed.

## Layout

```text
docker network cicd-net
  jenkins   jenkins/jenkins:lts-jdk21      http://localhost:8081 (no docker.sock, no Docker CLI)
  devtools  tuchsanai/devtools:2569_1      the course box (--privileged, nested Docker)
                                           ssh 2222, app 3000, Mailpit 8025 (published on 127.0.0.1)
```

Jenkins reaches the box as `root@devtools` on `cicd-net`. After a deploy the app is at `http://localhost:3000`
and Mailpit at `http://localhost:8025`.

## Jenkins credentials (names only)

| ID             | Kind                          | Used for                                                        |
| -------------- | ----------------------------- | --------------------------------------------------------------- |
| `devtools-ssh` | SSH Username with private key | `sshagent` for `root@devtools` (the key pair in `Devtool_SSH/`) |
| `dockerhub`    | Username with password        | Docker Hub user name + access token (push stage only)           |

The pipeline uses the `sshagent` step (SSH Agent plugin), `timestamps()` (Timestamper) and the Git plugin; all
of them are part of the suggested plugins.

## Job settings (Jenkins UI)

Create a **Pipeline** job and set:

- Definition: **Pipeline script from SCM**, SCM: **Git**
- Repository URL: `https://github.com/Bestmymint/pethub.git` (public, so **no credentials**)
- Branch Specifier: `*/feat/jenkins-pipeline` for now (change it to `*/main` once this is merged)
- Script Path: `devtools/infra/ci/Jenkinsfile`
- Poll SCM does not need to be set in the UI; the `triggers` block in the Jenkinsfile declares it after the
  first run.

## Installing the key into the box

The course Hub image mounts `/etc/devtools/ssh` but does not install the public key by itself. After the
`devtools` container is created or recreated, run once on the host:

```bash
sg docker -c 'sh ~/projects/cicd/setup-devtools-key.sh'
```

If the box was recreated, its host key changed. Jenkins then refuses to connect (`StrictHostKeyChecking=accept-new`
rejects changed keys); remove the old entry with `docker exec jenkins ssh-keygen -R devtools`.

## Demonstrating a pass and a failing run

- **Pass:** push a commit to `feat/jenkins-pipeline` (or press Build Now). All seven stages go green, and the
  log ends with `PIPELINE PASSED`.
- **Fail:** on a throwaway branch break one unit test, for example change an expectation in
  `devtools/tests/unit/form-validation.test.ts`, push it, and run the job on that branch. Test turns red,
  Push, Deploy and Smoke are skipped, and the log ends with
  `PIPELINE FAILED in stage 'Test'. Deploy was not reached; the previous deployment was left running.`
  Check on the box that `docker compose -f infra/compose.demo.yml ps` still shows the old containers.

## Dry run without Jenkins

`remote.sh` can be run by hand on the box after shipping the source, for example
`PETHUB_IMAGE=local/pethub:dry PETHUB_REVISION=<full commit> sh devtools/infra/ci/remote.sh build`. Use a
placeholder image name like `local/pethub` and do not run `push` without a real token.
