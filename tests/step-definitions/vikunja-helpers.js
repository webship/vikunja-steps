'use strict';

// Shared helpers for the step files of this pack.
//
// Not a step file: it registers no step definitions and no hooks. It holds the plumbing the steps use and that
// another pack can require instead of copying: the wait budget, presence assertions with friendly errors, URL
// building, the users registry, signing in (the form, and a session put back: the site keeps it in the page's storage,
// not in a cookie), the site's own API as the managing account (the test content a scenario makes and removes), and the
// tasks a scenario made, which go after it.
//
// Everything here builds on webship-js's own helpers (`gotoUrl`, `smartSettle`, `waitForPageLoad`, `friendly`) so the
// steps behave like the core webship-js steps.

const { gotoUrl, smartSettle, waitForPageLoad, friendly } = require('webship-js/tests/step-definitions/webship');

let playwright;
try { playwright = require('playwright'); } catch { playwright = require(require.resolve('playwright', { paths: [require.resolve('webship-js/package.json')] })); }

/**
 * The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 15 seconds (the site's screens load
 * their data after the page), so a slow screen does not fail an assertion that would pass a moment later. Kept below
 * webship-js's 45 second step timeout.
 *
 * @param {object} world
 * @returns {number}
 */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 15000);
}

/**
 * Escape a literal string for use in a RegExp.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A RegExp that matches the whole text (ignoring surrounding space and case), for exact names and labels.
 *
 * @param {string} text
 * @returns {RegExp}
 */
function exactly(text) {
  return new RegExp('^\\s*' + words(text) + '\\s*$', 'i');
}

/**
 * The source of a pattern for a text whose words may stand apart by any white space: a pattern of a locator tests the
 * element's whole text, where the site's markup can put two spaces or a line break between words.
 *
 * @param {string} text
 * @returns {string}
 */
function words(text) {
  return escapeRegExp(String(text).trim()).replace(/\s+/g, '\\s+');
}

/**
 * Collapse runs of white space and trim.
 *
 * @param {string} text
 * @returns {string}
 */
function tidy(text) {
  return String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Run an action and rethrow its failure as a friendly error (action, target, cause and a hint) instead of
 * Playwright's raw timeout stack.
 *
 * @param {string} label
 * @param {string} target
 * @param {Function} fn
 * @param {string} hint
 */
async function actOrExplain(label, target, fn, hint) {
  try {
    return await fn();
  } catch (err) {
    if (err && err.stack === err.message && /Hint:/.test(err.message)) throw err;
    throw friendly({ action: label, target, cause: err, hint });
  }
}

/**
 * Wait until a locator has (or, with `notCase`, no longer has) a visible match and fail with a friendly error
 * otherwise: the wait and the assertion are one call, so content that arrives a moment late still passes.
 *
 * @param {import('playwright').Locator} locator
 * @param {string|null|undefined} notCase
 * @param {{label: string, hint: string, timeout: number}} options
 */
async function assertPresence(locator, notCase, { label, hint, timeout }) {
  try {
    await locator.first().waitFor({ state: notCase ? 'hidden' : 'visible', timeout });
  } catch {
    throw friendly({
      message: notCase ? `Expected not to see ${label}, but it is still on the page.` : `Expected to see ${label}, but it did not appear within ${timeout} ms.`,
      hint,
    });
  }
}

/**
 * Poll a reader until its value satisfies a test, and return the last value read, so a value that changes a moment
 * after the action (a status after a save) still passes. A read is an answer of the site's API, which the site
 * limits a minute for an account: once a second, by default.
 *
 * @param {Function} read - async () => value
 * @param {Function} test - (value) => boolean
 * @param {number} timeout
 * @param {number} [every] - milliseconds between two reads
 * @returns {Promise<{ok: boolean, value: *}>}
 */
async function waitForValue(read, test, timeout, every = 1000) {
  const deadline = Date.now() + timeout;
  let value;
  for (;;) {
    try { value = await read(); } catch { value = undefined; }
    if (value !== undefined && test(value)) return { ok: true, value };
    if (Date.now() >= deadline) return { ok: false, value };
    await new Promise((resolve) => setTimeout(resolve, every));
  }
}

/**
 * The site root without a trailing slash.
 *
 * @param {object} world
 * @returns {string}
 */
function siteRoot(world) {
  return String(world.launchUrl).replace(/\/+$/, '');
}

/**
 * Join the site root and a path with exactly one slash. Absolute URLs pass through.
 *
 * @param {object} world
 * @param {string} url
 * @returns {string}
 */
function siteUrl(world, url) {
  if (!url) return siteRoot(world);
  if (/^https?:\/\//i.test(url)) return url;
  return siteRoot(world) + '/' + String(url).replace(/^\/+/, '');
}

/**
 * Open a page of the site and wait for it to settle. The site draws its screens after the page has loaded, so a step
 * waits on what it needs next.
 *
 * @param {object} world
 * @param {string} url
 */
async function open(world, url) {
  await gotoUrl(world.page, siteUrl(world, url));
  await world.page.waitForSelector('body', { state: 'attached', timeout: budget(world) });
  await waitForPageLoad(world.page, (world.minWaitTime && world.minWaitTime.page) || 3000);
}

/**
 * A user of the `users` registry in cucumber.js (`worldParameters.users`): the username (or the e-mail address) the
 * site logs in with (`username`), its password, and the name the site shows (`name`).
 *
 * @param {object} world
 * @param {string} handle
 * @returns {{username: string, password: string, name: string}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The account "${handle}" is not in the users registry. Known accounts: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.VIKUNJA_${handle.toUpperCase()}_PASSWORD, name: '${handle}' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.password) {
    throw friendly({ message: `The account "${handle}" has no password in the users registry.`, hint: `Set VIKUNJA_${handle.toUpperCase()}_PASSWORD, or the password in worldParameters.users of cucumber.js.` });
  }
  return { username: String(entry.username || handle), password: String(entry.password), name: String(entry.name || entry.username || handle) };
}

// ---------------------------------------------------------------------------
// The session: the site keeps it in the page's storage (a token), with a cookie that renews it
// ---------------------------------------------------------------------------

const apiContexts = new Map();

/**
 * The run's own client of the site's API, apart from the browser: a login through the API sets the cookie that renews
 * a session, and the browser's session must never become the account the API logged in as.
 *
 * @param {object} world
 * @returns {Promise<import('playwright').APIRequestContext>}
 */
async function apiContext(world) {
  const root = siteRoot(world);
  if (!apiContexts.has(root)) apiContexts.set(root, await playwright.request.newContext({ ignoreHTTPSErrors: true }));
  return apiContexts.get(root);
}

/** The run's API clients, and their end. */
const managerContexts = {
  async dispose() {
    for (const c of apiContexts.values()) await c.dispose().catch(() => {});
    apiContexts.clear();
    managers.clear();
  },
};

/**
 * One call of the site's API with a token (the managing account's, or the browser's session's): [status, answer].
 * The site's API has two versions: v1, and v2 for what v1 does not have (a task's removal from the trash).
 *
 * @param {object} world
 * @param {string} method
 * @param {string} route - "/tasks/12"
 * @param {object} [body]
 * @param {string} [token]
 * @param {string} [version] - 'v1' (the default) or 'v2'
 * @returns {Promise<[number, *]>}
 */
async function apiWith(world, method, route, body, token, version = 'v1') {
  const request = await apiContext(world);
  const r = await request.fetch(`${siteRoot(world)}/api/${version}${route}`, {
    method, ignoreHTTPSErrors: true, failOnStatusCode: false,
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(body !== undefined ? { data: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  return [r.status(), data];
}

/** The session's token, as the page keeps it, or ''. */
async function pageToken(world) {
  if (!world.page.url().startsWith(siteRoot(world))) return '';
  return world.page.evaluate(() => window.localStorage.getItem('token') || '').catch(() => '');
}

/** The account of the browser's session, as the site's API says it: { username, name } or null. */
async function currentAccount(world) {
  const token = await pageToken(world);
  if (!token) return null;
  const [status, me] = await apiWith(world, 'GET', '/user', undefined, token);
  return status === 200 && me ? { username: String(me.username || ''), name: String(me.name || me.username || ''), email: String(me.email || '') } : null;
}

/** The username of the browser's session, or '' for none. */
async function currentUser(world) {
  const me = await currentAccount(world);
  return me ? me.username : '';
}

/** The browser forgets its session: the token in the page's storage, and the cookie that renews it. */
async function dropSession(world) {
  if (world.page.url().startsWith(siteRoot(world))) await world.page.evaluate(() => window.localStorage.removeItem('token')).catch(() => {});
  await world.context.clearCookies();
}

/** Fill and submit the login form: the username (or the address), the password, LOGIN. */
async function submitLogin(world, username, password) {
  await open(world, '/login');
  const page = world.page;
  await page.locator('#username').waitFor({ state: 'visible', timeout: budget(world) });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^\s*login\s*$/i }).click();
}

/** What the login form says, or ''. */
async function loginSays(world) {
  return tidy(await world.page.locator('.message.is-danger, .message.danger, .notification.is-danger, .message').first().innerText({ timeout: 1500 }).catch(() => ''));
}

const sessions = new Map();

/**
 * Sign in with an account of the users registry and make sure the session is that account's. An account that is
 * already signed in is kept; an account that signed in earlier in the run gets its session back (its token in the
 * page's storage, and its cookies); otherwise the account goes through the login form.
 *
 * @param {object} world
 * @param {string} handle
 */
async function signInAs(world, handle) {
  const user = resolveUser(world, handle);
  const key = siteRoot(world) + '|' + handle;
  const same = (name) => [user.username.toLowerCase(), user.username.split('@')[0].toLowerCase()].includes(String(name).toLowerCase());
  if (same(await currentUser(world))) return;
  if (!world.page.url().startsWith(siteRoot(world))) await open(world, '/login');
  await dropSession(world);
  const saved = sessions.get(key);
  if (saved) {
    await world.context.addCookies(saved.cookies);
    await world.page.evaluate((t) => window.localStorage.setItem('token', t), saved.token);
    await open(world, '/');
    if (same(await currentUser(world))) return;
    sessions.delete(key);
    await dropSession(world);
  }
  await submitLogin(world, user.username, user.password);
  const result = await waitForValue(() => currentUser(world), same, budget(world));
  if (!result.ok) {
    const said = await loginSays(world);
    throw friendly({
      message: `Logging in as "${handle}" (${user.username}) did not work${said ? `: the site says "${said}"` : `; the page is ${world.page.url()}`}.`,
      hint: /too many/i.test(said)
        ? 'The site allows a set number of requests a minute before a login from one address (10 by default; 100 on a test site the Webship Workspace builds): wait a minute, or raise it for the test site.'
        : 'Check the username and the password of this account in worldParameters.users of cucumber.js, and that the account exists on the site and is active.',
    });
  }
  sessions.set(key, { token: await pageToken(world), cookies: await world.context.cookies() });
}

// ---------------------------------------------------------------------------
// The site's own API, as the managing account
// ---------------------------------------------------------------------------

const managers = new Map();

/** The managing account's token (worldParameters.manager, the owner of the projects used), from a login of its own. */
async function managerToken(world) {
  const root = siteRoot(world);
  const handle = (world.parameters && world.parameters.manager) || 'owner';
  const key = root + '|' + handle;
  if (managers.has(key)) return managers.get(key);
  const user = resolveUser(world, handle);
  for (let attempt = 1; ; attempt += 1) {
    const [status, answer] = await apiWith(world, 'POST', '/login', { username: user.username, password: user.password });
    if (status === 200 && answer && answer.token) {
      managers.set(key, answer.token);
      return answer.token;
    }
    if (status === 429 && attempt < 6) { await new Promise((r) => setTimeout(r, 10000)); continue; }
    throw friendly({
      message: `The managing account "${handle}" could not log in to the site's API (${status}${answer && answer.message ? `: ${answer.message}` : ''}).`,
      hint: 'worldParameters.manager names an account of the users registry: the owner of the projects the features use.',
    });
  }
}

/** One call of the site's API as the managing account; its answer, or a friendly error that says what was asked. */
async function api(world, method, route, body, what, version = 'v1') {
  const token = await managerToken(world);
  const [status, answer] = await apiWith(world, method, route, body, token, version);
  if (status < 200 || status >= 300) {
    throw friendly({
      message: `Could not ${what}: the site answered ${status}${answer && answer.message ? ` (${answer.message})` : ''}.`,
      hint: 'The managing account (worldParameters.manager) must be the owner of the projects the features use, or share them as an admin.',
    });
  }
  return answer;
}

/** A project of the site by its title, as the managing account sees it: { id, title, key }. */
async function findProject(world, which) {
  const wanted = String(which || (world.parameters && world.parameters.project) || '').trim();
  const list = await api(world, 'GET', '/projects?per_page=250', undefined, 'read the projects');
  const found = (Array.isArray(list) ? list : []).find((p) => Number(p.id) > 0 && exactly(wanted).test(String(p.title)));
  if (!found) {
    throw friendly({ message: `No project "${wanted}" the managing account can see.`, hint: 'Name the project by its title, as the site lists it ("Webship site").' });
  }
  return { id: String(found.id), title: String(found.title), key: String(found.identifier || '') };
}

/** The tasks of a project with this title, done or not. */
async function findTasks(world, project, title) {
  const q = new URLSearchParams({ filter: `project = ${project.id}`, s: title, per_page: '50' });
  const list = await api(world, 'GET', `/tasks?${q.toString()}`, undefined, `read the tasks of ${project.title}`);
  return (Array.isArray(list) ? list : []).filter((t) => exactly(title).test(String(t.title)));
}

/** A task by its title or its key ("WEB-1"), in a project (the scenario's, else the default one): the API's task. */
async function taskNamed(world, which, projectName) {
  const project = await findProject(world, projectName || (world.vikunja && world.vikunja.project));
  const key = /^(?:([A-Za-z][A-Za-z0-9]{0,9})-|#)([1-9][0-9]{0,9})$/.exec(String(which).trim());
  if (key) {
    const [status, t] = await apiWith(world, 'GET', `/projects/${project.id}/tasks/by-index/${key[2]}`, undefined, await managerToken(world));
    if (status === 200 && t) return { ...t, project };
  }
  const list = await findTasks(world, project, which);
  if (!list.length) throw friendly({ message: `No task "${which}" in ${project.title}.`, hint: 'Name a task by its title or by its key ("WEB-1"); a scenario makes its own with Given there is a task "Webship test …".' });
  return { ...list[0], project };
}

/** A task a scenario made goes after it. */
function remember(world, id) {
  world.vikunja = world.vikunja || {};
  world.vikunja.made = world.vikunja.made || new Set();
  world.vikunja.made.add(String(id));
}

/**
 * Remove a task for good, as the managing account: the site moves a removed task to its trash, where it stays 30 days,
 * so the task goes to the trash and then out of it, with everything attached to it. A task in the trash already goes
 * out of it.
 *
 * @param {object} world
 * @param {string} id
 */
async function removeTask(world, id) {
  const [status, answer] = await apiWith(world, 'DELETE', `/tasks/${id}`, undefined, await managerToken(world));
  const trashed = status === 404 && answer && answer.details && answer.details.deleted_at;
  if ((status < 200 || status >= 300) && !trashed) {
    throw friendly({ message: `Could not remove the task ${id}: the site answered ${status}${answer && answer.message ? ` (${answer.message})` : ''}.`, hint: 'The managing account (worldParameters.manager) must be the owner of the projects the features use, or share them as an admin.' });
  }
  await api(world, 'DELETE', `/tasks/${id}/permanent`, undefined, `remove the task ${id} from the trash`, 'v2');
}

/** Make a task in a project, as the managing account; it goes after the scenario. */
async function makeTask(world, project, title) {
  const made = await api(world, 'PUT', `/projects/${project.id}/tasks`, { title }, `make the task "${title}" in ${project.title}`);
  remember(world, made.id);
  return { ...made, project };
}

/** The task the scenario opened, as the site has it now. */
async function taskNow(world) {
  const id = world.vikunja && world.vikunja.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  const t = await api(world, 'GET', `/tasks/${id}`, undefined, `read the task ${id}`);
  return t;
}

/**
 * Whether a task is in the site's trash, as the managing account reads it: 'trash' (the site answers it is in the
 * trash), 'live' (it reads the task), or 'gone'.
 *
 * @param {object} world
 * @param {string} id
 * @returns {Promise<'trash'|'live'|'gone'>}
 */
async function trashState(world, id) {
  const [status, answer] = await apiWith(world, 'GET', `/tasks/${id}`, undefined, await managerToken(world));
  if (status === 200) return 'live';
  return status === 404 && answer && answer.details && answer.details.deleted_at ? 'trash' : 'gone';
}

/** Open a task on its own page and wait for its title. */
async function openTask(world, task) {
  world.vikunja = world.vikunja || {};
  world.vikunja.task = String(task.id);
  world.vikunja.title = String(task.title);
  world.vikunja.project = task.project ? task.project.title : world.vikunja.project;
  await open(world, `/tasks/${task.id}`);
  await actOrExplain('open the task', String(task.identifier || task.id), async () => {
    await world.page.locator('h1.title, .heading h1, h1').filter({ hasText: exactly(task.title) }).first().waitFor({ state: 'visible', timeout: budget(world) });
  }, 'The task\'s page did not show its title: the account must be one the project is shared with.');
}

/** A button of the task's page by its words, whatever their case ("Mark task done!", "Add labels"). */
function taskButton(world, words) {
  return world.page.locator('main button, main a.button').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(words)}\\s*$`, 'i') }).first();
}

module.exports = {
  budget,
  escapeRegExp,
  exactly,
  words,
  tidy,
  actOrExplain,
  assertPresence,
  waitForValue,
  siteRoot,
  siteUrl,
  open,
  resolveUser,
  apiContext,
  managerContexts,
  apiWith,
  pageToken,
  currentAccount,
  currentUser,
  dropSession,
  submitLogin,
  loginSays,
  signInAs,
  managerToken,
  api,
  findProject,
  findTasks,
  taskNamed,
  remember,
  removeTask,
  makeTask,
  taskNow,
  trashState,
  openTask,
  taskButton,
  friendly,
  smartSettle,
  playwright,
};
