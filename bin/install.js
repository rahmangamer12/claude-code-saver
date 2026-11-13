#!/usr/bin/env node
// claude-yaad installer: npx claude-yaad            -> install / update
//                       npx claude-yaad --uninstall -> remove hooks + kit files (skills kept unless --purge)
//                       npx claude-yaad --zips      -> copy claude.ai skill zips to the current folder
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLAUDE = path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CLAUDE, 'settings.json');
const SCRIPT = path.join(CLAUDE, 'scripts', 'ck_state.js');
const SKILLS = ['save', 'yaad', 'kharcha'];
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const log = (s) => console.log('  ' + s);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); } catch (e) {
    if (fs.existsSync(SETTINGS)) { console.error('settings.json is not valid JSON; fix it first: ' + SETTINGS); process.exit(1); }
    return {};
  }
}
function backup() {
  if (!fs.existsSync(SETTINGS)) return;
  const b = SETTINGS + '.bak-claude-kit-' + Date.now();
  fs.copyFileSync(SETTINGS, b);
  log('backup: ' + b);
}
const cmd = () => `node "${SCRIPT.replace(/\\/g, '/')}"`;
// Old hooks this kit replaces (the earlier python autosave and the global CURRENT.md loader).
const isOurs = (h) => /ck_state\.js|autosave\.py|state\/CURRENT\.md|state\\CURRENT\.md/.test((h && h.command) || '');

function stripOurs(s) {
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = s.hooks[ev]
      .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !isOurs(h)) }))
      .filter((g) => g.hooks.length);
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
}
function addHook(s, ev, matcher, timeout) {
  s.hooks = s.hooks || {};
  s.hooks[ev] = s.hooks[ev] || [];
  const g = { hooks: [{ type: 'command', command: cmd(), timeout }] };
  if (matcher) g.matcher = matcher;
  s.hooks[ev].unshift(g);
}

if (has('--zips')) {
  const src = path.join(ROOT, 'claude-ai');
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(process.cwd(), f));
  console.log('Skill zips copied here. claude.ai → Settings → Capabilities → Skills → Upload skill (one zip at a time).');
  process.exit(0);
}

if (has('--uninstall')) {
  const s = readSettings(); backup(); stripOurs(s);
  if (s.env && s.env.CLAUDE_CODE_SUBAGENT_MODEL === 'sonnet') delete s.env.CLAUDE_CODE_SUBAGENT_MODEL;
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
  try { fs.unlinkSync(SCRIPT); } catch {}
  if (has('--purge')) for (const k of SKILLS) fs.rmSync(path.join(CLAUDE, 'skills', k), { recursive: true, force: true });
  console.log('claude-kit removed. Your state files in ~/.claude/state/projects are kept.');
  process.exit(0);
}

console.log('claude-kit: installing into ' + CLAUDE);
copyDir(path.join(ROOT, 'kit', 'scripts'), path.join(CLAUDE, 'scripts'));
log('hook script: ' + SCRIPT);
for (const k of SKILLS) {
  const dst = path.join(CLAUDE, 'skills', k);
  if (fs.existsSync(dst) && !has('--force')) {
    const old = path.join(CLAUDE, 'skill-backups', k + '-' + Date.now());
    fs.mkdirSync(path.dirname(old), { recursive: true });
    fs.renameSync(dst, old);
    log(`skill ${k}: previous version kept at ${old}`);
  }
  copyDir(path.join(ROOT, 'kit', 'skills', k), dst);
  log('skill: /' + k);
}
const s = readSettings(); backup(); stripOurs(s);
addHook(s, 'SessionStart', 'startup|clear|compact|resume', 10);
addHook(s, 'PreCompact', 'auto|manual', 20);
addHook(s, 'SessionEnd', null, 20);
addHook(s, 'UserPromptSubmit', null, 10);
s.env = s.env || {};
if (!has('--keep-subagent-model') && !s.env.CLAUDE_CODE_SUBAGENT_MODEL) {
  s.env.CLAUDE_CODE_SUBAGENT_MODEL = 'sonnet';
  log('subagents default to Sonnet (pass a model explicitly for hard work)');
}
fs.mkdirSync(CLAUDE, { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
log('hooks: SessionStart, PreCompact, SessionEnd, UserPromptSubmit');
console.log('\nDone. Restart Claude Code. Use /save before /clear, /yaad to pick up, /kharcha to find waste.');
console.log('claude.ai web / Claude desktop chat: run  npx claude-yaad --zips  and upload the zips there.');
