import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { recordReceipt } from '../openclaw-commerce-ledger/ledger.js';
import { registerCommerceHooks } from '../openclaw-commerce-ledger/runtime.js';

test('OpenClaw receipt hooks record only allowlisted metadata and deduplicate replay', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'commerce-ledger-'));
  const hooks = new Map();
  registerCommerceHooks({
    pluginConfig: {
      dataDir: directory,
      allowedChannels: ['whatsapp'],
      allowedSenders: ['person-1'],
      captureOutbound: true,
    },
    on(name, callback) {
      hooks.set(name, callback);
    },
  });
  const received = {
    senderId: 'person-1',
    messageId: 'message-1',
    content: 'PRIVATE USER CONTENT',
  };
  const context = { channelId: 'whatsapp', accountId: 'account-1' };
  await hooks.get('message_received')(received, context);
  await hooks.get('message_received')(received, context);
  await hooks.get('message_received')({ ...received, senderId: 'unlisted' }, context);
  await hooks.get('message_sent')(
    { to: 'person-1', messageId: 'outbound-1', success: true, content: 'PRIVATE OUTBOUND CONTENT' },
    context,
  );
  await hooks.get('message_sent')(
    { to: 'person-1', success: false, content: 'NO STABLE MESSAGE ID' },
    context,
  );
  await hooks.get('message_sent')(
    { to: 'person-1', messageId: 'retried-1', success: false },
    context,
  );
  await hooks.get('message_sent')(
    { to: 'person-1', messageId: 'retried-1', success: true },
    context,
  );
  const files = await readdir(join(directory, 'events'));
  assert.equal(files.length, 4);
  const contents = await Promise.all(
    files.map((file) => readFile(join(directory, 'events', file), 'utf8')),
  );
  assert.equal(
    contents.some((line) => line.includes('PRIVATE')),
    false,
  );
  assert.equal(
    contents.some((line) => line.includes('person-1')),
    false,
  );
  assert.deepEqual(contents.map((line) => JSON.parse(line).status).sort(), [
    'failed',
    'observed',
    'observed',
    'received',
  ]);
  assert.equal((await stat(join(directory, 'secret'))).mode & 0o777, 0o600);
});

test('Hermes plugin uses the same receipt identity and limits capture to allowed senders', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'commerce-ledger-cross-runtime-'));
  const sample = {
    kind: 'inbound',
    channel: 'whatsapp',
    account: 'account-1',
    partyId: 'person-1',
    messageId: 'message-1',
  };
  assert.equal((await recordReceipt(directory, sample)).recorded, true);
  const result = JSON.parse(
    execFileSync('python3', [resolve('test/hermes-commerce-ledger-smoke.py'), directory], {
      encoding: 'utf8',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
    }),
  );
  assert.equal(result.duplicate.reason, 'duplicate');
  assert.equal(result.files, 2);
  const files = await readdir(join(directory, 'events'));
  const contents = await Promise.all(
    files.map((file) => readFile(join(directory, 'events', file), 'utf8')),
  );
  assert.equal(
    contents.some((line) => line.includes('PRIVATE')),
    false,
  );
});

test('both extension packages ship the same FR/EN/ES commerce workflow', async () => {
  const paths = ['openclaw-commerce-ledger', 'hermes-commerce-ledger'].map((name) =>
    resolve(name, 'skills', 'commerce-workflow', 'SKILL.md'),
  );
  const [openclaw, hermes] = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
  assert.equal(openclaw, hermes);
  for (const language of ['Français', 'English', 'Español']) {
    assert.match(openclaw, new RegExp(`## ${language}`));
  }
});

test('OpenClaw approval binds a decision to the exact tool arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'commerce-approval-'));
  const hooks = new Map();
  registerCommerceHooks({
    pluginConfig: { dataDir: directory, protectedTools: ['incwo.create_invoice'], locale: 'es' },
    on(name, callback) {
      hooks.set(name, callback);
    },
  });
  const original = { amount: 42, customer: 'PRIVATE CUSTOMER' };
  const approval = await hooks.get('before_tool_call')({
    toolName: 'incwo.create_invoice',
    toolCallId: 'call-1',
    params: original,
  });
  assert.deepEqual(approval.requireApproval.allowedDecisions, ['allow-once', 'deny']);
  assert.match(approval.requireApproval.description, /Aprobar/);
  original.amount = 900;
  await approval.requireApproval.onResolution('allow-once');
  await hooks.get('after_tool_call')({
    toolName: 'incwo.create_invoice',
    toolCallId: 'call-1',
    params: { amount: 42, customer: 'PRIVATE CUSTOMER' },
  });
  const files = await readdir(join(directory, 'approvals'));
  assert.equal(files.length, 3);
  const receipts = await Promise.all(
    files.map((file) => readFile(join(directory, 'approvals', file), 'utf8').then(JSON.parse)),
  );
  assert.equal(new Set(receipts.map((item) => item.argsRef)).size, 1);
  assert.equal(JSON.stringify(receipts).includes('PRIVATE CUSTOMER'), false);
  assert.deepEqual(receipts.map((item) => item.status).sort(), [
    'allow-once',
    'requested',
    'returned',
  ]);
  assert.deepEqual(
    await hooks.get('before_tool_call')({ toolName: 'read', params: {} }),
    undefined,
  );
  assert.equal(
    (await hooks.get('before_tool_call')({ toolName: 'incwo.create_invoice', params: {} })).block,
    true,
  );
});
