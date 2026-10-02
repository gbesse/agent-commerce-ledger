import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry';
import { registerCommerceHooks } from './runtime.js';

export default definePluginEntry({
  id: 'commerce-ledger',
  name: 'Commerce Ledger',
  description:
    'FR : reçus sans contenu des messages ; EN: receipts without message content; ES: recibos sin contenido de mensajes',
  register: registerCommerceHooks,
});
