import { ALLOWLIST_RULE_ID_START, ALLOWLIST_RULE_ID_MAX } from './constants.js';

export function parseDomain(input) {
  if (typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (!d) return null;

  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/[?#].*$/, '');
  d = d.replace(/:\d+$/, '');
  d = d.replace(/\.$/, '');

  if (!d) return null;
  if (/^[*.\s]+$/.test(d)) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;

  return d;
}

export async function getAllowlist() {
  const { user_allowlist } = await chrome.storage.local.get('user_allowlist');
  return user_allowlist || [];
}

export async function saveAllowlist(list) {
  await chrome.storage.local.set({ user_allowlist: list });
}

export function allowlistRuleId(index) {
  return ALLOWLIST_RULE_ID_START + index;
}

export async function syncAllowlistDNR(list) {
  const enabledDomains = list.filter((e) => e.enabled);

  const removeIds = [];
  for (let i = 0; i <= ALLOWLIST_RULE_ID_MAX - ALLOWLIST_RULE_ID_START; i++) {
    removeIds.push(ALLOWLIST_RULE_ID_START + i);
  }

  const addRules = enabledDomains.map((entry, i) => ({
    id: allowlistRuleId(i),
    priority: 2,
    action: { type: 'allow' },
    condition: {
      initiatorDomains: [entry.domain],
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'font', 'media']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules
  });
}

export async function addAllowlistDomain(rawDomain) {
  const domain = parseDomain(rawDomain);
  if (!domain) return { error: 'Invalid domain' };

  const list = await getAllowlist();
  if (list.some((e) => e.domain === domain)) {
    return { error: 'Domain already allowlisted' };
  }

  if (list.length >= (ALLOWLIST_RULE_ID_MAX - ALLOWLIST_RULE_ID_START + 1)) {
    return { error: 'Allowlist full' };
  }

  list.push({
    domain,
    created_at: new Date().toISOString(),
    source: 'manual',
    enabled: true
  });

  await saveAllowlist(list);
  await syncAllowlistDNR(list);
  return { ok: true, list };
}

export async function removeAllowlistDomain(domain) {
  let list = await getAllowlist();
  const before = list.length;
  list = list.filter((e) => e.domain !== domain);
  if (list.length === before) {
    return { error: 'Domain not found' };
  }
  await saveAllowlist(list);
  await syncAllowlistDNR(list);
  return { ok: true, list };
}
