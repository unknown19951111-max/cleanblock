export function textToArrayBuffer(text) {
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

export async function sha256HexFromText(text) {
  const buffer = textToArrayBuffer(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function constantTimeEqualHex(a, b) {
  const aNorm = String(a).toLowerCase();
  const bNorm = String(b).toLowerCase();
  if (aNorm.length !== bNorm.length) return false;
  let diff = 0;
  for (let i = 0; i < aNorm.length; i++) {
    diff |= aNorm.charCodeAt(i) ^ bNorm.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyTextSha256(text, expectedHex) {
  if (typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHex)) {
    return { ok: false, actual: null, error: 'expectedHex must be 64 lowercase hex characters' };
  }
  const actual = await sha256HexFromText(text);
  if (constantTimeEqualHex(actual, expectedHex)) {
    return { ok: true, actual };
  }
  return { ok: false, actual, error: 'Hash mismatch' };
}

export const SIGNING_KEYS = {
  'cleanblock-signing-key-v1': {
    algorithm: 'Ed25519',
    // Placeholder — replace with real base64-encoded Ed25519 public key before production use.
    publicKeyBase64: 'PLACEHOLDER_BASE64_PUBLIC_KEY'
  }
};

export function getSigningKeyById(keyId) {
  return SIGNING_KEYS[keyId] || null;
}

export function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function canonicalizeManifestForSigning(manifest) {
  const canonFiles = manifest.files
    .map((file) => ({
      ruleset_id: file.ruleset_id,
      path: file.path,
      sha256: file.sha256,
      rule_count: file.rule_count,
      rule_type: file.rule_type
    }))
    .sort((a, b) => a.ruleset_id.localeCompare(b.ruleset_id));

  const canon = {
    manifest_version: manifest.manifest_version,
    ruleset_version: manifest.ruleset_version,
    created_at: manifest.created_at,
    min_extension_version: manifest.min_extension_version,
    files: canonFiles,
    signature: {
      algorithm: manifest.signature.algorithm,
      key_id: manifest.signature.key_id
    }
  };
  return JSON.stringify(canon);
}

export async function verifyManifestSignature(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, error: 'Manifest must be an object' };
  }
  if (!manifest.signature || typeof manifest.signature !== 'object') {
    return { ok: false, error: 'Missing signature object' };
  }
  if (manifest.signature.algorithm !== 'Ed25519') {
    return { ok: false, error: 'Unsupported algorithm: ' + manifest.signature.algorithm };
  }

  const keyMeta = getSigningKeyById(manifest.signature.key_id);
  if (!keyMeta) {
    return { ok: false, error: 'Unknown signing key_id: ' + manifest.signature.key_id };
  }
  if (!manifest.signature.value || typeof manifest.signature.value !== 'string') {
    return { ok: false, error: 'Missing or invalid signature value' };
  }

  let publicKeyData;
  let signatureData;
  try {
    publicKeyData = base64ToArrayBuffer(keyMeta.publicKeyBase64);
    signatureData = base64ToArrayBuffer(manifest.signature.value);
  } catch (e) {
    return { ok: false, error: 'Base64 decode failed: ' + e.message };
  }

  const canonicalText = canonicalizeManifestForSigning(manifest);
  const messageData = textToArrayBuffer(canonicalText);

  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      publicKeyData,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      signatureData,
      messageData
    );

    if (valid) {
      return { ok: true };
    }
    return { ok: false, error: 'Signature verification failed' };
  } catch (e) {
    if (e.name === 'NotSupportedError') {
      return { ok: false, error: 'Ed25519 verification unavailable in this runtime' };
    }
    return { ok: false, error: 'Verification error: ' + e.message };
  }
}
