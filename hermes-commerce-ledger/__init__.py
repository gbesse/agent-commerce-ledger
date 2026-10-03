"""Hermes gateway extension for consent-scoped commerce receipts."""

from __future__ import annotations

import logging
import json
from pathlib import Path

from .ledger import record_approval, record_receipt
from .business_proof import observe_result, validate_rules

APPROVAL_COPY = {
    "fr": "Valider cet appel de {tool} avec ses paramètres exacts ?",
    "en": "Approve this {tool} call with its exact parameters?",
    "es": "¿Aprobar esta llamada a {tool} con sus parámetros exactos?",
}
ERROR_COPY = {
    "fr": {"call_id": "Action bloquée : l'identifiant d'appel est absent.", "params": "Action bloquée : les paramètres sont invalides ou trop volumineux.", "write": "Action bloquée : le reçu d'autorisation n'a pas pu être enregistré."},
    "en": {"call_id": "Action blocked: the call ID is missing.", "params": "Action blocked: the arguments are invalid or too large.", "write": "Action blocked: the approval receipt could not be saved."},
    "es": {"call_id": "Acción bloqueada: falta el ID de la llamada.", "params": "Acción bloqueada: los argumentos no son válidos o son demasiado grandes.", "write": "Acción bloqueada: no se pudo guardar el recibo de autorización."},
}

logger = logging.getLogger(__name__)


def register(ctx):
    allowed_platforms = set(ctx.get_config("allowed_platforms", default=[]) or [])
    allowed_senders = {str(item) for item in (ctx.get_config("allowed_senders", default=[]) or [])}
    data_dir = ctx.get_config("data_dir", default="")
    protected_tools = set(ctx.get_config("protected_tools", default=[]) or [])
    business_proofs = validate_rules(ctx.get_config("business_proofs", default=[]), protected_tools)
    locale = ctx.get_config("locale", default="fr")
    errors = ERROR_COPY.get(locale, ERROR_COPY["fr"])
    pending = {}
    if not data_dir:
        try:
            from plugins.plugin_storage import plugin_data_dir

            data_dir = plugin_data_dir("commerce-ledger")
        except ImportError:
            data_dir = Path.home() / ".hermes" / "commerce-ledger"

    def observe(event, **_kwargs):
        source = getattr(event, "source", None)
        platform = getattr(source, "platform", None)
        sender = getattr(source, "user_id", None)
        sender = str(sender) if sender is not None else None
        if platform not in allowed_platforms or sender not in allowed_senders:
            return None
        try:
            record_receipt(
                data_dir,
                {
                    "kind": "inbound",
                    "channel": platform,
                    "account": str(getattr(source, "account_id", "default") or "default"),
                    "partyId": sender,
                    "messageId": getattr(event, "message_id", None),
                },
            )
        except (OSError, ValueError) as error:
            logger.warning("commerce-ledger:E_WRITE (%s)", error.__class__.__name__)
        return None

    ctx.register_hook("pre_gateway_dispatch", observe)
    def require_approval(tool_name, args, tool_call_id=None, **_kwargs):
        if tool_name not in protected_tools:
            return None
        if not isinstance(tool_call_id, str) or not tool_call_id:
            return {"action": "block", "message": errors["call_id"]}
        try:
            serialized_args = json.dumps(args, ensure_ascii=False, sort_keys=True)
            if len(serialized_args) > 65536:
                return {"action": "block", "message": errors["params"]}
            frozen_args = json.loads(serialized_args)
            request = record_approval(data_dir, tool_name, tool_call_id, frozen_args, "requested")
            pending[tool_call_id] = (tool_name, frozen_args)
        except (OSError, ValueError, TypeError) as error:
            logger.warning("commerce-ledger:E_APPROVAL_WRITE (%s)", error.__class__.__name__)
            return {"action": "block", "message": errors["write"]}
        prompt = APPROVAL_COPY.get(locale, APPROVAL_COPY["fr"]).format(tool=tool_name)
        return {"action": "approve", "message": prompt, "rule_key": f"commerce-ledger:{request['receipt']['id']}"}

    def approval_decision(choice, tool_call_id=None, **_kwargs):
        item = pending.get(tool_call_id)
        if item is None:
            return None
        tool_name, args = item
        try:
            record_approval(data_dir, tool_name, tool_call_id, args, str(choice))
        except (OSError, ValueError, TypeError) as error:
            logger.warning("commerce-ledger:E_APPROVAL_WRITE (%s)", error.__class__.__name__)
        if choice not in ("once", "session", "always", "smart_approve"):
            pending.pop(tool_call_id, None)
        return None

    def observed_result(tool_name, args, tool_call_id=None, result=None, error=None, **_kwargs):
        item = pending.pop(tool_call_id, None)
        if item is not None and item[0] == tool_name:
            try:
                status = "returned" if json.dumps(args, sort_keys=True) == json.dumps(item[1], sort_keys=True) else "args-changed"
                record_approval(data_dir, tool_name, tool_call_id, args, status)
            except (OSError, ValueError, TypeError) as failure:
                logger.warning("commerce-ledger:E_RESULT_WRITE (%s)", failure.__class__.__name__)
        if business_proofs:
            try:
                observe_result(data_dir, business_proofs, tool_name, args, tool_call_id, result, error)
            except (OSError, ValueError, TypeError, KeyError) as failure:
                logger.warning("commerce-ledger:E_PROOF_WRITE (%s)", failure.__class__.__name__)
        return None

    ctx.register_hook("pre_tool_call", require_approval)
    ctx.register_hook("post_approval_response", approval_decision)
    ctx.register_hook("post_tool_call", observed_result)
    ctx.register_skill(
        "commerce-workflow", Path(__file__).parent / "skills" / "commerce-workflow" / "SKILL.md"
    )
