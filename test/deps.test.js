import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { builtinModules } from 'module';

// Every bare import in the shipped code must be a Node builtin or a declared dependency.
// aam 0.0.58 imported @noble/hashes/utils, undeclared, and a fresh install resolved a major
// version without that subpath; the checkout hid it behind an old node_modules.
test('shipped code imports only declared dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const declared = new Set(Object.keys(pkg.dependencies || {}));
  const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
  const files = ['lib', 'bin'].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith('.js') || f.endsWith('.mjs')).map((f) => path.join(d, f)));
  const bad = [];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:^|\n)\s*import\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] || m[2];
      if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue;
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (!builtins.has(name) && !builtins.has(spec) && !declared.has(name)) bad.push(`${f}: ${spec}`);
    }
  }
  assert.deepStrictEqual(bad, [], `undeclared imports:\n${bad.join('\n')}`);
});
