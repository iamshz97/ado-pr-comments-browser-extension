// Pure helpers: no DOM, no chrome.* — easy to test in Node.

// The REST API returns status strings, but older payloads use the numeric enum.
const STATUS_BY_NUM = ['unknown', 'active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending'];
const OPEN_STATUSES = new Set(['active', 'pending', 'unknown']);

export const STATUS_LABEL = {
  active: 'Active',
  pending: 'Pending',
  fixed: 'Resolved',
  wontFix: "Won't fix",
  closed: 'Closed',
  byDesign: 'By design',
  unknown: 'Unknown',
};

/**
 * Parses any Azure DevOps PR URL:
 *   https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
 *   https://dev.azure.com/{org}/_git/{repo}/pullrequest/{id}        (repo named like the project)
 *   https://{org}.visualstudio.com/[DefaultCollection/]{project}/_git/{repo}/pullrequest/{id}
 *   https://{server}/{collection path}/{project}/_git/{repo}/pullrequest/{id}  (Azure DevOps Server)
 * Query strings and hashes (?_a=files, ?discussionId=…) are ignored.
 */
export function parsePrUrl(href) {
  let url;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const seg = url.pathname.split('/').filter(Boolean);
  const i = seg.findIndex((s) => s.toLowerCase() === '_git');
  if (i < 0 || seg[i + 2]?.toLowerCase() !== 'pullrequest' || !/^\d+$/.test(seg[i + 3] ?? '')) return null;

  const host = url.hostname.toLowerCase();
  let rootLen; // path segments that make up the org / collection root
  let org;
  if (host === 'dev.azure.com') {
    rootLen = 1;
    org = seg[0];
  } else if (host.endsWith('.visualstudio.com')) {
    rootLen = seg[0]?.toLowerCase() === 'defaultcollection' && i > 1 ? 1 : 0;
    org = host.split('.')[0];
  } else {
    rootLen = Math.max(0, i - 1);
    org = host;
  }
  if (i < rootLen) return null;

  const repo = seg[i + 1];
  const project = i > rootLen ? seg[i - 1] : repo;
  const orgRoot = [url.origin, ...seg.slice(0, rootLen)].join('/');
  const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

  return {
    id: Number(seg[i + 3]),
    org: dec(org),
    project: dec(project),
    repo: dec(repo),
    orgRoot,
    apiBase: `${orgRoot}/${project}/_apis/git/repositories/${repo}`,
    prUrl: [url.origin, ...seg.slice(0, i + 4)].join('/'),
  };
}

const statusOf = (s) => (typeof s === 'number' ? STATUS_BY_NUM[s] : s) || 'unknown';
const isText = (c) => !c.isDeleted && (c.commentType === 'text' || c.commentType === 1);
const keyOf = (author) => author?.id || author?.displayName || 'unknown';

function lineOf(ctx) {
  const start = ctx?.rightFileStart?.line ?? ctx?.leftFileStart?.line;
  if (start == null) return null;
  const end = ctx?.rightFileEnd?.line ?? ctx?.leftFileEnd?.line;
  return end && end !== start ? `${start}–${end}` : String(start);
}

function byLocation(a, b) {
  if (!a.file !== !b.file) return a.file ? 1 : -1; // PR-level threads first
  return (a.file ?? '').localeCompare(b.file ?? '') || (parseInt(a.line) || 0) - (parseInt(b.line) || 0);
}

/**
 * Turns raw threads into what the popup shows and copies.
 * @param {object[]} rawThreads  `value` of GET …/pullRequests/{id}/threads
 * @param {{ me: {id?: string, name?: string} | null,
 *           anonymize: boolean, hideMine: boolean, excluded: Set<string> }} opts
 */
export function buildModel(rawThreads, { me, anonymize, hideMine, excluded }) {
  const isMe = (a) => !!(a && me && ((me.id && a.id === me.id) || (me.name && a.displayName === me.name)));

  // Only unresolved threads where someone other than me said something.
  const threads = rawThreads
    .map((t) => ({
      id: t.id,
      status: statusOf(t.status),
      file: t.threadContext?.filePath ?? null,
      line: lineOf(t.threadContext),
      published: t.publishedDate ?? '',
      comments: (t.comments ?? []).filter(isText),
    }))
    .filter((t) => OPEN_STATUSES.has(t.status) && t.comments.some((c) => !isMe(c.author)));

  // Aliases are assigned chronologically, so excluding a reviewer never renumbers the others.
  const people = new Map();
  let n = 0;
  [...threads]
    .sort((a, b) => a.published.localeCompare(b.published))
    .forEach((t) => t.comments.forEach((c) => {
      const key = keyOf(c.author);
      if (people.has(key)) return;
      const mine = isMe(c.author);
      people.set(key, {
        key,
        id: c.author?.id?.toLowerCase(),
        name: c.author?.displayName ?? 'Unknown',
        isMe: mine,
        alias: mine ? 'Me' : `Reviewer #${++n}`,
        count: 0,
      });
    }));

  const display = (p) => (anonymize ? p.alias : p.name);
  const byId = new Map([...people.values()].filter((p) => p.id).map((p) => [p.id, p]));
  const namesLongestFirst = [...people.values()].filter((p) => p.name.length > 2).sort((a, b) => b.name.length - a.name.length);

  const cleanText = (text) => {
    let out = (text ?? '').replace(/@<([0-9a-f-]{36})>/gi, (_, id) => {
      const p = byId.get(id.toLowerCase());
      return `@${p ? display(p) : 'someone'}`;
    });
    if (anonymize) for (const p of namesLongestFirst) out = out.replaceAll(p.name, p.alias);
    return out.trim();
  };

  threads.forEach((t) => t.comments.forEach((c) => people.get(keyOf(c.author)).count++));

  const visible = threads
    .map((t) => ({
      ...t,
      comments: t.comments
        .filter((c) => !(hideMine && isMe(c.author)) && !excluded.has(keyOf(c.author)))
        .map((c) => {
          const p = people.get(keyOf(c.author));
          return { author: display(p), key: p.key, isMe: p.isMe, text: cleanText(c.content) };
        }),
    }))
    .filter((t) => t.comments.some((c) => !c.isMe))
    .sort(byLocation);

  const comments = visible.reduce((sum, t) => sum + t.comments.length, 0);
  const reviewers = new Set(visible.flatMap((t) => t.comments.filter((c) => !c.isMe).map((c) => c.key)));

  return {
    threads: visible,
    stats: { threads: visible.length, comments, reviewers: reviewers.size },
    people: [...people.values()]
      .filter((p) => !p.isMe && p.count > 0)
      .sort((a, b) => b.count - a.count)
      .map((p) => ({ ...p, label: display(p), excluded: excluded.has(p.key) })),
  };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function toMarkdown(model, pr, { title }) {
  const subject = title ? `pull request #${pr.id} "${title}"` : `pull request #${pr.id}`;
  const out = [
    `Below are the unresolved reviewer comments on Azure DevOps ${subject}.`,
    'Please fix them in the codebase according to what each reviewer is asking for.',
    'If a comment is unclear or you think the change is wrong, explain why instead of changing the code.',
    '',
  ];
  out.push(`# PR #${pr.id}${title ? `: ${title}` : ''}`);
  out.push(`Repository: ${pr.org}/${pr.project}/${pr.repo}`);
  out.push(`${plural(model.stats.threads, 'unresolved thread')} · ${plural(model.stats.comments, 'comment')}`);

  model.threads.forEach((t, i) => {
    const where = t.file ? `\`${t.file}\`${t.line ? ` · line ${t.line}` : ''}` : 'General (PR-level)';
    out.push('', '---', '', `## ${i + 1}. ${where} · ${STATUS_LABEL[t.status] ?? t.status}`);
    t.comments.forEach((c, j) => out.push('', `**${j ? '↳ ' : ''}${c.author}:**`, c.text));
  });

  return `${out.join('\n')}\n`;
}
