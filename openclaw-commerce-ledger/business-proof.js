import { randomBytes } from 'node:crypto';
import { chmod, link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { digestFor, hasAllowOnceApproval } from './ledger.js';

const identifier = (value) => {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof text === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(text) ? text : null;
};
const pathPattern = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const atPath = (object, path) =>
  path.split('.').reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), object);

function payload(result) {
  if (typeof result === 'string') {
    if (result.length > 65536) return null;
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }
  if (!result || typeof result !== 'object' || result.isError === true) return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }
  if (result.details && typeof result.details === 'object') return result.details;
  if (Array.isArray(result.content)) {
    const text = result.content.find((part) => part?.type === 'text')?.text;
    return payload(text);
  }
  return result;
}

export function validateBusinessProofs(rules, protectedTools) {
  if (rules == null) return [];
  if (!Array.isArray(rules) || rules.length > 16) throw new Error('E_PROOF_CONFIG');
  const seen = new Set();
  return rules.map((rule) => {
    if (
      !rule ||
      typeof rule !== 'object' ||
      !identifier(rule.writeTool) ||
      !identifier(rule.readTool) ||
      rule.writeTool === rule.readTool ||
      !identifier(rule.resource) ||
      !protectedTools.has(rule.writeTool) ||
      seen.has(rule.writeTool) ||
      !pathPattern.test(rule.writeIdPath ?? 'id') ||
      !pathPattern.test(rule.readIdPath ?? 'id') ||
      !identifier(rule.readIdParam ?? 'id') ||
      !identifier(rule.readResourceParam ?? 'object_type') ||
      !Array.isArray(rule.fields) ||
      rule.fields.length < 1 ||
      rule.fields.length > 16 ||
      rule.fields.some(
        (field) =>
          !field || !pathPattern.test(field.writePath ?? '') || !pathPattern.test(field.readPath ?? ''),
      )
    ) {
      throw new Error('E_PROOF_CONFIG');
    }
    seen.add(rule.writeTool);
    return {
      ...rule,
      writeIdPath: rule.writeIdPath ?? 'id',
      readIdPath: rule.readIdPath ?? 'id',
      readIdParam: rule.readIdParam ?? 'id',
      readResourceParam: rule.readResourceParam ?? 'object_type',
    };
  });
}

async function createOnce(directory, file, value) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const temporary = join(directory, `.tmp-${randomBytes(16).toString('hex')}`);
  try {
    await writeFile(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
    try {
      await link(temporary, join(directory, file));
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

async function recordWrite(directory, rule, event) {
  if (event.error || !identifier(event.toolCallId)) return [];
  if (!(await hasAllowOnceApproval(directory, {
    tool: event.toolName,
    callId: event.toolCallId,
    params: event.params,
  }))) return [];
  const output = payload(event.result);
  const objectId = identifier(atPath(output, rule.writeIdPath));
  if (!objectId) return [];
  const fields = [];
  for (const field of rule.fields) {
    const value = atPath(output, field.writePath);
    if (value === undefined) return [];
    fields.push({
      readPath: field.readPath,
      valueRef: await digestFor(directory, 'field', field.readPath, value),
    });
  }
  const objectRef = await digestFor(directory, 'object', rule.resource, objectId);
  const callRef = await digestFor(directory, 'call', event.toolCallId);
  const id = await digestFor(directory, 'business-action', rule.writeTool, callRef, objectRef);
  const receipt = {
    schema: 'commerce-business-action.v1',
    id,
    status: 'write_returned',
    tool: rule.writeTool,
    resource: rule.resource,
    objectRef,
    callRef,
    fields,
    observedAt: new Date().toISOString(),
  };
  const recorded = await createOnce(join(directory, 'business', 'actions'), `${objectRef}.${id}.json`, receipt);
  return recorded ? [receipt] : [];
}

async function recordReadback(directory, rule, event) {
  if (!identifier(event.toolCallId)) return [];
  const args = event.params ?? {};
  const objectId = identifier(args[rule.readIdParam]);
  if (!objectId || args[rule.readResourceParam] !== rule.resource) return [];
  const objectRef = await digestFor(directory, 'object', rule.resource, objectId);
  const actions = join(directory, 'business', 'actions');
  let names;
  try {
    names = (await readdir(actions)).filter((name) => name.startsWith(`${objectRef}.`));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  if (names.length > 1000) throw new Error('E_PROOF_LIMIT');
  const output = payload(event.result);
  const readId = identifier(atPath(output, rule.readIdPath));
  const observed = [];
  for (const name of names) {
    const action = JSON.parse(await readFile(join(actions, name), 'utf8'));
    if (action.tool !== rule.writeTool || action.resource !== rule.resource) continue;
    if (action.callRef === await digestFor(directory, 'call', event.toolCallId)) continue;
    let status = 'unavailable';
    if (!event.error && output) {
      status = 'mismatch';
      if (readId === objectId) {
        const checks = await Promise.all(
          action.fields.map(async (field) => {
            const value = atPath(output, field.readPath);
            return (
              value !== undefined &&
              (await digestFor(directory, 'field', field.readPath, value)) === field.valueRef
            );
          }),
        );
        status = checks.every(Boolean) ? 'verified' : 'mismatch';
      }
    }
    const readCallRef = await digestFor(directory, 'call', event.toolCallId);
    const id = await digestFor(directory, 'business-readback', action.id, readCallRef, status);
    const receipt = {
      schema: 'commerce-business-readback.v1',
      id,
      actionRef: action.id,
      objectRef,
      readCallRef,
      status,
      observedAt: new Date().toISOString(),
    };
    if (await createOnce(join(directory, 'business', 'readbacks'), `${id}.json`, receipt)) {
      observed.push(receipt);
    }
  }
  return observed;
}

export async function observeBusinessEvent(directory, rules, event) {
  const receipts = [];
  for (const rule of rules) {
    if (event.toolName === rule.writeTool) receipts.push(...(await recordWrite(directory, rule, event)));
    if (event.toolName === rule.readTool) receipts.push(...(await recordReadback(directory, rule, event)));
  }
  return receipts;
}
