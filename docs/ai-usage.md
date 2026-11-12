# AI usage

AI coding assistants helped with this project under the author's direction. This page summarises how, as
the course asks for an AI-use statement.

## Tools

| Tool                                                                    | Used for                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------- |
| Claude Code                                                             | Planning, review, and higher-risk changes.              |
| Pi agent with OpenCode Go models (for example DeepSeek and Kimi models) | Scoped implementation tasks with a clear, small target. |

## Kinds of tasks

- Analysis: reading the code base and the Thai handoff notes, and mapping features to files.
- Implementation: feature changes, refactoring, validation rules, the demo stack, the Jenkins pipeline.
- Tests: writing and extending unit, integration and end-to-end tests.
- Documentation: READMEs, architecture notes, decision records, and this documentation set.

## How the output was handled

- The author reviewed every change before it was committed.
- Changes were verified with the automated checks in [the testing section](../README.md#testing) and with
  manual checks in the running demo stack.
- Work went through branches and pull requests; the history is in git (see [ownership.md](ownership.md)).

## Responsibility

The author is responsible for the code, the data, the licences and the security of this project, and can
explain and modify the code. AI output was treated as a draft, not as a source of truth.
