'use strict';

const RULESET_LABELS = {
  core_ads: 'Core Ads',
  privacy_trackers: 'Privacy Trackers',
  annoyances: 'Annoyances'
};

function render(health) {
  document.getElementById('version').textContent = 'v' + health.extension_version;

  const stats = health.stats;
  document.getElementById('blocked-today').textContent = stats.blocked_today.toLocaleString();
  document.getElementById('blocked-total').textContent = stats.blocked_total.toLocaleString();

  document.getElementById('ruleset-source').textContent =
    'Source: ' + stats.ruleset_source;

  const items = document.querySelectorAll('#ruleset-list li');
  items.forEach((li) => {
    const id = li.dataset.ruleset;
    const rulesetHealth = health.ruleset_health || {};
    const info = rulesetHealth[id];
    const dot = li.querySelector('.ruleset-dot');
    const status = li.querySelector('.ruleset-status');

    if (info && info.enabled) {
      dot.classList.add('active');
      status.textContent = 'Active';
    } else {
      dot.classList.add('inactive');
      status.textContent = 'Disabled';
    }
  });

  const rollbackCard = document.getElementById('rollback-card');
  if (stats.rollback_active) {
    rollbackCard.hidden = false;
    document.getElementById('rollback-text').textContent =
      'Rollback active' + (stats.rollback_reason ? ': ' + stats.rollback_reason : '');
  }

  renderTrustState(health);
}

function formatTimestamp(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '—';
  }
}

function renderTrustState(health) {
  const us = health.update_state || {};
  const lkg = health.last_known_good_ruleset || {};
  const rb = health.rollback_state || {};

  document.getElementById('trust-version').textContent = us.current_ruleset_version || 1;
  document.getElementById('trust-source').textContent = us.current_ruleset_source || 'static';
  document.getElementById('trust-last-success').textContent = formatTimestamp(us.last_success_at);

  const failureEl = document.getElementById('trust-last-failure');
  if (us.last_failure_stage) {
    failureEl.textContent = us.last_failure_stage;
    failureEl.classList.add('error');
  } else {
    failureEl.textContent = '—';
  }

  const failCountEl = document.getElementById('trust-failures');
  const fc = us.consecutive_failures || 0;
  failCountEl.textContent = fc;
  if (fc > 0) failCountEl.classList.add(fc >= 3 ? 'error' : 'warn');

  const rollbackEl = document.getElementById('trust-rollback');
  if (rb.rollback_active) {
    rollbackEl.textContent = 'Active';
    rollbackEl.classList.add('error');
  } else {
    rollbackEl.textContent = 'Inactive';
  }

  document.getElementById('trust-lkg').textContent =
    'v' + (lkg.ruleset_version || 1) + ' (' + (lkg.source || 'static') + ')';
}

// --- Allowlist UI ---

function renderAllowlist(list) {
  const ul = document.getElementById('allowlist-entries');
  ul.innerHTML = '';
  list.forEach((entry) => {
    const li = document.createElement('li');

    const span = document.createElement('span');
    span.className = 'allowlist-domain';
    span.textContent = entry.domain;

    const btn = document.createElement('button');
    btn.className = 'allowlist-remove-btn';
    btn.textContent = '×';
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage(
        { type: 'REMOVE_ALLOWLIST_DOMAIN', domain: entry.domain },
        (result) => {
          if (result && result.ok) {
            renderAllowlist(result.list);
          }
        }
      );
    });

    li.appendChild(span);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function showAllowlistError(msg) {
  const el = document.getElementById('allowlist-error');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3000);
}

function loadAllowlist() {
  chrome.runtime.sendMessage({ type: 'GET_ALLOWLIST' }, (response) => {
    if (response && response.list) {
      renderAllowlist(response.list);
    }
  });
}

function handleAddDomain() {
  const input = document.getElementById('allowlist-input');
  const raw = input.value;
  if (!raw.trim()) {
    showAllowlistError('Enter a domain');
    return;
  }
  chrome.runtime.sendMessage(
    { type: 'ADD_ALLOWLIST_DOMAIN', domain: raw },
    (result) => {
      if (result && result.error) {
        showAllowlistError(result.error);
      } else if (result && result.ok) {
        input.value = '';
        renderAllowlist(result.list);
      }
    }
  );
}

// --- Init ---

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ type: 'GET_HEALTH' }, (response) => {
    if (response) {
      render(response);
    }
  });

  loadAllowlist();

  document.getElementById('allowlist-add-btn').addEventListener('click', handleAddDomain);
  document.getElementById('allowlist-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddDomain();
  });
});
