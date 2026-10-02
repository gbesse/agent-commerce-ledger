import { createHmac, randomBytes } from 'node:crypto';
import { chmod, link, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const clean = (value) =>
  typeof value === 'string' && value.length > 0 && value.length <= 512 ? value : null;

async function createIfAbsent(directory, name, bytes) {
  const path = join(directory, name);
  const temporary = join(directory, `.tmp-${randomBytes(16).toString('hex')}`);
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    try {
      await link(temporary, path);
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

async function secretFor(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = join(directory, 'secret');
  await createIfAbsent(directory, 'secret', randomBytes(32));
  await chmod(path, 0o600);
  const secret = await readFile(path);
  if (secret.length !== 32) throw new Error('E_SECRET_INVALID');
  return secret;
}

export async function recordApproval(directory, input) {
  const tool = clean(input.tool);
  const callId = clean(input.callId);
  const status = clean(input.status);
  if (
    !tool ||
    !callId ||
    !['requested', 'allow-once', 'deny', 'timeout', 'cancelled', 'returned', 'error'].includes(
      status,
    )
  ) {
    return { recorded: false, reason: 'missing_identity' };
  }
  const secret = await secretFor(directory);
  const digest = (...parts) =>
    createHmac('sha256', secret).update(JSON.stringify(parts)).digest('hex');
  const argsRef = digest('args', tool, input.params ?? {});
  const id = digest('approval', tool, callId, argsRef, status);
  const receipt = {
    schema: 'commerce-approval.v1',
    id,
    tool,
    callRef: digest('call', callId),
    argsRef,
    status,
    observedAt: new Date().toISOString(),
  };
  const events = join(directory, 'approvals');
  await mkdir(events, { recursive: true, mode: 0o700 });
  await chmod(events, 0o700);
  const recorded = await createIfAbsent(events, `${id}.json`, `${JSON.stringify(receipt)}\n`);
  return recorded ? { recorded: true, receipt } : { recorded: false, reason: 'duplicate' };
}

export async function recordReceipt(directory, input) {
  const kind = clean(input.kind);
  const channel = clean(input.channel);
  const account = clean(input.account) ?? 'default';
  const messageId = clean(input.messageId);
  const partyId = clean(input.partyId);
  if (!['inbound', 'outbound'].includes(kind) || !channel || !messageId || !partyId) {
    return { recorded: false, reason: 'missing_identity' };
  }
  const secret = await secretFor(directory);
  const digest = (...parts) =>
    createHmac('sha256', secret).update(JSON.stringify(parts)).digest('hex');
  const status = kind === 'inbound' ? 'received' : input.success === false ? 'failed' : 'observed';
  const id = digest(kind, channel, account, partyId, messageId, status);
  const receipt = {
    schema: 'commerce-ledger.v1',
    id,
    kind,
    channel,
    accountRef: digest('account', channel, account),
    partyRef: digest('party', channel, account, partyId),
    messageRef: digest('message', channel, account, messageId),
    status,
    observedAt: new Date().toISOString(),
  };
  const events = join(directory, 'events');
  await mkdir(events, { recursive: true, mode: 0o700 });
  await chmod(events, 0o700);
  const recorded = await createIfAbsent(events, `${id}.json`, `${JSON.stringify(receipt)}\n`);
  return recorded ? { recorded: true, receipt } : { recorded: false, reason: 'duplicate' };
}
