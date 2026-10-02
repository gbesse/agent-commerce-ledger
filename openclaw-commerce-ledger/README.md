# Commerce Ledger — OpenClaw

## Français

Ce plugin OpenClaw enregistre les métadonnées des messages entrants et, sur option, les résultats d'envoi. Il ne conserve ni texte, ni identifiant de personne en clair. Il ne crée aucun contact et n'envoie aucun message.

La compétence `commerce-workflow` incluse guide la recherche dans incwo et la validation d'une relance lorsque le MCP incwo est connecté.

`protectedTools` peut nommer des outils à soumettre à une validation par appel. Les paramètres exacts sont liés à la demande par une empreinte HMAC, sans être copiés dans le reçu. La décision est conservée dans `approvals/` ; elle n'atteste pas que l'outil a ensuite réussi. Un identifiant d'appel manquant ou un échec d'écriture bloque l'appel protégé.

Installer depuis la racine de ce dépôt :

```sh
openclaw plugins install -l ./openclaw-commerce-ledger --force
openclaw plugins enable commerce-ledger
openclaw plugins inspect commerce-ledger --runtime --json
```

Configurer `plugins.entries.commerce-ledger.config` dans `openclaw.json` :

```json
{
  "allowedChannels": ["whatsapp"],
  "allowedSenders": ["sender-id-from-platform"],
  "captureOutbound": true,
  "protectedTools": ["incwo.create_invoice"],
  "locale": "fr"
}
```

Sans les deux listes, aucun message n'est consigné ; `protectedTools` fonctionne indépendamment. `captureOutbound` est désactivé par défaut. Chaque reçu est un JSON dans `~/.openclaw/commerce-ledger/events/` ; `dataDir` peut changer ce chemin. `observed` atteste seulement l'observation du hook, pas la lecture par le destinataire. Les événements sans identifiant de message stable sont ignorés.

## English

This OpenClaw plugin records inbound message metadata and, optionally, send results. It stores neither message text nor plaintext person identifiers. It does not create contacts or send messages. Install it with the commands above and set `plugins.entries.commerce-ledger.config` in `openclaw.json` to the JSON example above.

The bundled `commerce-workflow` skill guides incwo lookup and follow-up approval when incwo MCP is connected.

`protectedTools` can name tools that require approval for each call. An HMAC reference binds the exact arguments to the request without copying them into the receipt. The decision is stored in `approvals/`; it does not prove that the tool later succeeded. A missing call ID or write failure blocks the protected call.

No message is recorded without both allowlists; `protectedTools` works independently. `captureOutbound` defaults to false. Each receipt is a JSON file in `~/.openclaw/commerce-ledger/events/`; `dataDir` overrides the path. `observed` proves only that the hook was observed, not that the recipient read the message. Events without a stable message ID are skipped.

## Español

Este plugin de OpenClaw registra metadatos de mensajes entrantes y, de forma opcional, resultados de envío. No guarda el texto ni identificadores de personas en claro. No crea contactos ni envía mensajes. Instálalo con los comandos anteriores y configura `plugins.entries.commerce-ledger.config` en `openclaw.json` con el ejemplo JSON anterior.

La habilidad incluida `commerce-workflow` guía la búsqueda en incwo y la aprobación del seguimiento cuando el MCP de incwo está conectado.

`protectedTools` puede indicar herramientas que requieren aprobación en cada llamada. Una huella HMAC vincula los argumentos exactos a la solicitud sin copiarlos en el recibo. La decisión se guarda en `approvals/`; no demuestra que la herramienta haya terminado correctamente. Si falta el ID de llamada o falla la escritura, se bloquea la llamada protegida.

Sin las dos listas de permitidos no se registra ningún mensaje; `protectedTools` funciona de forma independiente. `captureOutbound` está desactivado por defecto. Cada recibo es un archivo JSON en `~/.openclaw/commerce-ledger/events/`; `dataDir` permite cambiar la ruta. `observed` solo prueba que se observó el hook, no que el destinatario leyó el mensaje. Se omiten los eventos sin un ID de mensaje estable.
