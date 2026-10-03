---
name: commerce-workflow
description: 'FR : qualifier un prospect et préparer une relance ; EN: qualify a lead and prepare a follow-up; ES: calificar un prospecto y preparar un seguimiento'
---

## Français

Utiliser cette compétence lorsqu'un utilisateur veut traiter un message commercial entrant ou relancer un devis. Le plugin Commerce Ledger conserve automatiquement des reçus techniques pour les expéditeurs configurés ; ces reçus ne contiennent ni message ni coordonnées en clair.

1. Identifier le canal, l'expéditeur et le message d'origine à partir des faits fournis par la plateforme. Ne pas inventer d'identité ou de consentement commercial.
2. Si le MCP incwo est connecté, rechercher d'abord le contact et le devis avec ses outils de lecture (`search_objects`, `get_object` ou les outils réellement disponibles). Conserver les identifiants de source. Sans MCP, préparer seulement une fiche ou un brouillon à réviser.
3. Avant de créer ou modifier un contact, montrer les champs proposés et demander la validation de l'utilisateur. Rechercher de nouveau juste avant l'écriture pour éviter un doublon ; utiliser les droits et les outils d'écriture réellement exposés par incwo. Ne pas écrire si l'identité ou le dossier reste ambigu.
4. Avant une relance, vérifier l'état du devis, la dernière réponse, le canal autorisé et les contraintes de ce canal. Rédiger le message dans la langue de la conversation. Ne pas traduire automatiquement les données du client. Faire valider le texte et le destinataire avant l'envoi.
5. Après l'envoi, distinguer l'intention, la tentative, le résultat du canal et la lecture éventuelle. Un reçu `observed` du plugin n'est pas une preuve de lecture ou de livraison finale. Si aucun identifiant stable n'est disponible, indiquer que le rapprochement reste impossible.
6. Si une règle `businessProofs` ou `business_proofs` couvre une écriture approuvée, relire ensuite l'objet avec l'outil de lecture configuré et vérifier le reçu `business/readbacks/`. Ne déclarer un résultat métier confirmé que si le statut est `verified`. `mismatch`, `unavailable` ou l'absence de reçu demandent une vérification humaine.

## English

Use this skill when a user wants to handle an inbound sales message or follow up on a quote. Commerce Ledger automatically keeps technical receipts for configured senders; those receipts contain neither message text nor plaintext contact details.

1. Identify the channel, sender, and source message from platform facts. Do not invent identity or marketing consent.
2. If incwo MCP is connected, first search for the contact and quote using read tools (`search_objects`, `get_object`, or the tools actually available). Keep source IDs. Without MCP, prepare only a record or draft for review.
3. Before creating or changing a contact, show the proposed fields and obtain user approval. Search again immediately before writing to avoid duplicates; use only the rights and write tools actually exposed by incwo. Do not write if identity or account remains ambiguous.
4. Before a follow-up, check quote state, the latest reply, the permitted channel, and its constraints. Draft in the conversation's language. Do not automatically translate customer data. Obtain approval for the exact text and recipient before sending.
5. After sending, distinguish intent, attempt, channel result, and any later read confirmation. A plugin receipt marked `observed` does not prove reading or final delivery. If no stable ID is available, state that reconciliation remains impossible.
6. When a `businessProofs` or `business_proofs` rule covers an approved write, read the object using the configured read tool and check the `business/readbacks/` receipt. Claim a confirmed business result only for `verified`. `mismatch`, `unavailable`, or no receipt requires human review.

## Español

Usa esta habilidad cuando un usuario quiera tratar un mensaje comercial entrante o hacer seguimiento de un presupuesto. Commerce Ledger guarda automáticamente recibos técnicos para los remitentes configurados; esos recibos no contienen el texto ni datos de contacto en claro.

1. Identifica el canal, remitente y mensaje de origen mediante hechos de la plataforma. No inventes identidades ni consentimiento comercial.
2. Si el MCP de incwo está conectado, busca primero el contacto y el presupuesto con sus herramientas de lectura (`search_objects`, `get_object` o las disponibles realmente). Conserva los ID de origen. Sin MCP, prepara solo una ficha o borrador para revisar.
3. Antes de crear o modificar un contacto, muestra los campos propuestos y solicita la aprobación del usuario. Busca de nuevo justo antes de escribir para evitar duplicados; usa solo los derechos y herramientas de escritura realmente expuestos por incwo. No escribas si la identidad o la cuenta sigue siendo ambigua.
4. Antes de un seguimiento, comprueba el estado del presupuesto, la última respuesta, el canal permitido y sus restricciones. Redacta en la lengua de la conversación. No traduzcas automáticamente los datos del cliente. Pide aprobación del texto exacto y del destinatario antes de enviar.
5. Después del envío, distingue intención, intento, resultado del canal y cualquier confirmación posterior de lectura. Un recibo `observed` del plugin no prueba lectura ni entrega final. Si no hay un ID estable, indica que no es posible conciliar el envío.
6. Si una regla `businessProofs` o `business_proofs` cubre una escritura aprobada, vuelve a leer el objeto con la herramienta configurada y comprueba el recibo `business/readbacks/`. Declara un resultado empresarial confirmado solo con `verified`. `mismatch`, `unavailable` o la ausencia de recibo requieren revisión humana.
