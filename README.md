# claude-yaad

**Session memory and usage savers for Claude Code. One command, zero tokens.**

*Yaad* means "memory" in Urdu. Claude Code forgets everything on `/clear`, and long sessions burn your usage limit because every message re-sends the whole conversation. `claude-yaad` fixes both:

- **Each project remembers where it was.** A fresh session (after `/clear`, a compact, a crash or a new day) starts by reading that project's own small state file.
- **Long sessions get flagged.** You get a one-line warning when the context passes ~200k tokens, so you can `/save` and `/clear` before every message gets expensive.
- **Subagents default to Sonnet** instead of the main model. Pass a model explicitly when one piece really needs the big one.
- **Three skills:** `/save`, `/yaad` and `/kharcha` (find what is eating your usage).

The hooks are plain Node scripts. They read only the tail of the transcript, finish in under a second, and print nothing unless there is something to say. They cost **zero model tokens** except the short state they print at session start.

---

## Install

You need **Node.js 18+** and **Claude Code**.

```bash
npx claude-yaad
```

Not on npm yet? Install straight from GitHub; it works the same:

```bash
npx github:rahmangamer12/claude-yaad
```

Then **restart Claude Code**. That's it.

What the installer does:

| | Where |
|---|---|
| Hook script `ck_state.js` | `~/.claude/scripts/` |
| Skills `save`, `yaad`, `kharcha` | `~/.claude/skills/` (an older skill with the same name is moved to `~/.claude/skill-backups/`) |
| Hooks: SessionStart, PreCompact, SessionEnd, UserPromptSubmit | `~/.claude/settings.json` (backed up first as `settings.json.bak-claude-kit-<time>`) |
| `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` | `env` in `~/.claude/settings.json`; skipped if you already set one, or with `--keep-subagent-model` |

Your other hooks, settings and skills are left alone. Running it again updates the kit in place.

### Options

```bash
npx claude-yaad --keep-subagent-model   # do not touch the subagent model
npx claude-yaad --zips                  # put the skill zips for claude.ai in the current folder
npx claude-yaad --uninstall             # remove the hooks and the script (keeps skills and state)
npx claude-yaad --uninstall --purge     # also remove the three skills
```

---

## Daily use

| You want to… | Do this |
|---|---|
| Stop for now, or `/clear` | `/save`, then `/clear`. Nothing is lost. |
| Pick up where you left off | Just start. The state shows at the top of the session. Ask `/yaad` for a short summary. |
| The hook says the context is heavy | Finish the current step, `/save`, `/clear`. |
| Usage limit going too fast | `/kharcha`: it checks the usual culprits and fixes the safe ones. |

### How the memory works

One file per project: `~/.claude/state/projects/<project-slug>.md`. The slug is the working directory with every character that is not a letter or digit turned into `-`, e.g. `F:\Work\Shop Site` → `F--Work-Shop-Site.md`.

The file has two parts:

1. **Your part, written by `/save`:** what we are doing, key paths, done, next, the commands to run, and gotchas. 60 lines max.
2. **The auto part, written by the hook** on every compact and session end: your last few requests, the files edited, and the last reply. It needs no model call, so it is free.

Because every project has its own file, two Claude windows on two projects never overwrite each other's memory.

### Settings you can change

Set these as environment variables, or in `env` in `settings.json`:

| Variable | Default | Meaning |
|---|---|---|
| `CK_WARN_TOKENS` | `200000` | Warn when the context passes this many tokens |
| `CK_SHOW_CHARS` | `3500` | How much of the state file to show at session start |

---

## claude.ai (web) and the Claude desktop app

Chat on claude.ai and in the desktop app has no hooks and no lasting disk, so only the skills apply there:

1. `npx claude-yaad --zips` puts `save.zip`, `yaad.zip` and `kharcha.zip` in your folder. They are also in the [`claude-ai/`](claude-ai) folder of this repo.
2. claude.ai → **Settings → Capabilities → Skills → Upload skill**, one zip at a time.
3. In chat, `/save` prints a state block. Paste it into your **Project instructions** (or the first message of the next chat), and `/yaad` reads it from there.

The **Claude Code tab** of the desktop app and the IDE extensions use the same `~/.claude` folder as the terminal, so the full kit works there after the normal install.

---

## Why this saves usage

- The biggest cost is **context length × number of messages**. A 400k-token session costs about 10× a 40k one *per message*. Cheap memory makes `/clear` painless, so you clear more.
- **Subagents are full extra sessions.** Running them on Sonnet by default cuts their cost a lot. Your main session keeps the model you chose.
- Older autosave hooks parsed the whole transcript, which can be hundreds of MB, and wrote one global file that every window overwrote. This reads the last 3 MB and keeps one file per project.

## Uninstall

```bash
npx claude-yaad --uninstall --purge
```

Your state files in `~/.claude/state/projects/` are kept. Delete them by hand if you want.

## License

MIT
