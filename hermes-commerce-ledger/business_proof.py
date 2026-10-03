"""Private, immutable business readback evidence for Hermes tool hooks."""

from __future__ import annotations

import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .ledger import _create_if_absent, _secret

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_PATH = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")


def _identifier(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        value = str(value)
    return value if isinstance(value, str) and _IDENTIFIER.fullmatch(value) else None


def _at_path(value, path):
    for key in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def _payload(value):
    if isinstance(value, str):
        if len(value) > 65536:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    if not isinstance(value, dict) or value.get("isError") is True:
        return None
    for key in ("structuredContent", "details"):
        if isinstance(value.get(key), dict):
            return value[key]
    if isinstance(value.get("content"), list):
        for part in value["content"]:
            if isinstance(part, dict) and part.get("type") == "text":
                return _payload(part.get("text"))
        return None
    return value


def _digest(secret, *parts):
    data = json.dumps(parts, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode()
    return hmac.new(secret, data, hashlib.sha256).hexdigest()


def _timestamp():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _save(directory, name, receipt):
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    directory.chmod(0o700)
    data = (json.dumps(receipt, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    return _create_if_absent(directory, name, data)


def validate_rules(rules, protected_tools):
    if rules is None:
        return []
    if not isinstance(rules, list) or len(rules) > 16:
        raise ValueError("E_PROOF_CONFIG")
    seen = set()
    normalized = []
    for rule in rules:
        if not isinstance(rule, dict):
            raise ValueError("E_PROOF_CONFIG")
        item = dict(rule)
        for name, default in (("write_id_path", "id"), ("read_id_path", "id"),
                              ("read_id_param", "id"), ("read_resource_param", "object_type")):
            item.setdefault(name, default)
        fields = item.get("fields")
        if (not _identifier(item.get("write_tool")) or not _identifier(item.get("read_tool"))
                or item["write_tool"] == item["read_tool"]
                or not _identifier(item.get("resource")) or item["write_tool"] not in protected_tools
                or item["write_tool"] in seen or not _PATH.fullmatch(item["write_id_path"])
                or not _PATH.fullmatch(item["read_id_path"])
                or not _identifier(item["read_id_param"])
                or not _identifier(item["read_resource_param"])
                or not isinstance(fields, list) or not 1 <= len(fields) <= 16
                or any(not isinstance(field, dict)
                       or not isinstance(field.get("write_path"), str)
                       or not _PATH.fullmatch(field["write_path"])
                       or not isinstance(field.get("read_path"), str)
                       or not _PATH.fullmatch(field["read_path"]) for field in fields)):
            raise ValueError("E_PROOF_CONFIG")
        seen.add(item["write_tool"])
        normalized.append(item)
    return normalized


def observe_result(directory, rules, tool_name, args, tool_call_id, result=None, error=None):
    if not _identifier(tool_call_id):
        return []
    directory = Path(directory)
    secret = _secret(directory)
    output = _payload(result) if not error else None
    receipts = []
    for rule in rules:
        if tool_name == rule["write_tool"]:
            args_ref = _digest(secret, "args", tool_name, args)
            approval_id = _digest(secret, "approval", tool_name, tool_call_id, args_ref, "once")
            if error or not (directory / "approvals" / f"{approval_id}.json").is_file():
                continue
            object_id = _identifier(_at_path(output, rule["write_id_path"]))
            if not object_id:
                continue
            fields = []
            for field in rule["fields"]:
                value = _at_path(output, field["write_path"])
                if value is None:
                    fields = []
                    break
                fields.append({"readPath": field["read_path"],
                               "valueRef": _digest(secret, "field", field["read_path"], value)})
            if not fields:
                continue
            object_ref = _digest(secret, "object", rule["resource"], object_id)
            call_ref = _digest(secret, "call", tool_call_id)
            receipt_id = _digest(secret, "business-action", rule["write_tool"], call_ref, object_ref)
            receipt = {"schema": "commerce-business-action.v1", "id": receipt_id,
                       "status": "write_returned", "tool": rule["write_tool"],
                       "resource": rule["resource"], "objectRef": object_ref,
                       "callRef": call_ref, "fields": fields, "observedAt": _timestamp()}
            if _save(directory / "business" / "actions", f"{object_ref}.{receipt_id}.json", receipt):
                receipts.append(receipt)
        if tool_name == rule["read_tool"] and isinstance(args, dict):
            object_id = _identifier(args.get(rule["read_id_param"]))
            if not object_id or args.get(rule["read_resource_param"]) != rule["resource"]:
                continue
            object_ref = _digest(secret, "object", rule["resource"], object_id)
            action_dir = directory / "business" / "actions"
            names = list(action_dir.glob(f"{object_ref}.*.json")) if action_dir.is_dir() else []
            if len(names) > 1000:
                raise ValueError("E_PROOF_LIMIT")
            for path in names:
                action = json.loads(path.read_text())
                if action.get("tool") != rule["write_tool"] or action.get("resource") != rule["resource"]:
                    continue
                if action.get("callRef") == _digest(secret, "call", tool_call_id):
                    continue
                status = "unavailable"
                if output is not None:
                    status = "mismatch"
                    if _identifier(_at_path(output, rule["read_id_path"])) == object_id:
                        checks = all(_at_path(output, field["readPath"]) is not None
                                     and _digest(secret, "field", field["readPath"],
                                                 _at_path(output, field["readPath"])) == field["valueRef"]
                                     for field in action["fields"])
                        status = "verified" if checks else "mismatch"
                read_ref = _digest(secret, "call", tool_call_id)
                receipt_id = _digest(secret, "business-readback", action["id"], read_ref, status)
                receipt = {"schema": "commerce-business-readback.v1", "id": receipt_id,
                           "actionRef": action["id"], "objectRef": object_ref,
                           "readCallRef": read_ref, "status": status, "observedAt": _timestamp()}
                if _save(directory / "business" / "readbacks", f"{receipt_id}.json", receipt):
                    receipts.append(receipt)
    return receipts
