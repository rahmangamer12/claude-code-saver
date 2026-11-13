#!/usr/bin/env node
// claude-yaad installer: npx claude-yaad            -> install / update everything (Claude Code + claude.ai zips)
//                       npx claude-yaad --yes      -> same, and open the claude.ai Skills page without asking
//                       npx claude-yaad --zips     -> only write the claude.ai skill zips into the current folder
//                       npx claude-yaad --uninstall -> remove hooks + kit files (skills kept unless --purge)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const cp = require('child_process');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const VERSION = require(path.join(ROOT, 'package.json')).version;
const CLAUDE = path.join(os.homedir(), '.claude');
const SETTINGS = path.join(CLAUDE, 'settings.json');
const SCRIPT = path.join(CLAUDE, 'scripts', 'ck_state.js');
const META = path.join(CLAUDE, 'state', 'claude-yaad.json');
const ZIPDIR = path.join(CLAUDE, 'claude-yaad-zips');
const SKILLS_URL = 'https://claude.ai/settings/capabilities';
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
function readJSON(f, dflt) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return dflt; } }
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

// ---- claude.ai skill zips, built from kit/skills so they never drift from the Claude Code skills ----
const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) { let c = -1; for (const x of buf) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function makeZip(entries) {
  const d = new Date();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const local = [], central = [];
  let off = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'), comp = zlib.deflateRawSync(e.data), crc = crc32(e.data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(e.data.length, 22); h.writeUInt16LE(name.length, 26);
    local.push(h, name, comp);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10); c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(e.data.length, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...local, cd, end]);
}
function skillEntries(dir, prefix) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name), n = prefix + '/' + e.name;
    if (e.isDirectory()) out.push(...skillEntries(p, n)); else out.push({ name: n, data: fs.readFileSync(p) });
  }
  return out;
}
function writeZips(dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const k of SKILLS) fs.writeFileSync(path.join(dst, k + '.zip'), makeZip(skillEntries(path.join(ROOT, 'kit', 'skills', k), k)));
}

function openThing(target) {
  try {
    const o = { detached: true, stdio: 'ignore' };
    if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '""', `"${target}"`], { ...o, windowsVerbatimArguments: true, windowsHide: true }).unref();
    else cp.spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], o).unref();
    return true;
  } catch { return false; }
}
function ask(q) {
  if (has('--yes') || has('-y')) return Promise.resolve(true);
  if (has('--no-open') || !process.stdin.isTTY) return Promise.resolve(false);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(!/^\s*n/i.test(a)); }));
}

async function main() {
  if (has('--zips')) {
    writeZips(process.cwd());
    console.log('Skill zips written here: ' + SKILLS.map((k) => k + '.zip').join(', '));
    console.log('claude.ai → Settings → Capabilities → Skills → Upload skill (one zip at a time).');
    return;
  }

  if (has('--uninstall')) {
    const s = readSettings(); backup(); stripOurs(s);
    if (s.env && s.env.CLAUDE_CODE_SUBAGENT_MODEL === 'sonnet') delete s.env.CLAUDE_CODE_SUBAGENT_MODEL;
    if (s.env && s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW === '150k') delete s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW;
    fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
    for (const f of [SCRIPT, META]) try { fs.unlinkSync(f); } catch {}
    fs.rmSync(ZIPDIR, { recursive: true, force: true });
    if (has('--purge')) for (const k of SKILLS) fs.rmSync(path.join(CLAUDE, 'skills', k), { recursive: true, force: true });
    console.log('claude-yaad removed. Your state files in ~/.claude/state/projects are kept.');
    return;
  }

  const prev = readJSON(META, {});
  console.log(prev.version && prev.version !== VERSION
    ? `claude-yaad: updating ${prev.version} → ${VERSION} in ${CLAUDE}`
    : `claude-yaad ${VERSION}: installing into ${CLAUDE}`);

  // 1. Claude Code: hook script, skills, hooks, env
  copyDir(path.join(ROOT, 'kit', 'scripts'), path.join(CLAUDE, 'scripts'));
  log('hook script: ' + SCRIPT);
  for (const k of SKILLS) {
    const dst = path.join(CLAUDE, 'skills', k);
    // A skill we installed before is simply replaced; anyone else's skill with this name is kept aside.
    if (fs.existsSync(dst) && !prev.version && !has('--force')) {
      const old = path.join(CLAUDE, 'skill-backups', k + '-' + Date.now());
      fs.mkdirSync(path.dirname(old), { recursive: true });
      fs.renameSync(dst, old);
      log(`skill ${k}: previous version kept at ${old}`);
    } else fs.rmSync(dst, { recursive: true, force: true });
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
  if (!has('--keep-compact-window') && !s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW && !s.autoCompactWindow) {
    s.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = '150k';
    log('auto-compact window 150k: sessions never grow huge, so every message stays cheap');
  }
  fs.mkdirSync(CLAUDE, { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(s, null, 2));
  log('hooks: SessionStart, PreCompact, SessionEnd, UserPromptSubmit');
  log('auto-update: once a day the hook checks npm and Claude offers the update (CK_NO_UPDATE_CHECK=1 turns it off)');
  fs.mkdirSync(path.dirname(META), { recursive: true });
  fs.writeFileSync(META, JSON.stringify({ version: VERSION, installed: new Date().toISOString(), latest: VERSION, lastCheck: Date.now() }, null, 2));

  // 2. claude.ai web / Claude desktop chat: zips ready to upload
  writeZips(ZIPDIR);
  log('claude.ai skill zips: ' + ZIPDIR);

  console.log('\nDone. Restart Claude Code (and any long-running sessions) so the new settings apply.');
  console.log('Use /save before /clear, /yaad to pick up, /kharcha to find waste.\n');

  if (await ask('Open the claude.ai Skills page and the zips folder now, for web/desktop chat? [Y/n] ')) {
    openThing(SKILLS_URL);
    openThing(ZIPDIR);
    console.log('\nOn claude.ai: Skills → Upload skill → drag save.zip, then yaad.zip, then kharcha.zip.');
    console.log('(If the page does not show Skills, go to Settings → Capabilities.)');
  } else {
    console.log('For claude.ai web/desktop chat later: upload the three zips in ' + ZIPDIR);
    console.log('at ' + SKILLS_URL + ' → Skills → Upload skill.');
  }
}

main().catch((e) => { console.error('claude-yaad: ' + (e && e.message || e)); process.exit(1); });
