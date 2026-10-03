import { homedir } from 'node:os';
import { join } from 'node:path';
import { recordApproval, recordReceipt } from './ledger.js';
import { observeBusinessEvent, validateBusinessProofs } from './business-proof.js';

const approvalCopy = {
  fr: ['Autoriser une action métier', 'Valider cet appel de {tool} avec ses paramètres exacts ?'],
  en: ['Approve a business action', 'Approve this {tool} call with its exact parameters?'],
  es: [
    'Autorizar una acción empresarial',
    '¿Aprobar esta llamada a {tool} con sus parámetros exactos?',
  ],
};

const approvalErrors = {
  fr: {
    callId: "Action bloquée : l'identifiant d'appel est absent.",
    params: 'Action bloquée : les paramètres sont invalides ou trop volumineux.',
    write: "Action bloquée : le reçu d'autorisation n'a pas pu être enregistré.",
  },
  en: {
    callId: 'Action blocked: the call ID is missing.',
    params: 'Action blocked: the arguments are invalid or too large.',
    write: 'Action blocked: the approval receipt could not be saved.',
  },
  es: {
    callId: 'Acción bloqueada: falta el ID de la llamada.',
    params: 'Acción bloqueada: los argumentos no son válidos o son demasiado grandes.',
    write: 'Acción bloqueada: no se pudo guardar el recibo de autorización.',
  },
};

export function registerCommerceHooks(api) {
  const config = api.pluginConfig ?? {};
  const allowedChannels = new Set(config.allowedChannels ?? []);
  const allowedSenders = new Set(config.allowedSenders ?? []);
  const directory = config.dataDir ?? join(homedir(), '.openclaw', 'commerce-ledger');
  const observe = async (kind, event, ctx = {}) => {
    const channel = ctx.channelId ?? event.channel;
    const partyId = kind === 'inbound' ? (event.senderId ?? ctx.senderId ?? event.from) : event.to;
    if (!allowedChannels.has(channel) || !allowedSenders.has(partyId)) return;
    const messageId = event.messageId ?? ctx.messageId;
    try {
      await recordReceipt(directory, {
        kind,
        channel,
        account: ctx.accountId ?? 'default',
        messageId,
        partyId,
        success: event.success,
      });
    } catch (error) {
      api.logger?.warn?.(`commerce-ledger:E_WRITE (${error.code ?? 'error'})`);
    }
  };
  api.on('message_received', (event, ctx) => observe('inbound', event, ctx));
  if (config.captureOutbound === true) {
    api.on('message_sent', (event, ctx) => observe('outbound', event, ctx));
  }
  const protectedTools = new Set(config.protectedTools ?? []);
  const businessProofs = validateBusinessProofs(config.businessProofs, protectedTools);
  const [title, description] = approvalCopy[config.locale] ?? approvalCopy.fr;
  const errors = approvalErrors[config.locale] ?? approvalErrors.fr;
  if (protectedTools.size > 0) {
    api.on('before_tool_call', async (event) => {
      if (!protectedTools.has(event.toolName)) return;
      const callId = event.toolCallId;
      if (typeof callId !== 'string' || !callId) {
        return { block: true, blockReason: errors.callId };
      }
      let params;
      try {
        params = JSON.parse(JSON.stringify(event.params ?? {}));
        if (JSON.stringify(params).length > 65536) {
          return { block: true, blockReason: errors.params };
        }
      } catch {
        return { block: true, blockReason: errors.params };
      }
      try {
        await recordApproval(directory, {
          tool: event.toolName,
          callId,
          params,
          status: 'requested',
        });
      } catch (error) {
        api.logger?.warn?.(`commerce-ledger:E_APPROVAL_WRITE (${error.code ?? 'error'})`);
        return { block: true, blockReason: errors.write };
      }
      return {
        requireApproval: {
          title,
          description: description.replace('{tool}', event.toolName),
          severity: 'warning',
          allowedDecisions: ['allow-once', 'deny'],
          onResolution: async (decision) => {
            try {
              await recordApproval(directory, {
                tool: event.toolName,
                callId,
                params,
                status: decision,
              });
            } catch (error) {
              api.logger?.warn?.(`commerce-ledger:E_APPROVAL_WRITE (${error.code ?? 'error'})`);
            }
          },
        },
      };
    });
    api.on('after_tool_call', async (event) => {
      if (protectedTools.has(event.toolName) && event.toolCallId) {
        try {
          await recordApproval(directory, {
            tool: event.toolName,
            callId: event.toolCallId,
            params: event.params,
            status: event.error ? 'error' : 'returned',
          });
        } catch (error) {
          api.logger?.warn?.(`commerce-ledger:E_RESULT_WRITE (${error.code ?? 'error'})`);
        }
      }
      if (businessProofs.length > 0) {
        try {
          await observeBusinessEvent(directory, businessProofs, event);
        } catch (error) {
          api.logger?.warn?.(`commerce-ledger:E_PROOF_WRITE (${error.code ?? 'error'})`);
        }
      }
    });
  }
}
