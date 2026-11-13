---
name: save
description: Kaam ka state save karo taake /clear, compact ya band karne par kuch na khoye. Use when the user says save karo, clear karne laga hoon, band kar raha hoon, yaad rakho kahan the, handoff, bas aaj ke liye — and proactively when a piece of work reaches a natural stopping point, before a long or risky operation, or when a hook says the context is getting heavy.
---

# /save — freeze this project's state in one small file

## Where to write

**Claude Code (terminal / desktop / IDE):** the project's own state file. The SessionStart hook prints its path at the top of every session ("Is project ki state file: …"). If you cannot see it, build it yourself:
`~/.claude/state/projects/<slug>.md`, where `<slug>` is the working directory with every non-letter/digit replaced by `-`
(e.g. `F:\Work\Shop Site` → `F--Work-Shop-Site.md`).

The file has two parts:
- **Top part (yours):** everything above the line `<!-- AUTO: written by claude-kit hook ... -->`. Replace it completely each time.
- **Auto part (the hook's):** that marker line and everything below it. Never edit it, and keep it in place: the hook rewrites it on its own.
If the file does not exist, just write the top part.

**claude.ai web / Claude desktop chat (no file system that survives):** do not write a file. Print the same block in a code box and tell the user: "Ye block Project ke instructions/knowledge mein paste kar do, ya naye chat ke pehle message mein." That is the only memory that survives there.

## What goes in (60 lines maximum, hard cap)

Use these headings. Skip an empty heading entirely.

```markdown
# State — <YYYY-MM-DD HH:MM>
## Doing
<one line: the task, for whom>
## Where
<absolute paths that matter, one per line, max 5>
## Done
<finished things, one line each, newest last>
## Next
<the next action, written so it can start without asking anything>
## Run
<exact commands to build / test / render>
## Gotchas
<only things that already bit us: a flag, a path, a thing not to touch>
```

## Rules
- Facts, not story. Absolute paths. Next must be doable without a question.
- Long-lived facts (a client's rules, how a tool works) belong in memory, not here.
- Trim: drop finished items nobody will need again; cut the oldest Done lines first.

After writing, tell the user in one line that it is saved and `/clear` is safe. Do not print the file back.
