import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startServer } from '../src/server.mjs';

async function makeMissingConfigPath() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-startup-'));
  return {
    root,
    configPath: path.join(root, 'config', 'lmstudio.json')
  };
}

test('startServer starts on localhost without an LM Studio config file', async (t) => {
  const { root, configPath } = await makeMissingConfigPath();
  const started = await startServer({ port: 0, host: '127.0.0.1', lmStudioConfigPath: configPath, silent: true });
  t.after(async () => {
    await new Promise((resolve) => started.server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  assert.equal(started.host, '127.0.0.1');
  assert.equal(started.lmStudioConfig, null);
  assert.match(started.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  const response = await fetch(started.url);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Magic Academy Adventure Next|<html/i);

  const settingsResponse = await fetch(`${started.url}/api/settings/lmstudio`);
  assert.equal(settingsResponse.status, 200);
  const settingsBody = await settingsResponse.json();
  assert.equal(settingsBody.connection_mode, 'localhost');

  const openingResponse = await fetch(`${started.url}/api/conversation/opening`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ character_id: 'character_001', provider: 'lmstudio' })
  });
  assert.equal(openingResponse.status, 503);
  const openingBody = await openingResponse.json();
  assert.equal(openingBody.error_code, 'LMSTUDIO_CONFIG_REQUIRED');
});

test('startServer honors an explicit localhost host instead of broad default exposure', async (t) => {
  const { root, configPath } = await makeMissingConfigPath();
  const started = await startServer({ port: 0, host: '127.0.0.1', lmStudioConfigPath: configPath, silent: true });
  t.after(async () => {
    await new Promise((resolve) => started.server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  assert.equal(started.host, '127.0.0.1');
});

test('startServer rejects listen errors instead of hanging when the port is already occupied', async (t) => {
  const { root, configPath } = await makeMissingConfigPath();
  const first = await startServer({ port: 0, host: '127.0.0.1', lmStudioConfigPath: configPath, silent: true });
  t.after(async () => {
    await new Promise((resolve) => first.server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });

  await assert.rejects(
    startServer({ port: first.port, host: '127.0.0.1', lmStudioConfigPath: configPath, silent: true }),
    /EADDRINUSE|address already in use/
  );
});
