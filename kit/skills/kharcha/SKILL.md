---
name: kharcha
description: Tokens ka kharcha kahan ja raha hai — find and fix what is eating usage and the context window. Use when the user says usage zyada hai, weekly limit khatam ho rahi hai, tokens bach jayein, kharcha zyada hai, context bhar gaya, kaunsa MCP band karun, or hits a compact.
---

# /kharcha — cut the fixed cost, not the useful work

Measure before prescribing. A fix that saves nothing still costs the user something.

## 1. The big four (check these first — they are usually 90% of the bill)
1. **Long sessions.** Every message re-sends the whole context. A 400k-token session costs ~10x a 40k one *per message*. Fix: `/save` then `/clear` between unrelated jobs; one session per project. The claude-kit hook warns when the context passes ~200k.
2. **Parallel workers and subagents.** Each background session or Agent is a full extra context. Fix: stop finished workers; no Agent/Explore for anything a `grep` answers; run subagents on a smaller model (`CLAUDE_CODE_SUBAGENT_MODEL=sonnet` in settings `env`, already set by claude-kit) and pass a bigger model only for the hard piece.
3. **Model and effort.** Opus/Fable at high effort for routine edits is the most expensive habit. Use Sonnet for normal coding, Haiku for mechanical work, `/model` to switch; keep effort medium for routine work.
4. **Screenshots and big tool output.** An image costs more than a page of text; a 2,000-line log dump stays in context forever. Cap output with `head`/`tail`; take a screenshot only when you will act on it.

## 2. MCP servers — check whether they are deferred
Run `/context`. If MCP tools show as **deferred**, only their names are loaded: disabling servers saves almost nothing, so say so and do not push a cleanup. If they are **loaded** (tens of thousands of tokens): delete dead servers (`claude mcp remove <name>`), scope servers to the project that needs them, prefer a CLI (`gh`, `curl`, `ffmpeg`) over an MCP server. Always name a server and ask before removing it.

## 3. Things that reload every turn
CLAUDE.md, MEMORY.md, and any hook that prints text on every prompt. Keep them short; a hook should print only when it has something to say.

## Reporting
A table: item · what it costs · fix · worth doing (yes/no). Then do the safe fixes, and ask before removing any server, skill or worker.
