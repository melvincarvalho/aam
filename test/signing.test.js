import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  signSkill,
  verifySkill,
  signAgent,
  verifyAgent,
  getPubkeyFromPrivkey
} from '../lib/index.js';

// Test private key (DO NOT use in production - this is for testing only)
const TEST_PRIVKEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const TEST_PUBKEY = getPubkeyFromPrivkey(TEST_PRIVKEY);

describe('Signing and Verification', () => {
  let tempDir;

  // Setup temp directory before tests
  test.beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aam-test-'));
  });

  // Cleanup after tests
  test.afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('getPubkeyFromPrivkey returns correct pubkey', () => {
    const pubkey = getPubkeyFromPrivkey(TEST_PRIVKEY);
    assert.strictEqual(typeof pubkey, 'string');
    assert.strictEqual(pubkey.length, 64); // 32 bytes hex
  });

  test('signSkill creates .aam.sig file', () => {
    // Create test skill
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nThis is a test.');

    const result = signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/test-skill' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pubkey, TEST_PUBKEY);
    assert.ok(fs.existsSync(path.join(skillDir, '.aam.sig')));
  });

  test('verifySkill returns verified for signed skill', () => {
    // Create and sign test skill
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nThis is a test.');

    signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/test-skill' });

    const result = verifySkill(skillDir);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.pubkey, TEST_PUBKEY);
  });

  test('verifySkill returns unsigned for skill without signature', () => {
    // Create test skill without signing
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nThis is a test.');

    const result = verifySkill(skillDir);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, false);
    assert.strictEqual(result.unsigned, true);
  });

  test('verifySkill detects content modification', () => {
    // Create and sign test skill
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nOriginal content.');

    signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/test-skill' });

    // Modify content after signing
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n\nModified content!');

    const result = verifySkill(skillDir);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, false);
    assert.ok(result.error.includes('hash mismatch'));
  });

  test('verifySkill validates expected pubkey', () => {
    // Create and sign test skill
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill');

    signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/test-skill' });

    // Verify with wrong expected pubkey
    const result = verifySkill(skillDir, { expectedPubkey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, false);
    assert.ok(result.error.includes('expected'));
  });

  test('signAgent creates sidecar .aam.sig file', () => {
    // Create test agent
    const agentPath = path.join(tempDir, 'test-agent.md');
    fs.writeFileSync(agentPath, '---\nname: Test Agent\n---\n\n# Test Agent');

    const result = signAgent(agentPath, TEST_PRIVKEY, { repo: 'test/test-agent' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.pubkey, TEST_PUBKEY);
    assert.ok(fs.existsSync(path.join(tempDir, '.test-agent.aam.sig')));
  });

  test('verifyAgent returns verified for signed agent', () => {
    // Create and sign test agent
    const agentPath = path.join(tempDir, 'test-agent.md');
    fs.writeFileSync(agentPath, '---\nname: Test Agent\n---\n\n# Test Agent');

    signAgent(agentPath, TEST_PRIVKEY, { repo: 'test/test-agent' });

    const result = verifyAgent(agentPath);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.pubkey, TEST_PUBKEY);
  });

  test('verifyAgent detects content modification', () => {
    // Create and sign test agent
    const agentPath = path.join(tempDir, 'test-agent.md');
    fs.writeFileSync(agentPath, '---\nname: Test Agent\n---\n\nOriginal.');

    signAgent(agentPath, TEST_PRIVKEY, { repo: 'test/test-agent' });

    // Modify content after signing
    fs.writeFileSync(agentPath, '---\nname: Test Agent\n---\n\nModified!');

    const result = verifyAgent(agentPath);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verified, false);
    assert.ok(result.error.includes('hash mismatch'));
  });

  test('signSkill fails without SKILL.md', () => {
    const skillDir = path.join(tempDir, 'empty-skill');
    fs.mkdirSync(skillDir);

    const result = signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/empty' });

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found'));
  });

  test('signSkill fails without repo', () => {
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test');

    const result = signSkill(skillDir, TEST_PRIVKEY, {});

    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Repository not specified'));
  });

  test('signature event has correct kind 31337', () => {
    const skillDir = path.join(tempDir, 'test-skill');
    fs.mkdirSync(skillDir);
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test');

    signSkill(skillDir, TEST_PRIVKEY, { repo: 'test/test-skill' });

    const sigFile = path.join(skillDir, '.aam.sig');
    const event = JSON.parse(fs.readFileSync(sigFile, 'utf8'));

    assert.strictEqual(event.kind, 31337);
    assert.ok(event.tags.find(t => t[0] === 'd' && t[1] === 'test/test-skill'));
    assert.ok(event.tags.find(t => t[0] === 't' && t[1] === 'skill'));
    assert.ok(event.tags.find(t => t[0] === 'hash'));
  });
});
