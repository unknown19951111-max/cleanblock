export const ALARM_UPDATE_CHECK = 'cleanblock-update-check';
export const UPDATE_CHECK_INTERVAL_MINUTES = 360;

export const STATIC_RULESETS = ['core_ads', 'privacy_trackers', 'annoyances'];

export const ALLOWED_RULE_TYPES = ['dnr_dynamic_ruleset_update'];
export const ALLOWED_MANIFEST_VERSION = 1;
export const KNOWN_RULESET_IDS = ['core_ads', 'privacy_trackers', 'annoyances'];

export const ALLOWED_UPDATE_MANIFEST_FIELDS = [
  'manifest_version', 'ruleset_version', 'created_at',
  'min_extension_version', 'files', 'signature'
];
export const ALLOWED_UPDATE_FILE_DESCRIPTOR_FIELDS = [
  'ruleset_id', 'path', 'sha256', 'rule_count', 'rule_type'
];
export const ALLOWED_SIGNATURE_FIELDS = ['algorithm', 'key_id', 'value'];

export const REMOTE_DYNAMIC_RULE_ID_START = 60000;
export const REMOTE_DYNAMIC_RULE_ID_MAX = 89999;
export const ALLOWED_REMOTE_DNR_ACTIONS = ['block', 'allow', 'upgradeScheme'];
export const ALLOWED_REMOTE_RESOURCE_TYPES = [
  'script', 'image', 'xmlhttprequest', 'sub_frame',
  'stylesheet', 'font', 'media', 'ping', 'websocket'
];
export const REJECTED_EXECUTABLE_FIELDS = [
  'script', 'code', 'function', 'eval', 'js', 'scriptlet', 'content_script'
];
export const ALLOWED_REMOTE_RULE_FIELDS = ['id', 'priority', 'action', 'condition'];
export const ALLOWED_REMOTE_ACTION_FIELDS = ['type'];
export const ALLOWED_REMOTE_CONDITION_FIELDS = [
  'urlFilter', 'regexFilter',
  'requestDomains', 'excludedRequestDomains',
  'initiatorDomains', 'excludedInitiatorDomains',
  'resourceTypes', 'excludedResourceTypes',
  'domainType',
  'requestMethods', 'excludedRequestMethods'
];
export const REJECTED_REMOTE_CONDITION_FIELDS = [
  'tabIds', 'excludedTabIds', 'responseHeaders', 'requestHeaders'
];

export const ALLOWLIST_RULE_ID_START = 50000;
export const ALLOWLIST_RULE_ID_MAX = 59999;
