/*
 * Single source of truth for narration, beat timings and caption cues.
 * Loaded by the page (window.TIMELINE) and by the Node render/SRT scripts (module.exports).
 *
 * Captions-only build: each beat's duration is derived from its narration length
 * (WORDS_PER_SEC reading pace plus padding), with a per-beat minimum so animations fit.
 */
(function (root) {
  const WORDS_PER_SEC = 2.6;
  const PAD = 1.0;

  // scene: which visual scene the beat belongs to. min: minimum seconds for the visuals.
  const BEATS = [
    { id: 'cold', scene: 'cold', min: 15,
      text: 'This is the software factory prototype. A Jira label starts it, one agent step writes the code, and it ends at a hygienic draft pull request. Nothing is merged or deployed. Nothing is built yet, so this walkthrough is simulated.' },

    { id: 'industry', scene: 'industry', min: 15,
      text: 'First, what the industry does. Six in-house systems publish details. Chat is the usual trigger; Stripe and Block also take tickets. Volumes reach over a thousand PRs a week at Stripe and 130,000 tasks in one month at DoorDash.' },
    { id: 'shape', scene: 'industry', min: 11,
      text: 'They share one shape: a trigger, an isolated pre-built environment, deterministic steps around the agent, machine verification before the PR, and human review at the PR.' },
    { id: 'openai', scene: 'industry', min: 14,
      text: "From OpenAI's factory, three practices carry over. The agent stays with the PR until it is green, capped here at two rounds. Several specialist reviewers: here, correctness and security. And changes classified by risk, with a human approval kept on every PR." },

    { id: 'constraints', scene: 'constraints', min: 28,
      text: "Three constraints shape the design. Ona's native agent is now Codex on OpenAI models, so Claude Code runs as its own process, claude -p, inside the environment. Ona has no Jira trigger, so a Jira Automation web request calls StartWorkflow with only the issue key. And on Bedrock there are no cloud sessions, routines or managed code review, but the CLI, hooks, skills, MCP, OpenTelemetry and managed settings all work." },

    { id: 'ticket', scene: 'run', min: 22,
      text: 'Now one ticket, end to end. DEMO-42: the date formatter drops the leading zero in the day field. The ticket has the required fields: repository, acceptance criteria with the command that proves them, and out of scope. The ai-ready label is added, the rule checks project, group and fields, and one web request calls StartWorkflow. Only the issue key crosses.' },
    { id: 'env', scene: 'run', min: 14,
      text: 'Ona starts one environment for this ticket and runs run-ticket.sh. It gets short-lived Bedrock credentials and creates the branch agent/DEMO-42. GitHub for Atlassian sees the branch, and a Jira rule moves the ticket to In Progress.' },
    { id: 'agent', scene: 'run', min: 36,
      text: 'Then the one agent step. Claude Code runs headless: no permission prompts, an allow-list of tools, a turn limit and a dollar budget. It reads the ticket with its only Jira tool, which is read-only, fixes the formatter, adds a test case and runs verify.sh. Lint fails, so the Stop hook blocks: repair round one of two. Claude fixes it and verify.sh passes. Then the script runs verify.sh again itself, because the script is the gate, not the hook.' },
    { id: 'review', scene: 'run', min: 11,
      text: 'Two review passes follow, each in a fresh session. The correctness review finds one minor issue, which is resolved. The security-only pass finds nothing.' },
    { id: 'pr', scene: 'run', min: 15,
      text: 'open-draft-pr.sh commits with a Conventional Commit subject and the Jira key, signed and verified. It pushes, opens a draft PR with gh, adds the ai-generated label and a trailer naming the requester, and fills in the PR template.' },
    { id: 'checks', scene: 'run', min: 22,
      text: 'On GitHub, the fourteen hygiene checks run: nine native GitHub rules, five custom checks or a human. Once the required checks are green, the mark-ready workflow flips the draft to ready for review, requests code owners, and labels it low risk from its paths and size.' },
    { id: 'approve', scene: 'run', min: 14,
      text: 'Jira moves itself to In Review and comments the PR link; the agent has no Jira write tool. A code owner who is not the requester approves. Approved. Not merged. Not deployed.' },

    { id: 'failclosed', scene: 'safe', min: 13,
      text: 'What makes this trustworthy? First, it fails closed. If verify.sh still fails after two repair rounds, there is no PR, just a comment on the ticket saying why. Spotify ranks a PR that passes CI but is wrong as its worst failure.' },
    { id: 'repair', scene: 'safe', min: 13,
      text: 'Second, self-repair. If a required check goes red on the PR, a workflow calls StartWorkflow again with the PR number and the failure log, and the agent repairs its own PR, at most twice.' },
    { id: 'inject', scene: 'safe', min: 14,
      text: 'Third, a prompt-injection test: a ticket that says ignore the task, push to main, print the secrets. The controls are structural, not in the prompt, so the run takes no action outside the repo and branch.' },
    { id: 'score', scene: 'safe', min: 14,
      text: 'Fourth, measurement. OpenTelemetry is tagged with the ticket key, feeding a scorecard from task success rate to cost per PR. Turn and budget caps, maxParallel, and a pinned model and Claude Code version keep cost bounded.' },

    { id: 'controls', scene: 'roadmap', min: 13,
      text: 'Each risk has a structural control. Human approval and the audit trail, from Jira history, the GitHub audit log and Claude Code transcripts, line up with the MAS TRM clauses on code review, change approval and traceability.' },
    { id: 'phases', scene: 'roadmap', min: 13,
      text: "The plan is nineteen actions in five phases, starting by proving the unknowns. Three decisions matter most: where the run executes, the agent's GitHub identity, and what starts a run." },
    { id: 'end', scene: 'end', min: 7,
      text: 'Software factory prototype: ticket to PR, one agent step.' },
  ];

  const round = (x, step) => Math.round(x / step) * step;
  const wordCount = (s) => s.trim().split(/\s+/).length;

  let t = 0;
  for (const b of BEATS) {
    b.words = wordCount(b.text);
    b.dur = Math.max(b.min, round(b.words / WORDS_PER_SEC + PAD, 0.5));
    b.start = t;
    b.end = t + b.dur;
    t = b.end;
  }
  const DURATION = t;

  // Caption cues: <= MAX chars each, broken at sentence ends or clause punctuation where possible.
  const MAX = 84;
  // Recursively split a long sentence at the best space: punctuation near the middle wins.
  function chunkSentence(sent) {
    if (sent.length <= MAX) return [sent];
    const mid = sent.length / 2;
    let best = -1, bestScore = Infinity;
    for (let i = 1; i < sent.length - 1; i++) {
      if (sent[i] !== ' ') continue;
      const punct = /[,;:]/.test(sent[i - 1]);
      const score = Math.abs(i - mid) / sent.length - (punct ? 0.18 : 0);
      if (score < bestScore) { best = i; bestScore = score; }
    }
    return [...chunkSentence(sent.slice(0, best)), ...chunkSentence(sent.slice(best + 1))];
  }
  function splitCues(text) {
    const sentences = text.split(/(?<=[.?!])\s+/).map((x) => x.trim()).filter(Boolean);
    // merge short sentences with their neighbour when the pair still fits one cue
    const merged = [];
    for (const s of sentences) {
      const last = merged[merged.length - 1];
      if (last && (last.length < 30 || s.length < 22) && (last + ' ' + s).length <= MAX) merged[merged.length - 1] = last + ' ' + s;
      else merged.push(s);
    }
    return merged.flatMap(chunkSentence);
  }

  function twoLines(s, lineMax = 44) {
    if (s.length <= lineMax) return [s];
    const mid = s.length / 2;
    let best = -1, bestScore = Infinity;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== ' ') continue;
      const score = Math.abs(i - mid) - (/[,;:.]/.test(s[i - 1]) ? 7 : 0);
      if (Math.max(i, s.length - i - 1) <= lineMax + 4 && score < bestScore) { best = i; bestScore = score; }
    }
    return best < 0 ? [s] : [s.slice(0, best), s.slice(best + 1)];
  }

  const CUES = [];
  for (const b of BEATS) {
    const parts = splitCues(b.text);
    const a = b.start + 0.25;
    const z = b.end - 0.3;
    const weights = parts.map((p) => p.length + 10);
    const total = weights.reduce((x, y) => x + y, 0);
    let c = a;
    parts.forEach((p, i) => {
      const d = ((z - a) * weights[i]) / total;
      CUES.push({ beat: b.id, start: c, end: c + d - 0.08, text: p, lines: twoLines(p) });
      c += d;
    });
  }

  const byId = {};
  for (const b of BEATS) byId[b.id] = b;

  const TIMELINE = { BEATS, byId, CUES, DURATION, WORDS_PER_SEC };
  if (typeof module !== 'undefined' && module.exports) module.exports = TIMELINE;
  else root.TIMELINE = TIMELINE;
})(typeof window !== 'undefined' ? window : globalThis);
