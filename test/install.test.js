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

describe('review fixes', () => {
  test('a tree with no root SKILL.md (a cloned monorepo) is unsigned, not invalid, and is kept', async () => {
    const { finishInstall } = await import('../lib/index.js');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-clone-'));
    fs.mkdirSync(path.join(dir, 'skills', 'a'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'skills', 'a', 'SKILL.md'), '# a\n');
    const r = finishInstall(dir, { name: 'repo', repo: 'o/r' }, {}, { repo: 'o/r' });
    assert.ok(r.success, r.error);
    assert.strictEqual(r.signature.status, 'unsigned');
    assert.ok(fs.existsSync(path.join(dir, 'skills', 'a', 'SKILL.md')));
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('a --skill install remembers its skill name for update', async () => {
    const { parseRepo } = await import('../lib/index.js');
    // the light path records skillInfo.skill = subpath; the local path mirrors it through parseRepo
    assert.strictEqual(parseRepo('o/r', { skill: 'alpha' }).subpath, 'alpha');
    const src = path.join(os.tmpdir(), `aam-src-${Date.now()}`);
    fs.mkdirSync(path.join(src, 'skills', 'alpha'), { recursive: true });
    fs.writeFileSync(path.join(src, 'skills', 'alpha', 'SKILL.md'), '---\nname: alpha\ndescription: a\n---\n# a\n');
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-upd-'));
    const cwd = process.cwd(); process.chdir(work);
    try {
      const r = await addFromRepo(`file://${src}`, { skill: 'alpha' });
      assert.ok(r.success, r.error);
      assert.strictEqual(r.skill.name, 'alpha');
    } finally { process.chdir(cwd); fs.rmSync(work, { recursive: true, force: true }); fs.rmSync(src, { recursive: true, force: true }); }
  });
});

describe('signatureStatus is one answer everywhere', () => {
  test('list says unsigned for a package-only install with no root SKILL.md', async () => {
    const { signatureStatus } = await import('../lib/index.js');
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-pkg-'));
    const cwd = process.cwd(); process.chdir(work);
    try {
      const dir = path.join(work, '.claude', 'skills', 'pkg');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'pkg', version: '1.0.0' }));
      assert.deepStrictEqual(signatureStatus(dir), { status: 'unsigned' });
      const list = listInstalled({});
      assert.deepStrictEqual(list.skills.map((s) => [s.name, s.signatureStatus]), [['pkg', 'unsigned']]);
    } finally { process.chdir(cwd); fs.rmSync(work, { recursive: true, force: true }); }
  });
});

describe('a skill is a directory', () => {
  test('skillTreeFilter: everything under a --skill directory; only the conventional dirs beside a root SKILL.md', async () => {
    const { skillTreeFilter } = await import('../lib/index.js');
    assert.strictEqual(skillTreeFilter('remotion-render/REFERENCE.md', true), true);
    assert.strictEqual(skillTreeFilter('SKILL.md', true), false);
    assert.strictEqual(skillTreeFilter('../x', true), false);
    assert.strictEqual(skillTreeFilter('/etc/x', true), false);
    assert.strictEqual(skillTreeFilter('references/a.md', false), true);
    assert.strictEqual(skillTreeFilter('scripts/run.sh', false), true);
    assert.strictEqual(skillTreeFilter('README.md', false), false);
    assert.strictEqual(skillTreeFilter('package.json', false), false);
  });

  test('fetchSkillTree lists one tree and fetches the files under the skill directory, within caps', async () => {
    const { fetchSkillTree } = await import('../lib/index.js');
    const calls = [];
    const tree = { tree: [
      { type: 'blob', path: 'skills/x/SKILL.md', size: 10 },
      { type: 'blob', path: 'skills/x/remotion-render/REFERENCE.md', size: 20 },
      { type: 'blob', path: 'skills/x/assets/a.png', size: 30 },
      { type: 'blob', path: 'skills/y/SKILL.md', size: 10 },
      { type: 'tree', path: 'skills/x/assets', size: 0 },
      { type: 'blob', path: 'README.md', size: 5 },
    ] };
    const fetch = async (url) => {
      calls.push(url);
      if (url.includes('/git/trees/')) return { ok: true, json: async () => tree };
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode(`body of ${url.split('/').pop()}`).buffer };
    };
    const r = await fetchSkillTree('o', 'r', 'main', 'skills/x', { fetch });
    assert.strictEqual(r.error, undefined);
    assert.deepStrictEqual(r.files.map((f) => f.path).sort(), ['assets/a.png', 'remotion-render/REFERENCE.md']);
    assert.strictEqual(calls.filter((u) => u.includes('/git/trees/')).length, 1);
    assert.match(calls[0], /api\.github\.com\/repos\/o\/r\/git\/trees\/main\?recursive=1/);
    const capped = await fetchSkillTree('o', 'r', 'main', 'skills/x', { fetch, maxFiles: 1 });
    assert.match(capped.error, /over the cap/);
    const down = await fetchSkillTree('o', 'r', 'main', 'skills/x', { fetch: async () => ({ ok: false, status: 403 }) });
    assert.match(down.error, /HTTP 403/);
    const trunc = await fetchSkillTree('o', 'r', 'main', 'skills/x', { fetch: async (url) => url.includes('/git/trees/') ? { ok: true, json: async () => ({ ...tree, truncated: true }) } : { ok: true, arrayBuffer: async () => new ArrayBuffer(1) } });
    assert.strictEqual(trunc.truncated, true);                        // surfaced, so install can warn
  });

  test('a local --skill install copies the whole skill directory; a root install copies only the conventional dirs', async () => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-tree-'));
    const cwd = process.cwd(); process.chdir(work);
    try {
      const src = path.join(work, 'src');
      fs.mkdirSync(path.join(src, 'skills', 'x', 'remotion-render'), { recursive: true });
      fs.writeFileSync(path.join(src, 'skills', 'x', 'SKILL.md'), '# x\n');
      fs.writeFileSync(path.join(src, 'skills', 'x', 'remotion-render', 'REFERENCE.md'), 'render\n');
      const r = await addFromRepo(`file://${src}`, { skill: 'x' });
      assert.ok(r.success, r.error);
      assert.strictEqual(fs.readFileSync(path.join(work, '.claude/skills/x/remotion-render/REFERENCE.md'), 'utf8'), 'render\n');
      assert.deepStrictEqual(r.skill.files.map((f) => f.path), ['remotion-render/REFERENCE.md']);
      const root = path.join(work, 'rootskill');
      fs.mkdirSync(path.join(root, 'references'), { recursive: true });
      fs.writeFileSync(path.join(root, 'SKILL.md'), '# root\n');
      fs.writeFileSync(path.join(root, 'references', 'r.md'), 'ref\n');
      fs.writeFileSync(path.join(root, 'README.md'), 'not a skill file\n');
      const r2 = await addFromRepo(`file://${root}`, {});
      assert.ok(r2.success, r2.error);
      assert.ok(fs.existsSync(path.join(work, '.claude/skills/rootskill/references/r.md')));
      assert.ok(!fs.existsSync(path.join(work, '.claude/skills/rootskill/README.md')));
    } finally { process.chdir(cwd); fs.rmSync(work, { recursive: true, force: true }); }
  });
});
