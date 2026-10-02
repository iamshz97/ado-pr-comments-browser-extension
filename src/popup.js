import { parsePrUrl, buildModel, toMarkdown, STATUS_LABEL } from './ado.js';

const DEFAULTS = { anonymize: true, hideMine: true, myName: '' };

const ICONS = {
  refresh: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bubble: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 9h28a5 5 0 0 1 5 5v15a5 5 0 0 1-5 5H22l-8 6v-6h-4a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 18h20M14 25h12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
};

const $ = (sel) => document.querySelector(sel);
const app = $('#app');
const excluded = new Set();
let tab, pr, data, settings, model;

init();

async function init() {
  settings = await chrome.storage.local.get(DEFAULTS);
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  pr = tab?.url ? parsePrUrl(tab.url) : null;
  if (!pr) return renderEmpty();
  load();
}

async function load() {
  renderLoading();
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: fetchInPage,
      args: [pr.apiBase, pr.orgRoot, pr.id],
    });
    if (!result?.ok) return renderError(result);
    data = result;
    renderMain();
  } catch (err) {
    renderError({ error: err.message });
  }
}

// Runs inside the Azure DevOps tab, so requests carry the user's session. Must be self-contained.
async function fetchInPage(apiBase, orgRoot, prId) {
  const get = async (url) => {
    const res = await fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } });
    // Signed-out requests come back as a 203 HTML sign-in page rather than a 401.
    if (res.status === 401 || res.status === 203 || !(res.headers.get('content-type') ?? '').includes('json')) {
      throw new Error('auth');
    }
    if (!res.ok) throw new Error(`Azure DevOps responded with ${res.status} ${res.statusText}`.trim());
    return res.json();
  };
  try {
    const [threads, info, conn] = await Promise.all([
      get(`${apiBase}/pullRequests/${prId}/threads?api-version=7.1`),
      get(`${apiBase}/pullRequests/${prId}?api-version=7.1`).catch(() => null),
      get(`${orgRoot}/_apis/connectionData`).catch(() => null),
    ]);
    const user = conn?.authenticatedUser;
    return {
      ok: true,
      threads: (threads.value ?? []).map((t) => ({
        id: t.id,
        status: t.status,
        publishedDate: t.publishedDate,
        threadContext: t.threadContext,
        comments: (t.comments ?? []).map((c) => ({
          content: c.content,
          commentType: c.commentType,
          isDeleted: c.isDeleted,
          author: { id: c.author?.id, displayName: c.author?.displayName },
        })),
      })),
      pr: info && { title: info.title, status: info.status, isDraft: !!info.isDraft },
      me: user ? { id: user.id, name: user.providerDisplayName || user.customDisplayName } : null,
    };
  } catch (err) {
    return { ok: false, auth: err.message === 'auth', error: err.message };
  }
}

// ── Views ───────────────────────────────────────────────────────────────────

function renderEmpty() {
  app.innerHTML = `
    <div class="state">
      <div class="state-icon">${ICONS.bubble}</div>
      <h1>Open a pull request</h1>
      <p>Go to a PR in Azure DevOps, then open this again to summarize and copy its review comments.</p>
      <code>dev.azure.com/…/_git/…/pullrequest/123</code>
    </div>`;
}

function renderLoading() {
  app.innerHTML = `
    <div class="loading" aria-label="Loading comments">
      <div class="sk sk-line" style="width:30%"></div>
      <div class="sk sk-line sk-lg" style="width:85%"></div>
      <div class="sk sk-line" style="width:45%"></div>
      <div class="sk-row">${'<div class="sk sk-tile"></div>'.repeat(4)}</div>
      <div class="sk sk-block"></div>
      <div class="sk sk-block"></div>
    </div>`;
}

function renderError({ auth, error }) {
  app.innerHTML = `
    <div class="state">
      <div class="state-icon state-icon-warn">${ICONS.bubble}</div>
      <h1>${auth ? 'Sign in to Azure DevOps' : 'Couldn’t load comments'}</h1>
      <p>${auth ? 'Your session in this tab looks signed out. Sign in, then retry.' : esc(error ?? 'Something went wrong.')}</p>
      <button class="secondary" id="retry">Try again</button>
    </div>`;
  $('#retry').onclick = load;
}

function renderMain() {
  const prState = data.pr?.isDraft ? 'draft' : data.pr?.status;
  const title = data.pr?.title ?? `Pull request ${pr.id}`;

  app.innerHTML = `
    <header class="head">
      <div class="head-row">
        <span class="eyebrow">PR #${pr.id}</span>
        ${prState ? `<span class="badge badge-${esc(prState)}">${esc(prState)}</span>` : ''}
        <button class="icon-btn" id="refresh" title="Refresh" aria-label="Refresh">${ICONS.refresh}</button>
      </div>
      <h1 class="title" title="${esc(title)}">${esc(title)}</h1>
      <p class="crumbs">${esc(pr.project)}<span>/</span>${esc(pr.repo)}</p>
    </header>

    <section class="stats" id="stats"></section>

    <section class="panel">
      ${toggle('anonymize', 'Anonymize names')}
      ${toggle('hideMine', 'Hide my comments')}
    </section>

    <section class="block" id="people-block">
      <h2>Reviewers <span class="hint">tap to exclude</span></h2>
      <div class="chips" id="people"></div>
    </section>

    <section class="block">
      <h2>Comments</h2>
      <ol class="threads" id="threads"></ol>
    </section>

    <footer class="footer">
      <button class="primary" id="copy"></button>
      <div class="who" id="who"></div>
    </footer>`;

  $('#refresh').onclick = load;
  $('#copy').onclick = copy;
  document.querySelectorAll('input[data-setting]').forEach((input) => {
    input.onchange = () => save({ [input.dataset.setting]: input.checked });
  });
  $('#people').onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    excluded.has(chip.dataset.key) ? excluded.delete(chip.dataset.key) : excluded.add(chip.dataset.key);
    update();
  };
  $('#threads').onclick = (e) => {
    const item = e.target.closest('[data-thread]');
    if (!item) return;
    chrome.tabs.update(tab.id, { url: `${pr.prUrl}?discussionId=${item.dataset.thread}` });
    window.close();
  };

  update();
}

function toggle(key, label) {
  return `
    <label class="row">
      <span>${label}</span>
      <input type="checkbox" class="switch" data-setting="${key}">
    </label>`;
}

function me() {
  return settings.myName ? { name: settings.myName } : data.me;
}

function update() {
  model = buildModel(data.threads, { ...settings, me: me(), excluded });
  const { stats, people, threads } = model;

  document.querySelectorAll('input[data-setting]').forEach((i) => (i.checked = settings[i.dataset.setting]));

  $('#stats').innerHTML = [
    [stats.threads, 'Unresolved'],
    [stats.comments, 'Comments'],
    [stats.reviewers, 'Reviewers'],
    [stats.files, 'Files'],
  ].map(([n, label]) => `<div class="stat"><b>${n}</b><span>${label}</span></div>`).join('');

  $('#people-block').hidden = people.length === 0;
  $('#people').innerHTML = people.map((p) => `
    <button class="chip" data-key="${esc(p.key)}" aria-pressed="${!p.excluded}"
            title="${esc(p.name)}${p.excluded ? ' — excluded' : ''}">
      <span class="avatar" style="--h:${hue(p.key)}">${esc(initials(p.label))}</span>
      <span class="chip-text">
        <span class="chip-name">${esc(p.label)}</span>
        ${settings.anonymize ? `<span class="chip-real">${esc(p.name)}</span>` : ''}
      </span>
      <span class="chip-n">${p.count}</span>
    </button>`).join('');

  $('#threads').innerHTML = threads.length
    ? threads.map(threadItem).join('')
    : `<li class="all-clear"><b>All clear</b><span>No unresolved review comments.</span></li>`;

  const copyBtn = $('#copy');
  copyBtn.disabled = threads.length === 0;
  copyBtn.classList.remove('done');
  copyBtn.innerHTML = `${ICONS.copy}<span>Copy ${stats.threads} thread${stats.threads === 1 ? '' : 's'} for LLM</span><kbd>C</kbd>`;

  renderWho();
}

function threadItem(t) {
  const [first, ...replies] = t.comments;
  const slash = t.file ? t.file.lastIndexOf('/') + 1 : 0;
  const where = t.file
    ? `<span class="t-file" title="${esc(t.file)}"><span class="t-dir">${esc(t.file.slice(0, slash))}</span><span class="t-name">${esc(t.file.slice(slash))}</span></span>`
    : '<span class="t-file">General</span>';
  return `
    <li>
      <button class="thread" data-thread="${t.id}" title="Open in Azure DevOps">
        <span class="t-head">
          <span class="dot dot-${esc(t.status)}" title="${esc(STATUS_LABEL[t.status] ?? t.status)}"></span>
          ${where}
          ${t.line ? `<span class="t-line">L${esc(t.line)}</span>` : ''}
        </span>
        <span class="t-body"><b>${esc(first.author)}</b> ${esc(first.text.replace(/\s+/g, ' '))}</span>
        ${replies.length ? `<span class="t-replies">+${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}</span>` : ''}
      </button>
    </li>`;
}

function renderWho() {
  const who = $('#who');
  const current = me();
  who.innerHTML = current?.name
    ? `<span>You are <b>${esc(current.name)}</b></span><button class="link" id="edit-me">change</button>`
    : `<span>Couldn’t detect you.</span><button class="link" id="edit-me">Set your name</button>`;
  $('#edit-me').onclick = () => {
    who.innerHTML = `<input id="me-input" placeholder="Your Azure DevOps display name" value="${esc(settings.myName)}">`;
    const input = $('#me-input');
    input.focus();
    input.onkeydown = (e) => {
      if (e.key === 'Enter') save({ myName: input.value.trim() });
      if (e.key === 'Escape') renderWho();
    };
    input.onblur = () => save({ myName: input.value.trim() });
  };
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function save(patch) {
  Object.assign(settings, patch);
  update();
  await chrome.storage.local.set(patch);
}

async function copy() {
  if (!model?.threads.length) return;
  const md = toMarkdown(model, pr, { ...settings, title: data.pr?.title });
  const btn = $('#copy');
  try {
    await navigator.clipboard.writeText(md);
    btn.classList.add('done');
    btn.innerHTML = `${ICONS.check}<span>Copied — paste into your LLM</span>`;
  } catch {
    btn.innerHTML = `<span>Clipboard blocked — try again</span>`;
  }
  clearTimeout(copy.timer);
  copy.timer = setTimeout(update, 1800);
}

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest('input, textarea')) return;
  e.preventDefault();
  copy();
});

// ── Utils ───────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function initials(label) {
  const alias = label.match(/^Reviewer #(\d+)$/);
  if (alias) return `R${alias[1]}`;
  return label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

function hue(key) {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
