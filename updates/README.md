# CleanBlock Update Manifests

This directory contains the update manifest format and examples for CleanBlock's signed rule update system.

## Trust Law

> Remote updates may choose behavior. Remote updates may not define new executable behavior.

This means a signed update can add, remove, or modify DNR block/allow rules — it cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

## Manifest Format

See `update-manifest.example.json` for the canonical shape.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `manifest_version` | integer | yes | Schema version for the update manifest format itself |
| `ruleset_version` | integer | yes | Monotonically increasing version of the rule content |
| `created_at` | ISO 8601 string | yes | Timestamp when this manifest was created |
| `min_extension_version` | semver string | yes | Minimum extension version required to apply this update |
| `files` | array | yes | One entry per ruleset file in the update |
| `signature` | object | yes | Ed25519 signature over the manifest content |

### File Descriptor

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ruleset_id` | string | yes | Must match a known static ruleset ID |
| `path` | string | yes | Relative path to the rule file within the update package |
| `sha256` | hex string | yes | SHA-256 hash of the rule file contents |
| `rule_count` | integer | yes | Expected number of rules in the file |
| `rule_type` | string | yes | Must be an allowed type (currently only `dnr_dynamic_ruleset_update`) |

### Signature Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `algorithm` | string | yes | Must be `Ed25519` |
| `key_id` | string | yes | Identifier for the signing key |
| `value` | base64 string | yes | Ed25519 signature over the canonical manifest content |

## Allowed Rule Types

Only `dnr_dynamic_ruleset_update` is accepted in v0.1. This means a signed, hash-verified update may provide DNR JSON that the extension's packaged update logic applies as dynamic rules. Static packaged rulesets are not replaced — dynamic rules overlay them at runtime.

Disallowed: `scriptlet`, `content_script`, `executable`, `redirect_url`, or any type not explicitly listed.

## Key Management

- Ed25519 keypair generated offline on the developer machine.
- Public key hardcoded in extension source.
- Private key never committed to the repo, never in CI, never on any server.
- Signing happens pre-publish on the developer machine only.

## Runtime Limitation: Ed25519 Support

WebCrypto Ed25519 (`crypto.subtle.importKey` with `{ name: 'Ed25519' }`) is available in Chrome 113+ extension service workers. Older runtimes or non-Chrome environments (e.g. Node.js `node --check`) may not support it.

The `verifyManifestSignature()` function handles this gracefully: if `crypto.subtle.importKey` throws `NotSupportedError`, it returns `{ ok: false, error: "Ed25519 verification unavailable in this runtime" }` rather than crashing. This allows the rest of the validation pipeline (shape, version, hash, rule validation) to be tested independently.

## Canonicalization

The signed payload is a deterministic JSON string of the manifest built from only known fields in explicit key order. Unknown fields are excluded from the canonical payload (and rejected by shape validation elsewhere).

### Canonical structure example

```json
{
  "manifest_version": 1,
  "ruleset_version": 2,
  "created_at": "2026-06-19T00:00:00Z",
  "min_extension_version": "0.1.0",
  "files": [
    {
      "ruleset_id": "core_ads",
      "path": "core-ads.json",
      "sha256": "<64 lowercase hex>",
      "rule_count": 10,
      "rule_type": "dnr_dynamic_ruleset_update"
    }
  ],
  "signature": {
    "algorithm": "Ed25519",
    "key_id": "cleanblock-signing-key-v1"
  }
}
```

Note: `signature.value` is excluded from the canonical payload. It is the Ed25519 signature over this canonical JSON string, encoded as base64.

### Canonicalization rules

1. Only explicit known fields are included in the canonical payload. Unknown manifest or file descriptor fields are excluded (and rejected by shape validation elsewhere).
2. File descriptors are mapped into objects with explicit key order: `ruleset_id`, `path`, `sha256`, `rule_count`, `rule_type`.
3. File descriptors are sorted alphabetically by `ruleset_id` before stringifying.
4. `signature.value` is excluded to avoid circular dependency.
5. The canonical string is produced by `JSON.stringify()` with no replacer and no indentation.
6. The signer and verifier must use the same canonicalization to produce matching payloads.

## Verification Flow (not yet implemented)

1. Fetch update manifest from known HTTPS endpoint.
2. Verify Ed25519 signature against hardcoded public key.
3. Check `manifest_version` is supported.
4. Check `ruleset_version` is strictly greater than current.
5. Check `min_extension_version` against installed version.
6. For each file: fetch, verify SHA-256, validate DNR JSON schema.
7. Apply as dynamic rules via `chrome.declarativeNetRequest.updateDynamicRules`.
8. Store as current-good; preserve previous as last-known-good.
9. On any failure: reject update, keep current rules, increment failure counter.
