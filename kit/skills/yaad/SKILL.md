---
name: yaad
description: Yaad karo hum kahan the — restore working context cheaply after a /clear, a compact, a crash or a new day. Answers kahan the hum, aaj kya kiya tha, continue karo, where were we, what was I doing. Reads one small file and stops. Use instead of searching the disk to rebuild context.
---

# /yaad — get oriented for the fewest tokens possible

The point of this skill is to **stop early**.

## Step 1 — the state is probably already in context
In Claude Code the SessionStart hook already printed this project's state ("=== Pichli dafa kahan the ==="). If you can see it, answer from it: 3-6 lines on what we were doing, what is done, what is next. Then ask whether to continue. Open nothing.

## Step 2 — read the file once
If it is not in context, read `~/.claude/state/projects/<slug>.md` (`<slug>` = working directory with every non-letter/digit replaced by `-`). Top part = the last /save; the AUTO part = the hook's note of the last asks, files touched and last reply. Answer from it and stop.

## Step 3 — only if the file is missing or stale (older than ~2 days)
Stop at the first one that answers:
1. The last lines of `~/.claude/state/LOG.md`.
2. The 15 newest files in the working directory (`ls -lt | head -15`).

**Never** run a repo-wide grep, a recursive find, or an Agent/Explore search to answer "where were we". That costs more than the conversation you lost.

## claude.ai web / Claude desktop chat
There is no state file. Look for a "# State —" block in the Project instructions/knowledge or the first message, and answer from it. If there is none, say so in one line and ask the user to paste their last /save block.

## Then
If the state was missing or wrong, write a fresh one with /save before starting work.
