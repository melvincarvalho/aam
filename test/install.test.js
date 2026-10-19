import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { addFromRepo, listInstalled, verifySkill, parseRepo, skillCandidates, getPubkeyFromPrivkey } from '../lib/index.js';

const TEST_PRIVKEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_PUBKEY = getPubkeyFromPrivkey(TEST_PRIVKEY);

// A skills.sh-style monorepo on disk: skills/<name>/SKILL.md
function monorepo(dir) {
  for (const name of ['alpha', 'beta']) {
    fs.mkdirSync(path.join(dir, 'skills', name), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: the ${name} skill\n---\n\n# ${name}\n\nDo ${name} things.\n`);
  }
  return dir;
}

describe('install: monorepos, signature labels, vouch', () => {
  let work, cwd;
  test.beforeEach(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-install-')); cwd = process.cwd(); process.chdir(work); });
  test.afterEach(() => { process.chdir(cwd); fs.rmSync(work, { recursive: true, force: true }); });

  test('skillCandidates: monorepo paths first, root for a single skill', () => {
    assert.deepStrictEqual(skillCandidates('x'), ['skills/x/SKILL.md', 'x/SKILL.md']);
    assert.deepStrictEqual(skillCandidates(null), ['SKILL.md']);
  });

  test('parseRepo: --skill names the install and refuses path tricks', () => {
    const r = parseRepo('remotion-dev/skills', { skill: 'remotion-best-practices' });
    assert.strictEqual(r.skillName, 'remotion-best-practices');
    assert.strictEqual(r.subpath, 'remotion-best-practices');
    assert.strictEqual(parseRepo('remotion-dev/skills').skillName, 'remotion-dev-skills');
    for (const bad of ['../x', 'a/b', '.hidden', 'a b']) assert.throws(() => parseRepo('o/r', { skill: bad }), /Invalid --skill/);
  });

  test('a local monorepo with --skill installs one skill under its own name, unsigned', async () => {
    const src = monorepo(path.join(work, 'src'));
    const r = await addFromRepo(`file://${src}`, { skill: 'beta' });
    assert.ok(r.success, r.error);
    assert.strictEqual(r.skill.name, 'beta');
    assert.strictEqual(r.signature.status, 'unsigned');
    assert.strictEqual(fs.readFileSync(path.join(work, '.claude/skills/beta/SKILL.md'), 'utf8'), fs.readFileSync(path.join(src, 'skills/beta/SKILL.md'), 'utf8'));
    assert.ok(!fs.existsSync(path.join(work, '.claude/skills/alpha')));
    const meta = JSON.parse(fs.readFileSync(path.join(work, '.claude/skills/beta/.aam.json'), 'utf8'));
    assert.strictEqual(meta.signature, 'unsigned');
    const list = listInstalled({});
    assert.deepStrictEqual(list.skills.map((s) => [s.name, s.signatureStatus]), [['beta', 'unsigned']]);
    const missing = await addFromRepo(`file://${src}`, { skill: 'gamma' });
    assert.strictEqual(missing.success, false);
  });

  test('--vouch signs the install with the installer key; list and verify agree', async () => {
    const src = monorepo(path.join(work, 'src'));
    const r = await addFromRepo(`file://${src}`, { skill: 'alpha', vouch: true, privkey: TEST_PRIVKEY });
    assert.ok(r.success, r.error);
    assert.deepStrictEqual(r.signature, { status: 'vouched', pubkey: TEST_PUBKEY });
    assert.ok(fs.existsSync(path.join(work, '.claude/skills/alpha/.aam.sig')));
    const v = verifySkill(path.join(work, '.claude/skills/alpha'), {});
    assert.ok(v.verified);
    assert.strictEqual(v.pubkey, TEST_PUBKEY);
    const list = listInstalled({});
    assert.strictEqual(list.skills[0].signatureStatus, 'vouched');
    assert.strictEqual(list.skills[0].signedBy, TEST_PUBKEY);
    const noKey = await addFromRepo(`file://${src}`, { skill: 'beta', vouch: true });
    assert.strictEqual(noKey.success, false);
    assert.match(noKey.error, /needs a key/);
    assert.ok(!fs.existsSync(path.join(work, '.claude/skills/beta')));
  });

  test('a signature that does not verify is refused, and kept only with force', async () => {
    const src = path.join(work, 'src');
    fs.mkdirSync(src, { recursive: true });
    fs.writeFileSync(path.join(src, 'SKILL.md'), '# bad\n\nhas a bogus signature\n');
    fs.writeFileSync(path.join(src, '.aam.sig'), JSON.stringify({ kind: 31337, pubkey: TEST_PUBKEY, sig: '00'.repeat(64), content: '{}', tags: [], created_at: 1, id: '00'.repeat(32) }));
    const r = await addFromRepo(`file://${src}`, {});
    assert.strictEqual(r.success, false);
    assert.match(r.error, /does not verify/);
    assert.ok(!fs.existsSync(path.join(work, '.claude/skills/src')));
    const forced = await addFromRepo(`file://${src}`, { force: true });
    assert.ok(forced.success, forced.error);
    assert.strictEqual(forced.signature.status, 'invalid');
  });
});

describe('skillDescription', () => {
  test('reads the frontmatter description, folded or quoted, else the first paragraph', async () => {
    const { skillDescription } = await import('../lib/index.js');
    assert.strictEqual(skillDescription('---\nname: x\ndescription: Build videos well\n---\n\n# x\n'), 'Build videos well');
    assert.strictEqual(skillDescription('---\nname: x\ndescription: >-\n  two\n  lines\nversion: 1\n---\n# x\n'), 'two lines');
    assert.strictEqual(skillDescription('---\nname: x\n---\n\n# x\n\nFirst paragraph.\n'), 'First paragraph.');
    assert.strictEqual(skillDescription('# x\n\nPlain.\n'), 'Plain.');
  });
});
