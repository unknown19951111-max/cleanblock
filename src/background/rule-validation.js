import {
  REMOTE_DYNAMIC_RULE_ID_START, REMOTE_DYNAMIC_RULE_ID_MAX,
  ALLOWED_REMOTE_DNR_ACTIONS, ALLOWED_REMOTE_RESOURCE_TYPES,
  REJECTED_EXECUTABLE_FIELDS, ALLOWED_REMOTE_RULE_FIELDS,
  ALLOWED_REMOTE_ACTION_FIELDS, ALLOWED_REMOTE_CONDITION_FIELDS,
  REJECTED_REMOTE_CONDITION_FIELDS
} from './constants.js';
import { validateRulesetFileDescriptor } from './manifest-validation.js';
import { validateObjectOnlyHasAllowedFields } from './validation-helpers.js';

export { validateObjectOnlyHasAllowedFields };

export function containsRejectedExecutableField(value, path) {
  const errors = [];
  if (value === null || typeof value !== 'object') return errors;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...containsRejectedExecutableField(value[i], path + '[' + i + ']'));
    }
    return errors;
  }

  for (const key of Object.keys(value)) {
    if (REJECTED_EXECUTABLE_FIELDS.includes(key)) {
      errors.push(path + ': contains rejected executable field "' + key + '"');
    }
    errors.push(...containsRejectedExecutableField(value[key], path + '.' + key));
  }
  return errors;
}

export function parseRulesetText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['Invalid JSON: ' + e.message] };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, errors: ['Top-level value must be an array'] };
  }
  return { ok: true, rules: parsed };
}

export function validateRemoteDnrRule(rule, index) {
  const errors = [];
  const prefix = 'rule[' + index + ']';

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return [prefix + ': must be an object'];
  }

  errors.push(...containsRejectedExecutableField(rule, prefix));
  errors.push(...validateObjectOnlyHasAllowedFields(rule, ALLOWED_REMOTE_RULE_FIELDS, prefix));

  if (!Number.isInteger(rule.id)) {
    errors.push(prefix + '.id must be an integer');
  } else if (rule.id < REMOTE_DYNAMIC_RULE_ID_START || rule.id > REMOTE_DYNAMIC_RULE_ID_MAX) {
    errors.push(prefix + '.id ' + rule.id + ' outside allowed range ' + REMOTE_DYNAMIC_RULE_ID_START + '–' + REMOTE_DYNAMIC_RULE_ID_MAX);
  }

  if (!Number.isInteger(rule.priority) || rule.priority < 1) {
    errors.push(prefix + '.priority must be an integer >= 1');
  }

  if (!rule.action || typeof rule.action !== 'object') {
    errors.push(prefix + '.action must be an object');
  } else {
    if (!ALLOWED_REMOTE_DNR_ACTIONS.includes(rule.action.type)) {
      errors.push(prefix + '.action.type "' + rule.action.type + '" is not allowed');
    }
    errors.push(...validateObjectOnlyHasAllowedFields(rule.action, ALLOWED_REMOTE_ACTION_FIELDS, prefix + '.action'));
  }

  if (!rule.condition || typeof rule.condition !== 'object') {
    errors.push(prefix + '.condition must be an object');
  } else {
    for (const rejected of REJECTED_REMOTE_CONDITION_FIELDS) {
      if (rejected in rule.condition) {
        errors.push(prefix + '.condition: rejected field "' + rejected + '"');
      }
    }
    errors.push(...validateObjectOnlyHasAllowedFields(rule.condition, ALLOWED_REMOTE_CONDITION_FIELDS, prefix + '.condition'));

    if (rule.condition.urlFilter !== undefined && rule.condition.regexFilter !== undefined) {
      errors.push(prefix + '.condition: cannot have both urlFilter and regexFilter');
    }
    if (rule.condition.urlFilter !== undefined && (typeof rule.condition.urlFilter !== 'string' || rule.condition.urlFilter === '')) {
      errors.push(prefix + '.condition.urlFilter must be a non-empty string');
    }
    if (rule.condition.regexFilter !== undefined && (typeof rule.condition.regexFilter !== 'string' || rule.condition.regexFilter === '')) {
      errors.push(prefix + '.condition.regexFilter must be a non-empty string');
    }

    if (!Array.isArray(rule.condition.resourceTypes) || rule.condition.resourceTypes.length === 0) {
      errors.push(prefix + '.condition.resourceTypes must be a non-empty array');
    } else {
      const seenTypes = new Set();
      for (const rt of rule.condition.resourceTypes) {
        if (rt === 'main_frame') {
          errors.push(prefix + '.condition.resourceTypes: main_frame is rejected');
        } else if (!ALLOWED_REMOTE_RESOURCE_TYPES.includes(rt)) {
          errors.push(prefix + '.condition.resourceTypes: "' + rt + '" is not allowed');
        }
        if (seenTypes.has(rt)) {
          errors.push(prefix + '.condition.resourceTypes: duplicate "' + rt + '"');
        }
        seenTypes.add(rt);
      }
    }
  }

  return errors;
}

export function validateRemoteDnrRuleset(rules, descriptor) {
  const errors = [];

  if (rules.length !== descriptor.rule_count) {
    errors.push('Rule count ' + rules.length + ' does not match descriptor (' + descriptor.rule_count + ')');
  }

  const seenIds = new Set();
  for (let i = 0; i < rules.length; i++) {
    const ruleErrors = validateRemoteDnrRule(rules[i], i);
    errors.push(...ruleErrors);

    if (Number.isInteger(rules[i].id)) {
      if (seenIds.has(rules[i].id)) {
        errors.push('rule[' + i + ']: duplicate id ' + rules[i].id);
      }
      seenIds.add(rules[i].id);
    }
  }

  return errors;
}

export function validateRulesetTextAgainstDescriptor(text, descriptor) {
  const descriptorErrors = validateRulesetFileDescriptor(descriptor);
  if (descriptorErrors.length > 0) {
    return { ok: false, errors: descriptorErrors };
  }

  const parseResult = parseRulesetText(text);
  if (!parseResult.ok) {
    return { ok: false, errors: parseResult.errors };
  }

  const errors = validateRemoteDnrRuleset(parseResult.rules, descriptor);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, rules: parseResult.rules };
}
