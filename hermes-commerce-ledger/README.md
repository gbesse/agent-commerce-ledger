# Commerce Ledger — Hermes

## Français

Ce plugin Hermes consigne les métadonnées des messages entrants présents sur une liste explicite, sans enregistrer le texte ni les identifiants de personne en clair. Il ne crée aucun contact et n'envoie aucun message.

La compétence `commerce-workflow` incluse guide la recherche dans incwo et la validation d'une relance lorsque le MCP incwo est connecté.

`protected_tools` peut nommer des outils soumis à la validation du moteur Hermes. Une empreinte HMAC des paramètres est enregistrée dans `approvals/`, avec la décision observée si elle arrive avec le même `tool_call_id`. Un identifiant absent ou un échec d'écriture bloque l'appel. La configuration d'Hermes détermine si la validation est humaine ou automatique ; un reçu ne prouve pas l'exécution de l'outil.

`business_proofs` rapproche une écriture validée pour une seule fois (`once`) d'une lecture indépendante. Configurer `write_tool`, `read_tool`, `resource`, `fields` avec `write_path` et `read_path`, et si nécessaire `write_id_path`, `read_id_path`, `read_id_param`, `read_resource_param`. Les reçus `business/actions/` et `business/readbacks/` stockent des empreintes HMAC ; une relecture correspondante produit `verified`, une différence `mismatch`, une lecture en erreur `unavailable`. La lecture doit être déclenchée séparément ; adapter les chemins aux résultats réels de l'outil.

Copier ce dossier dans `~/.hermes/plugins/commerce-ledger/`, puis exécuter :

```sh
hermes plugins doctor ~/.hermes/plugins/commerce-ledger --ci
hermes plugins enable commerce-ledger
```

Dans `~/.hermes/config.yaml`, définir `plugins.entries.commerce-ledger.settings.allowed_platforms: [whatsapp]` et `allowed_senders: ["sender-id-from-platform"]`. Sans ces listes, aucun message n'est consigné ; `protected_tools` fonctionne indépendamment. Il utilise le dossier de données du profil Hermes, sauf si `data_dir` est défini.

Le hook `pre_gateway_dispatch` intervient avant l'autorisation du gateway. La liste du plugin doit rester au moins aussi restrictive que celle du gateway. Hermes ne fournit pas à ce plugin de reçu d'envoi équivalent à celui d'OpenClaw.

## English

This Hermes plugin records metadata for explicitly allowlisted inbound messages without storing message text or plaintext person identifiers. It does not create contacts or send messages. Copy this directory to `~/.hermes/plugins/commerce-ledger/`, then run the commands above.

The bundled `commerce-workflow` skill guides incwo lookup and follow-up approval when incwo MCP is connected.

`protected_tools` can name tools subject to Hermes approval. An HMAC reference to the arguments is stored in `approvals/`, together with an observed decision when it arrives with the same `tool_call_id`. A missing ID or write failure blocks the call. Hermes configuration determines whether approval is human or automatic; a receipt does not prove tool execution.

`business_proofs` correlates a one-time (`once`) approved write with an independent read. Configure `write_tool`, `read_tool`, `resource`, `fields` with `write_path` and `read_path`, and optionally `write_id_path`, `read_id_path`, `read_id_param`, `read_resource_param`. The `business/actions/` and `business/readbacks/` receipts store HMAC references; a matching read produces `verified`, a difference `mismatch`, and a failed read `unavailable`. Trigger the read separately and adjust paths to actual tool results.

Set `plugins.entries.commerce-ledger.settings.allowed_platforms: [whatsapp]` and `allowed_senders: ["sender-id-from-platform"]` in `~/.hermes/config.yaml`. No message is recorded without both lists; `protected_tools` works independently. The Hermes profile data directory is used unless `data_dir` is set. The `pre_gateway_dispatch` hook runs before gateway authorization, so the plugin allowlist must be at least as restrictive as the gateway's. Hermes does not expose an equivalent outbound receipt to this plugin.

## Español

Este plugin de Hermes registra metadatos de mensajes entrantes incluidos en listas explícitas, sin guardar texto ni identificadores de personas en claro. No crea contactos ni envía mensajes. Copia este directorio a `~/.hermes/plugins/commerce-ledger/` y ejecuta los comandos anteriores.

La habilidad incluida `commerce-workflow` guía la búsqueda en incwo y la aprobación del seguimiento cuando el MCP de incwo está conectado.

`protected_tools` puede indicar herramientas sometidas a la aprobación de Hermes. En `approvals/` se guarda una huella HMAC de los argumentos y la decisión observada si llega con el mismo `tool_call_id`. La falta de ID o un fallo de escritura bloquea la llamada. La configuración de Hermes determina si la aprobación es humana o automática; un recibo no demuestra la ejecución de la herramienta.

`business_proofs` relaciona una escritura aprobada para una sola vez (`once`) con una lectura independiente. Configura `write_tool`, `read_tool`, `resource`, `fields` con `write_path` y `read_path`, y opcionalmente `write_id_path`, `read_id_path`, `read_id_param`, `read_resource_param`. Los recibos de `business/actions/` y `business/readbacks/` guardan referencias HMAC; una lectura coincidente produce `verified`, una diferencia `mismatch` y un error de lectura `unavailable`. Inicia la lectura por separado y adapta las rutas a los resultados reales de la herramienta.

Define `plugins.entries.commerce-ledger.settings.allowed_platforms: [whatsapp]` y `allowed_senders: ["sender-id-from-platform"]` en `~/.hermes/config.yaml`. Sin ambas listas no se registra ningún mensaje; `protected_tools` funciona de forma independiente. Se usa el directorio de datos del perfil Hermes salvo que se configure `data_dir`. El hook `pre_gateway_dispatch` se ejecuta antes de la autorización del gateway; la lista del plugin debe ser al menos tan restrictiva como la del gateway. Hermes no ofrece a este plugin un recibo saliente equivalente.
