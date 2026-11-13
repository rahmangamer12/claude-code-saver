#!/usr/bin/env node
// claude-kit: zero-token session memory for Claude Code.
// One state file per project: ~/.claude/state/projects/<project-slug>.md
//   SessionStart      -> prints that file (capped) so a fresh session knows where we were
//   PreCompact/SessionEnd -> rewrites only the AUTO part (last asks, files touched, last reply)
//   UserPromptSubmit  -> one-line warning when the context is getting expensive
// It reads only the tail of the transcript, so it stays fast on 200 MB transcripts.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const DIR = path.join(HOME, '.claude', 'state', 'projects');
const MARK = '<!-- AUTO: written by claude-kit hook, everything below is replaced -->';
const WARN = parseInt(process.env.CK_WARN_TOKENS || '200000', 10);
const SHOW = parseInt(process.env.CK_SHOW_CHARS || '3500', 10);
const TAIL = 3 * 1024 * 1024;

function readStdin() {
  try { return JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}
const slug = (p) => String(p || process.cwd()).replace(/[^A-Za-z0-9]/g, '-');
const stamp = () => {
  const d = new Date(), z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`;
};

function tailLines(file) {
  try {
    const size = fs.statSync(file).size;
    const len = Math.min(size, TAIL);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    if (size > len) lines.shift(); // first line is probably cut
    return lines;
  } catch { return []; }
}

function parse(lines) {
  const asks = [], replies = [], files = [];
  let tokens = 0;
  for (const raw of lines) {
    let m; try { m = JSON.parse(raw); } catch { continue; }
    const msg = m.message || {};
    if (msg.usage) {
      const u = msg.usage;
      tokens = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    }
    const c = msg.content;
    if (m.type === 'user' && !m.isMeta) {
      let t = typeof c === 'string' ? c
        : Array.isArray(c) && !c.some((x) => x && x.type === 'tool_result')
          ? c.filter((x) => x && x.type === 'text').map((x) => x.text).join(' ') : '';
      t = (t || '').trim();
      if (t && !t.startsWith('<') && !t.startsWith('[Request interrupted') && !t.startsWith('Caveat:'))
        asks.push(t.replace(/\s+/g, ' ').slice(0, 280));
    } else if (m.type === 'assistant' && Array.isArray(c)) {
      for (const x of c) {
        if (x && x.type === 'text' && x.text && x.text.trim()) replies.push(x.text.trim());
        if (x && x.type === 'tool_use' && /^(Write|Edit|MultiEdit|NotebookEdit)$/.test(x.name) && x.input) {
          const f = x.input.file_path || x.input.notebook_path;
          if (f) { const i = files.indexOf(f); if (i >= 0) files.splice(i, 1); files.push(f); }
        }
      }
    }
  }
  return { asks, replies, files, tokens };
}

function stateFile(cwd) {
  fs.mkdirSync(DIR, { recursive: true });
  return path.join(DIR, slug(cwd) + '.md');
}

const d = readStdin();
const ev = d.hook_event_name || process.argv[2] || '';
const cwd = d.cwd || process.cwd();
const file = stateFile(cwd);

if (ev === 'SessionStart') {
  let txt = '';
  try { txt = fs.readFileSync(file, 'utf8'); } catch {}
  console.log(`[claude-kit] Is project ki state file: ${file}`);
  console.log('/save isi file ka upar wala hissa likhta hai; /yaad isi ko padhta hai.');
  if (txt.trim()) {
    console.log('=== Pichli dafa kahan the ===');
    console.log(txt.length > SHOW ? txt.slice(0, SHOW) + '\n…(baqi file mein)' : txt);
  }
  process.exit(0);
}

const lines = d.transcript_path ? tailLines(d.transcript_path) : [];

if (ev === 'UserPromptSubmit') {
  const { tokens } = parse(lines.slice(-400));
  if (tokens > WARN)
    console.log(`[claude-kit] Context ~${Math.round(tokens / 1000)}k tokens: har message mehnga ho raha hai. Ye kaam khatam kar ke /save phir /clear karo (state yaad rahegi).`);
  process.exit(0);
}

if (ev === 'PreCompact' || ev === 'SessionEnd' || ev === 'Stop') {
  const { asks, replies, files } = parse(lines);
  if (!asks.length && !replies.length) process.exit(0);
  let hand = '';
  try { hand = fs.readFileSync(file, 'utf8').split(MARK)[0].trimEnd(); } catch {}
  const last = (replies[replies.length - 1] || '').slice(0, 1200);
  const auto = [
    MARK,
    `## Auto — ${stamp()} (${ev})`,
    'Last asks:',
    ...asks.slice(-4).map((a) => '- ' + a),
    files.length ? 'Files touched:' : '',
    ...files.slice(-12).map((f) => '- ' + f),
    'Last reply:',
    last,
  ].filter((l) => l !== '').join('\n');
  fs.writeFileSync(file, (hand ? hand + '\n\n' : '') + auto + '\n');
  try {
    fs.appendFileSync(path.join(HOME, '.claude', 'state', 'LOG.md'), `- ${stamp()}: auto-save ${ev} → ${path.basename(file)}\n`);
  } catch {}
}
process.exit(0);
