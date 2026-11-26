'use strict';

// Logging in and out, the session's account, and who may open a project.
//
// The site logs in with a username (or an e-mail address) and a password on one form (/login), and keeps the session
// in the page's storage, not in a cookie; it logs out from its user menu. The session's account is read from the
// site's own API, so a step never guesses it from the page. A project is opened by its title; an account the project
// is not shared with is refused it.

const { Given, When, Then, After, AfterAll } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./vikunja-helpers');

/**
 * Log in as an account of the users registry (cucumber.js, worldParameters.users), or keep its session when it is the
 * browser's already.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "owner" user
 * Example #3: And I am a logged in user with the "member" user
 * Example #4: And we are a logged in user with the "owner" user
 * Example #5: Given we are a logged in user with the "member" user
 */
Given(/^(I am|we are) a logged in user with the "([^"]*)" user$/, async function (_who, handle) {
  await h.signInAs(this, handle);
});

/**
 * Log in through the form as an account of the users registry: a new session, whatever the browser held.
 *
 * Example #1: When I log in with the "member" user
 * Example #2: When log in with the "reader" user
 * Example #3: And I log in with the "member" user
 * Example #4: And log in with the "reader" user
 * Example #5: When we log in with the "member" user
 */
When(/^(I |we )*log in with the "([^"]*)" user$/, async function (_who, handle) {
  const user = h.resolveUser(this, handle);
  await h.open(this, '/login');
  await h.dropSession(this);
  await h.submitLogin(this, user.username, user.password);
  const same = (name) => [user.username.toLowerCase(), user.username.split('@')[0].toLowerCase()].includes(String(name).toLowerCase());
  const result = await h.waitForValue(() => h.currentUser(this), same, h.budget(this));
  if (!result.ok) throw friendly({ message: `Logging in as "${handle}" (${user.username}) did not work${(await h.loginSays(this)) ? `: the site says "${await h.loginSays(this)}"` : ''}.`, hint: 'Check the account\'s username and password in worldParameters.users of cucumber.js.' });
});

/**
 * Log in through the form with a username and a password that need not be right: the step asserts nothing, a refusal
 * is read by the steps after it.
 *
 * Example #1: When I log in as "member" with the password "not-the-right-password"
 * Example #2: When log in as "nobody" with the password "dD.123123ddd"
 * Example #3: And I log in as "member" with the password "not-the-right-password"
 * Example #4: And log in as "nobody" with the password "dD.123123ddd"
 * Example #5: When we log in as "member" with the password "not-the-right-password"
 */
When(/^(I |we )*log in as "([^"]*)" with the password "([^"]*)"$/, async function (_who, username, password) {
  await h.open(this, '/login');
  await h.dropSession(this);
  await h.submitLogin(this, username, password);
});

/**
 * Start without a session: the browser holds none of the site's.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: And we are not logged in
 * Example #5: When I am not logged in
 */
Given(/^(I am|we are) not logged in$/, async function (_who) {
  if (!this.page.url().startsWith(h.siteRoot(this))) await h.open(this, '/login');
  await h.dropSession(this);
});

/**
 * Log out, the way the site does it (its user menu, then Logout), and wait until the session is gone.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: And we log out
 * Example #5: Then I log out
 */
When(/^(I |we )*log out$/, async function (_who) {
  const me = await h.currentAccount(this);
  if (!me) throw friendly({ message: 'There is no session to log out of.', hint: 'Log in first.' });
  const page = this.page;
  if (!page.url().startsWith(h.siteRoot(this)) || /\/login/.test(page.url())) await h.open(this, '/');
  await page.locator('header button, nav button, .navbar button').filter({ hasText: new RegExp(`^\\s*(${h.escapeRegExp(me.name)}|${h.escapeRegExp(me.username)})\\s*$`) }).first().click({ timeout: h.budget(this) });
  await page.locator('.dropdown-menu, .dropdown-content').locator('button, a').filter({ hasText: /^\s*Logout\s*$/ }).first().click({ timeout: h.budget(this) });
  const gone = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!gone.ok) throw friendly({ message: `Logging out did not end the session of ${gone.value}.`, hint: 'The site logs out from its user menu (the account\'s name), Logout.' });
});

/**
 * The browser's session is an account's: its name as the site shows it, or its username.
 *
 * Example #1: Then I should be logged in as "Member Test"
 * Example #2: Then I should be logged in as "member"
 * Example #3: And I should be logged in as "Member Test"
 * Example #4: But I should be logged in as "member"
 * Example #5: Then we should be logged in as "Member Test"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (_who, who) {
  const wanted = String(who).trim().toLowerCase();
  const result = await h.waitForValue(() => h.currentAccount(this), (me) => !!me && (me.username.toLowerCase() === wanted || me.name.toLowerCase() === wanted), h.budget(this));
  if (!result.ok) {
    const me = result.value;
    throw friendly({ message: `Expected to be logged in as "${who}", but ${me ? `the session is ${me.name} (${me.username})` : 'there is no session'}.`, hint: 'Name the account by its name, as the site shows it, or by its username.' });
  }
});

/**
 * The browser holds no session of the site's.
 *
 * Example #1: Then I should not be logged in
 * Example #2: Then we should not be logged in
 * Example #3: And I should not be logged in
 * Example #4: But we should not be logged in
 * Example #5: Given I should not be logged in
 */
Then(/^(I |we )*should not be logged in$/, async function (_who) {
  const result = await h.waitForValue(() => h.currentUser(this), (u) => u === '', h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected no session, but the session is ${result.value}'s.`, hint: 'Log out first, or start with Given I am not logged in.' });
});

/**
 * The login form stayed, with the site's message: the account was refused.
 *
 * Example #1: Then the login should be refused with "Wrong username or password"
 * Example #2: Then the login should be refused with "Wrong username"
 * Example #3: And the login should be refused with "Wrong username or password"
 * Example #4: But the login should be refused with "Wrong username"
 * Example #5: Given the login should be refused with "Wrong username or password"
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (message) {
  const page = this.page;
  await h.assertPresence(page.locator('#password'), null, { label: 'the login form', hint: 'A refused login stays on the form at /login.', timeout: h.budget(this) });
  const said = page.getByText(new RegExp(h.escapeRegExp(message), 'i'));
  await h.assertPresence(said, null, { label: `the message "${message}"`, hint: 'The site says "Wrong username or password." over the form; "Too Many Requests" when it limits the logins.', timeout: h.budget(this) });
});

/**
 * Open a project by its title: its first view, the task list.
 *
 * Example #1: When I open the project "Webship site"
 * Example #2: When we open the project "Webship site"
 * Example #3: And I open the project "Webship site"
 * Example #4: And we open the project "Webship site"
 * Example #5: Then I open the project "Webship site"
 */
When(/^(I |we )*open the project "([^"]*)"$/, async function (_who, title) {
  const project = await h.findProject(this, title);
  this.vikunja = this.vikunja || {};
  this.vikunja.project = project.title;
  const views = await h.api(this, 'GET', `/projects/${project.id}/views`, undefined, `read the views of ${project.title}`);
  const list = (Array.isArray(views) ? views : []).find((v) => v.view_kind === 'list' || v.view_kind === 0);
  await h.open(this, list ? `/projects/${project.id}/${list.id}` : `/projects/${project.id}`);
});

/**
 * The browser's account is refused a project: the site does not open it for an account it is not shared with.
 *
 * Example #1: Then I should be refused the project "Webship site"
 * Example #2: Then we should be refused the project "Webship site"
 * Example #3: And I should be refused the project "Webship site"
 * Example #4: But we should be refused the project "Webship site"
 * Example #5: Given I should be refused the project "Webship site"
 */
Then(/^(I |we )*should be refused the project "([^"]*)"$/, async function (_who, title) {
  const project = await h.findProject(this, title);
  const token = await h.pageToken(this);
  const [status] = await h.apiWith(this, 'GET', `/projects/${project.id}`, undefined, token);
  if (status === 200) throw friendly({ message: `Expected the project "${title}" to be refused, but the account reads it.`, hint: 'An account the project is shared with may open it; only one it is not shared with is refused.' });
  await h.open(this, `/projects/${project.id}`);
  const shown = await this.page.locator('main').getByText(project.title, { exact: true }).first().isVisible().catch(() => false);
  const tasks = await this.page.locator('main a[href*="/tasks/"]').count().catch(() => 0);
  if (shown && tasks) throw friendly({ message: `Expected the project "${title}" to be refused, but its page shows ${tasks} task(s).`, hint: 'An account the project is not shared with should not see its tasks.' });
});

// A scenario's tasks go after it, as the managing account, so a run leaves the site as it found it.
After(async function () {
  const made = this.vikunja && this.vikunja.made;
  if (!made || !made.size) return;
  for (const id of made) {
    await h.removeTask(this, id).catch((e) => console.warn(`[vikunja-steps] the task ${id} the scenario made could not be removed: ${h.tidy(e && e.message).slice(0, 300)}`));
  }
  made.clear();
});

// The run's API clients end with it.
AfterAll(async function () {
  await h.managerContexts.dispose();
});
