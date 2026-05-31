import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRuntimePaths, defaultRuntimePaths } from '../src/runtimePaths.mjs';

test('defaultRuntimePaths derive self-contained next-project roots from the root runtime surface', () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(testDir, '../..');

  assert.equal(defaultRuntimePaths.projectRoot, projectRoot);
  assert.equal(defaultRuntimePaths.runtimeRoot, path.join(projectRoot, 'app/src'));
  assert.equal(defaultRuntimePaths.publicRoot, path.join(projectRoot, 'app/public'));
  assert.equal(defaultRuntimePaths.configRoot, path.join(projectRoot, 'app/config'));
  assert.equal(defaultRuntimePaths.testsRoot, path.join(projectRoot, 'app/tests'));
  assert.equal(defaultRuntimePaths.canonicalAssetsRoot, path.join(projectRoot, 'assets/canonical'));
  assert.equal(defaultRuntimePaths.definitionsRoot, path.join(projectRoot, 'data/definitions/game_data'));
  assert.equal(defaultRuntimePaths.seedsRoot, path.join(projectRoot, 'data/seeds/game_data'));
  assert.equal(defaultRuntimePaths.mutableRoot, path.join(projectRoot, 'data/mutable/game_data'));
  assert.equal(defaultRuntimePaths.characterContentRoot, path.join(projectRoot, 'content/characters'));
  assert.equal(defaultRuntimePaths.canonicalVisualSetsRoot, path.join(projectRoot, 'assets/canonical/character_visual_sets'));
  assert.equal('sourceArchiveVisualSetsRoot' in defaultRuntimePaths, false);
});

test('createRuntimePaths resolves overrides against the next-project root', () => {
  const projectRoot = '/tmp/magic-adv-next';
  const paths = createRuntimePaths({ projectRoot });

  assert.equal(paths.projectRoot, projectRoot);
  assert.equal(paths.publicRoot, path.join(projectRoot, 'app/public'));
  assert.equal(paths.runtimeRoot, path.join(projectRoot, 'app/src'));
  assert.equal(paths.configRoot, path.join(projectRoot, 'app/config'));
  assert.equal(paths.testsRoot, path.join(projectRoot, 'app/tests'));
  assert.equal(paths.canonicalAssetsRoot, path.join(projectRoot, 'assets/canonical'));
  assert.equal('sourceArchiveVisualSetsRoot' in paths, false);
  assert.equal('assetsRoot' in paths, false);
});

test('canonical visual sets are materialized directories so zip copies do not depend on symlink preservation', async () => {
  const entries = await fs.readdir(defaultRuntimePaths.canonicalVisualSetsRoot, { withFileTypes: true });
  const visualSetEntries = entries.filter((entry) => /^visual_set_\d{3}$/.test(entry.name));
  assert.ok(visualSetEntries.length >= 50);
  for (const entry of visualSetEntries) {
    assert.equal(entry.isSymbolicLink(), false, `${entry.name} should be a real directory, not a symlink`);
    assert.equal(entry.isDirectory(), true, `${entry.name} should be a directory`);
  }
});

test('generated compatibility routes no longer require centralized runtime export trees or duplicated public mirrors', async () => {
  const duplicatedRoots = [
    path.join(defaultRuntimePaths.projectRoot, 'imports/snapshots/runtime-staging/public_generated_reference'),
    path.join(defaultRuntimePaths.projectRoot, 'imports/snapshots/runtime-staging/public_reference/generated'),
    path.join(defaultRuntimePaths.projectRoot, 'assets/runtime_exports')
  ];

  for (const duplicatedRoot of duplicatedRoots) {
    const exists = await fs.access(duplicatedRoot).then(() => true).catch(() => false);
    assert.equal(exists, false, `${duplicatedRoot} should not exist once generated compatibility resolves without runtime export mirrors`);
  }

  await fs.access(path.join(defaultRuntimePaths.canonicalAssetsRoot, 'title/title.png'));
  await fs.access(path.join(defaultRuntimePaths.canonicalAssetsRoot, 'backgrounds/manifest.json'));
});

test('canonical runtime asset roots exist for live-served browser images', async () => {
  for (const relativePath of [
    'character_visual_sets/visual_set_001/scene_standee/scene_standee_character_05.png',
    'backgrounds/background_001.png',
    'backgrounds/academy_overview_map.png',
    'title/title.png',
    'load/ig_033f91085286e813016a0319d2efb88191a39d2495960760cc.png',
    'ui/card_images/artifact_appraisal.png'
  ]) {
    await fs.access(path.join(defaultRuntimePaths.canonicalAssetsRoot, relativePath));
  }
});
