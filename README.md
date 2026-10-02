# Agent Commerce Ledger — OpenClaw et Hermes / OpenClaw and Hermes / OpenClaw y Hermes

## Français

Deux plugins natifs consignent les identifiants de messages commerciaux autorisés dans un format commun. [OpenClaw](openclaw-commerce-ledger/) observe les messages entrants et, sur option, les résultats d'envoi. [Hermes](hermes-commerce-ledger/) observe les messages entrants du gateway. Les deux suppriment les doublons après redémarrage et stockent des empreintes HMAC des identifiants, sans corps de message, numéro de téléphone ni adresse en clair.

Chaque extension embarque la compétence `commerce-workflow` en français, anglais et espagnol. Elle guide la recherche d'un contact incwo, la préparation d'une relance et la validation humaine avant écriture ou envoi, si les outils nécessaires sont déjà connectés.

Les deux extensions peuvent demander une approbation avant les outils listés dans `protectedTools` ou `protected_tools`. Le dossier `approvals/` conserve des empreintes des paramètres et les décisions observées, sans les paramètres en clair. Un identifiant d'appel absent ou un échec d'écriture bloque la demande. La décision ne prouve pas l'exécution ; la couverture MCP dépend des hooks émis par l'hôte.

Le dossier contient un secret local (`secret`) et un fichier JSON par reçu (`events/`). Les fichiers sont créés avec les permissions `600`, les dossiers avec `700`. Ne configurez que les plateformes et expéditeurs autorisés. Le hook Hermes intervient avant l'autorisation du gateway : sa liste d'expéditeurs doit donc rester au moins aussi restrictive que celle du gateway.

Les empreintes de deux dossiers différents ne sont pas comparables, car chaque dossier possède son propre secret. Pour réunir les reçus des deux plugins sur la même machine, configurer `dataDir` et `data_dir` vers le même dossier, accessible uniquement aux comptes système concernés.

### Installer OpenClaw

Prérequis : OpenClaw 2026.9.4 ou plus récent et la version de Node.js demandée par cette version d'OpenClaw. Depuis la racine de ce dépôt :

```sh
openclaw plugins install -l ./openclaw-commerce-ledger --force
openclaw plugins enable commerce-ledger
openclaw plugins inspect commerce-ledger --runtime --json
```

Ajouter à `openclaw.json` dans `plugins.entries.commerce-ledger.config` :

```json
{
  "allowedChannels": ["whatsapp"],
  "allowedSenders": ["sender-id-from-platform"],
  "captureOutbound": true,
  "protectedTools": ["incwo.create_invoice"],
  "locale": "fr"
}
```

`captureOutbound` est facultatif et désactivé par défaut. Un résultat sortant est enregistré seulement si le canal fournit un identifiant de message et si le destinataire figure dans `allowedSenders`. `observed` signifie que le hook d'envoi a été observé, pas que le destinataire a lu le message.

### Installer Hermes

Copier le contenu de `hermes-commerce-ledger/` dans `~/.hermes/plugins/commerce-ledger/`, puis exécuter :

```sh
hermes plugins doctor ~/.hermes/plugins/commerce-ledger --ci
hermes plugins enable commerce-ledger
```

Dans `~/.hermes/config.yaml`, sous `plugins.entries.commerce-ledger.settings`, définir `allowed_platforms: [whatsapp]`, `allowed_senders: ["sender-id-from-platform"]`, `protected_tools: [incwo.create_invoice]` et `locale: fr`. Sans les deux listes d'identités, aucun message n'est consigné ; `protected_tools` reste indépendant. Le dossier de données du profil Hermes est utilisé par défaut ; `data_dir` peut le remplacer. Hermes choisit le mode d'approbation selon sa configuration. Une décision automatique est identifiée dans le reçu. Un redémarrage entre demande et réponse peut laisser une demande sans décision.

Ces extensions ne créent pas encore de contact incwo et n'envoient pas de relance. Un agent peut utiliser séparément le MCP incwo avec les droits de l'utilisateur et sa validation avant toute écriture. L'API actuelle d'Hermes n'expose pas de reçu sortant équivalent ; OpenClaw ne fournit pas encore tous les identifiants de corrélation des envois. Ces limites sont reflétées dans les reçus au lieu de déduire une livraison.

## English

Two native plugins record allowlisted commercial message identifiers in one format. [OpenClaw](openclaw-commerce-ledger/) observes inbound messages and, optionally, send results. [Hermes](hermes-commerce-ledger/) observes inbound gateway messages. Both deduplicate events across restarts and store HMAC references to identifiers, without message bodies, plaintext phone numbers, or addresses.

Each extension bundles the `commerce-workflow` skill in French, English, and Spanish. It guides incwo contact lookup, follow-up drafting, and human approval before a write or send when the required tools are already connected.

Both extensions can request approval before tools listed in `protectedTools` or `protected_tools`. The `approvals/` directory stores hashes of parameters and observed decisions, without plaintext arguments. A missing call ID or write failure blocks the request. A decision does not prove execution; MCP coverage depends on the host hooks actually fired.

The data directory contains a local secret (`secret`) and one JSON file per receipt (`events/`). Files are created with `600` permissions and directories with `700`. Configure only authorized platforms and senders. The Hermes hook runs before gateway authorization, so its sender allowlist must be at least as restrictive as the gateway's.

References from different data directories cannot be compared because each directory has its own secret. To combine both plugins' receipts on one machine, point `dataDir` and `data_dir` at the same directory, accessible only to the relevant system accounts.

### Install on OpenClaw

Requires OpenClaw 2026.9.4 or newer and the Node.js version required by that OpenClaw release. From this repository's root:

```sh
openclaw plugins install -l ./openclaw-commerce-ledger --force
openclaw plugins enable commerce-ledger
openclaw plugins inspect commerce-ledger --runtime --json
```

Set `plugins.entries.commerce-ledger.config` in `openclaw.json` to the JSON example above. `captureOutbound` is optional and defaults to false. An outbound result is recorded only when the channel supplies a message ID and the recipient is in `allowedSenders`. `observed` means that the send hook was observed, not that the recipient read the message.

### Install on Hermes

Copy `hermes-commerce-ledger/` into `~/.hermes/plugins/commerce-ledger/`, then run the Hermes commands above. Under `plugins.entries.commerce-ledger.settings` in `~/.hermes/config.yaml`, set `allowed_platforms: [whatsapp]`, `allowed_senders: ["sender-id-from-platform"]`, `protected_tools: [incwo.create_invoice]`, and `locale: en`. No message is recorded without both identity lists; `protected_tools` is independent. Hermes uses its profile data directory by default; `data_dir` overrides it. Hermes selects the approval mode from its configuration. Automatic decisions are labeled in receipts. A restart between request and response can leave a request without a decision.

These extensions do not yet create incwo contacts or send follow-ups. An agent can separately use the incwo MCP with the user's rights and approval before any write. Hermes currently has no equivalent outbound receipt hook; OpenClaw does not yet supply every outbound correlation identifier. Receipts represent these limits rather than inferring delivery.

## Español

Dos plugins nativos registran identificadores permitidos de mensajes comerciales con un formato común. [OpenClaw](openclaw-commerce-ledger/) observa los mensajes entrantes y, opcionalmente, los resultados de envío. [Hermes](hermes-commerce-ledger/) observa los mensajes entrantes del gateway. Ambas eliminan duplicados tras reiniciar y guardan referencias HMAC de los identificadores, sin cuerpo del mensaje, números de teléfono ni direcciones en claro.

Cada extensión incluye la habilidad `commerce-workflow` en francés, inglés y español. Guía la búsqueda de contactos en incwo, la preparación de seguimientos y la aprobación humana antes de escribir o enviar, si las herramientas necesarias ya están conectadas.

Ambas extensiones pueden solicitar aprobación antes de las herramientas de `protectedTools` o `protected_tools`. El directorio `approvals/` guarda huellas de los parámetros y las decisiones observadas, sin argumentos en claro. Si falta el ID de la llamada o falla la escritura, se bloquea la solicitud. Una decisión no demuestra la ejecución; la cobertura de MCP depende de los hooks emitidos por el host.

El directorio de datos contiene un secreto local (`secret`) y un archivo JSON por recibo (`events/`). Los archivos se crean con permisos `600` y los directorios con `700`. Configura solo plataformas y remitentes autorizados. El hook de Hermes se ejecuta antes de la autorización del gateway; su lista de remitentes debe ser al menos tan restrictiva como la del gateway.

Las referencias de directorios distintos no se pueden comparar porque cada directorio tiene su propio secreto. Para reunir los recibos de ambos plugins en una máquina, apunta `dataDir` y `data_dir` al mismo directorio, accesible solo para las cuentas de sistema correspondientes.

### Instalar en OpenClaw

Requiere OpenClaw 2026.9.4 o posterior y la versión de Node.js exigida por esa versión. Desde la raíz de este repositorio, ejecuta los comandos de OpenClaw anteriores. Configura `plugins.entries.commerce-ledger.config` en `openclaw.json` con el ejemplo JSON anterior. `captureOutbound` es opcional y está desactivado por defecto. Un resultado saliente solo se registra si el canal proporciona un ID de mensaje y el destinatario figura en `allowedSenders`. `observed` indica que se observó el hook de envío, no que el destinatario leyó el mensaje.

### Instalar en Hermes

Copia `hermes-commerce-ledger/` a `~/.hermes/plugins/commerce-ledger/` y ejecuta los comandos de Hermes anteriores. En `~/.hermes/config.yaml`, bajo `plugins.entries.commerce-ledger.settings`, define `allowed_platforms: [whatsapp]`, `allowed_senders: ["sender-id-from-platform"]`, `protected_tools: [incwo.create_invoice]` y `locale: es`. Sin ambas listas de identidades no se registra ningún mensaje; `protected_tools` es independiente. Por defecto se usa el directorio de datos del perfil Hermes; `data_dir` permite cambiarlo. Hermes elige el modo de aprobación según su configuración. Las decisiones automáticas aparecen identificadas en los recibos. Un reinicio entre la solicitud y la respuesta puede dejar una solicitud sin decisión.

Estas extensiones todavía no crean contactos en incwo ni envían seguimientos. Un agente puede usar por separado el MCP de incwo con los derechos del usuario y su aprobación antes de escribir. Hermes aún no dispone de un hook equivalente para los recibos salientes y OpenClaw todavía no proporciona todos los identificadores de correlación de los envíos. Los recibos reflejan estos límites sin inferir una entrega.

## Vérification / Verification / Verificación

Français : exécuter `npm test` depuis la racine ; la CI vérifie aussi le contenu du paquet OpenClaw. Les tests utilisent des doubles locaux, pas des instances OpenClaw ou Hermes en service. Le code est publié sous licence MIT ; aucun paquet npm ni ClawHub n'est encore publié.

English: run `npm test` from the root; CI also checks the OpenClaw package contents. Tests use local stubs, not running OpenClaw or Hermes instances. The code is MIT licensed; no npm or ClawHub package has been published yet.

Español: ejecuta `npm test` desde la raíz; CI también comprueba el contenido del paquete OpenClaw. Las pruebas usan simulaciones locales, no instancias activas de OpenClaw o Hermes. El código se publica bajo licencia MIT; todavía no hay paquetes publicados en npm ni ClawHub.
