# Software factory prototype: demo narration

Simulated walkthrough of the "Software factory prototype plan" (Oct 2026). None of the plan's 19 actions has started, so every screen in the video is a stylized mock-up, tagged "Prototype concept · simulated".

Total: 756 words, 5:22 (322.0 s). Beat length = words / 2.6 words per second + padding, with a per-beat minimum for the visuals.

This file is generated from `src/timeline.js` by `node build-text.mjs`; edit the narration there.

## 1. Cold open

**cold** · 0:00–0:16 · 40 words

This is the software factory prototype. A Jira label starts it, one agent step writes the code, and it ends at a hygienic draft pull request. Nothing is merged or deployed. Nothing is built yet, so this walkthrough is simulated.

## 2. What the industry does

**industry** · 0:16–0:32 · 39 words

First, what the industry does. Six in-house systems publish details. Chat is the usual trigger; Stripe and Block also take tickets. Volumes reach over a thousand PRs a week at Stripe and 130,000 tasks in one month at DoorDash.

**shape** · 0:32–0:43 · 26 words

They share one shape: a trigger, an isolated pre-built environment, deterministic steps around the agent, machine verification before the PR, and human review at the PR.

**openai** · 0:43–1:00 · 42 words

From OpenAI's factory, three practices carry over. The agent stays with the PR until it is green, capped here at two rounds. Several specialist reviewers: here, correctness and security. And changes classified by risk, with a human approval kept on every PR.

## 3. Constraints

**constraints** · 1:00–1:28 · 70 words

Three constraints shape the design. Ona's native agent is now Codex on OpenAI models, so Claude Code runs as its own process, claude -p, inside the environment. Ona has no Jira trigger, so a Jira Automation web request calls StartWorkflow with only the issue key. And on Bedrock there are no cloud sessions, routines or managed code review, but the CLI, hooks, skills, MCP, OpenTelemetry and managed settings all work.

## 4. The end-to-end run (DEMO-42)

**ticket** · 1:28–1:52 · 60 words

Now one ticket, end to end. DEMO-42: the date formatter drops the leading zero in the day field. The ticket has the required fields: repository, acceptance criteria with the command that proves them, and out of scope. The ai-ready label is added, the rule checks project, group and fields, and one web request calls StartWorkflow. Only the issue key crosses.

**env** · 1:52–2:07 · 36 words

Ona starts one environment for this ticket and runs run-ticket.sh. It gets short-lived Bedrock credentials and creates the branch agent/DEMO-42. GitHub for Atlassian sees the branch, and a Jira rule moves the ticket to In Progress.

**agent** · 2:07–2:43 · 79 words

Then the one agent step. Claude Code runs headless: no permission prompts, an allow-list of tools, a turn limit and a dollar budget. It reads the ticket with its only Jira tool, which is read-only, fixes the formatter, adds a test case and runs verify.sh. Lint fails, so the Stop hook blocks: repair round one of two. Claude fixes it and verify.sh passes. Then the script runs verify.sh again itself, because the script is the gate, not the hook.

**review** · 2:43–2:54 · 24 words

Two review passes follow, each in a fresh session. The correctness review finds one minor issue, which is resolved. The security-only pass finds nothing.

**pr** · 2:54–3:10 · 38 words

open-draft-pr.sh commits with a Conventional Commit subject and the Jira key, signed and verified. It pushes, opens a draft PR with gh, adds the ai-generated label and a trailer naming the requester, and fills in the PR template.

**checks** · 3:10–3:32 · 46 words

On GitHub, the fourteen hygiene checks run: nine native GitHub rules, five custom checks or a human. Once the required checks are green, the mark-ready workflow flips the draft to ready for review, requests code owners, and labels it low risk from its paths and size.

**approve** · 3:32–3:46 · 32 words

Jira moves itself to In Review and comments the PR link; the agent has no Jira write tool. A code owner who is not the requester approves. Approved. Not merged. Not deployed.

## 5. What makes it trustworthy

**failclosed** · 3:46–4:03 · 42 words

What makes this trustworthy? First, it fails closed. If verify.sh still fails after two repair rounds, there is no PR, just a comment on the ticket saying why. Spotify ranks a PR that passes CI but is wrong as its worst failure.

**repair** · 4:03–4:17 · 34 words

Second, self-repair. If a required check goes red on the PR, a workflow calls StartWorkflow again with the PR number and the failure log, and the agent repairs its own PR, at most twice.

**inject** · 4:17–4:32 · 36 words

Third, a prompt-injection test: a ticket that says ignore the task, push to main, print the secrets. The controls are structural, not in the prompt, so the run takes no action outside the repo and branch.

**score** · 4:32–4:47 · 36 words

Fourth, measurement. OpenTelemetry is tagged with the ticket key, feeding a scorecard from task success rate to cost per PR. Turn and budget caps, maxParallel, and a pinned model and Claude Code version keep cost bounded.

## 6. Controls and roadmap

**controls** · 4:47–5:02 · 37 words

Each risk has a structural control. Human approval and the audit trail, from Jira history, the GitHub audit log and Claude Code transcripts, line up with the MAS TRM clauses on code review, change approval and traceability.

**phases** · 5:02–5:15 · 30 words

The plan is nineteen actions in five phases, starting by proving the unknowns. Three decisions matter most: where the run executes, the agent's GitHub identity, and what starts a run.

## 6. End card

**end** · 5:15–5:22 · 9 words

Software factory prototype: ticket to PR, one agent step.

