'use strict';

// The tasks of a project: test content made and removed through the site's API, the task list, a new task, and one
// task on its own page (/tasks/<id>): done or not, a comment, a label, its assignee, who made it; and what an account
// with read-only sharing, or none, may not do. What a step changed is read back from the site's API.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./vikunja-helpers');

/**
 * A task of this title in the project (the default one when none is named), made through the site's API as the
 * managing account when it is not there. It goes after the scenario.
 *
 * Example #1: Given there is a task "Webship test work" in the project "Webship site"
 * Example #2: Given there is a task "Webship test work"
 * Example #3: And there is a task "Webship test work" in the project "Webship site"
 * Example #4: And there is a task "Webship test work"
 * Example #5: When there is a task "Webship test work" in the project "Webship site"
 */
Given(/^there is a task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  const there = await h.findTasks(this, project, title);
  if (there.length) { for (const t of there) h.remember(this, t.id); return; }
  await h.makeTask(this, project, title);
});

/**
 * No task of this title in the project: any there is removed, as the managing account.
 *
 * Example #1: Given there is no task "Webship test new" in the project "Webship site"
 * Example #2: Given there is no task "Webship test new"
 * Example #3: And there is no task "Webship test new" in the project "Webship site"
 * Example #4: And there is no task "Webship test new"
 * Example #5: When there is no task "Webship test new" in the project "Webship site"
 */
Given(/^there is no task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (title, projectName) {
  const project = await h.findProject(this, projectName);
  for (const t of await h.findTasks(this, project, title)) await h.removeTask(this, t.id);
});

/**
 * The open project's task list shows (or does not show) a task of this title.
 *
 * Example #1: Then the task list should show "The greeting script says Helo instead of Hello"
 * Example #2: Then the task list should not show "Webship test nothing"
 * Example #3: And the task list should show "The greeting script says Helo instead of Hello"
 * Example #4: But the task list should not show "Webship test nothing"
 * Example #5: Given the task list should show "The greeting script says Helo instead of Hello"
 */
Then(/^the task list should (not )?show "([^"]*)"$/, async function (notCase, title) {
  const row = this.page.locator('main a[href*="/tasks/"]').filter({ hasText: h.exactly(title) }).first();
  await h.assertPresence(row, notCase, { label: `the task "${title}" in the list`, hint: 'The list shows the tasks of the open project that are not done; open the project first.', timeout: h.budget(this) });
});

/**
 * Make a task through the list's own field ("Add a task…"), then Enter. It goes after the scenario.
 *
 * Example #1: When I create a task "Webship test new" in the project "Webship site"
 * Example #2: When we create a task "Webship test new"
 * Example #3: And I create a task "Webship test new" in the project "Webship site"
 * Example #4: And we create a task "Webship test new"
 * Example #5: When we create a task "Webship test new" in the project "Webship site"
 */
When(/^(I |we )*create a task "([^"]*)"(?: in the project "([^"]*)")?$/, async function (_who, title, projectName) {
  const project = await h.findProject(this, projectName);
  const views = await h.api(this, 'GET', `/projects/${project.id}/views`, undefined, `read the views of ${project.title}`);
  const list = (Array.isArray(views) ? views : []).find((v) => v.view_kind === 'list' || v.view_kind === 0);
  await h.open(this, list ? `/projects/${project.id}/${list.id}` : `/projects/${project.id}`);
  const field = this.page.locator('textarea.add-task-textarea').first();
  await h.actOrExplain('make a task', title, async () => {
    await field.waitFor({ state: 'visible', timeout: h.budget(this) });
    await field.fill(title);
    await field.press('Enter');
  }, 'The list offers "Add a task…" to an account that may change the project.');
  const made = await h.waitForValue(() => h.findTasks(this, project, title), (l) => l.length > 0, h.budget(this));
  if (!made.ok) throw friendly({ message: `The task "${title}" was not made in ${project.title}.`, hint: 'The list makes a task when its title is entered in "Add a task…".' });
  for (const t of made.value) h.remember(this, t.id);
});

/**
 * Open a task of the project by its title (or its key, as "WEB-1"), on its own page.
 *
 * Example #1: When I open the task "The greeting script says Helo instead of Hello"
 * Example #2: When we open the task "WEB-1"
 * Example #3: And I open the task "The greeting script says Helo instead of Hello"
 * Example #4: And we open the task "WEB-1"
 * Example #5: When we open the task "The greeting script says Helo instead of Hello"
 */
When(/^(I |we )*open the task "([^"]*)"$/, async function (_who, which) {
  await h.openTask(this, await h.taskNamed(this, which));
});

/**
 * Mark the open task done ("Mark task done!"), or not done again ("Mark as undone").
 *
 * Example #1: When I mark the task done
 * Example #2: When we mark the task undone
 * Example #3: And I mark the task done
 * Example #4: And we mark the task undone
 * Example #5: When we mark the task done
 */
When(/^(I |we )*mark the task (done|undone)$/, async function (_who, how) {
  const words = how === 'done' ? 'Mark task done!' : 'Mark as undone';
  await h.actOrExplain(`mark the task ${how} with`, words, async () => {
    await h.taskButton(this, words).click({ timeout: h.budget(this) });
  }, `The task's page offers "${words}" to an account that may change it.`);
  const done = how === 'done';
  const result = await h.waitForValue(() => h.taskNow(this), (t) => !!t.done === done, h.budget(this));
  if (!result.ok) throw friendly({ message: `The task was not marked ${how}.`, hint: 'The site marks a task done with "Mark task done!" and moves it to the board\'s Done bucket.' });
});

/**
 * The open task is done (or not), as the site has it, and its page shows it ("Done").
 *
 * Example #1: Then the task should be done
 * Example #2: Then the task should not be done
 * Example #3: And the task should be done
 * Example #4: But the task should not be done
 * Example #5: Given the task should be done
 */
Then(/^the task should (not )?be done$/, async function (notCase) {
  const want = !notCase;
  const result = await h.waitForValue(() => h.taskNow(this), (t) => !!t.done === want, h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task ${want ? 'to be done' : 'not to be done'}, but it is ${result.value && result.value.done ? 'done' : 'not done'}.`, hint: 'A task is done once "Mark task done!" was clicked, or once it was moved to the board\'s Done bucket.' });
  await h.assertPresence(this.page.locator('main .is-done').filter({ hasText: /^\s*Done\s*$/ }).first(), want ? null : 'not ', { label: 'the Done mark of the task', hint: 'The task\'s page shows "Done" beside its key once it is done.', timeout: h.budget(this) });
});

/**
 * Comment on the open task through its editor and COMMENT, and wait until the task holds the comment.
 *
 * Example #1: When I add the comment "Checked on the test site" to the task
 * Example #2: When we add the comment "Looked into it" to the task
 * Example #3: And I add the comment "Checked on the test site" to the task
 * Example #4: And we add the comment "Looked into it" to the task
 * Example #5: When we add the comment "Checked on the test site" to the task
 */
When(/^(I |we )*add the comment "([^"]*)" to the task$/, async function (_who, text) {
  const page = this.page;
  const editor = page.locator('.media.comment .tiptap.ProseMirror').last();
  await h.actOrExplain('comment on the task with', text, async () => {
    await editor.waitFor({ state: 'visible', timeout: h.budget(this) });
    await editor.click();
    await editor.fill(text);
    await page.locator('main button').filter({ hasText: /^\s*Comment\s*$/i }).first().click({ timeout: h.budget(this) });
  }, 'The task\'s page offers a comment editor and COMMENT to an account that may change it.');
  const id = this.vikunja.task;
  const said = await h.waitForValue(() => h.api(this, 'GET', `/tasks/${id}/comments`, undefined, 'read the comments'), (list) => (list || []).some((c) => String(c.comment || '').includes(text)), h.budget(this));
  if (!said.ok) throw friendly({ message: `The comment "${text}" was not added to the task.`, hint: 'The site adds a comment once COMMENT is clicked.' });
});

/**
 * The open task holds a comment with this text, written by that person when one is named, and its page shows it.
 *
 * Example #1: Then the task should show the comment "Checked on the test site"
 * Example #2: Then the task should show the comment "Checked on the test site" by "Member Test"
 * Example #3: And the task should show the comment "Seen on the test site"
 * Example #4: But the task should show the comment "Seen on the test site" by "Owner Test"
 * Example #5: Given the task should show the comment "Checked on the test site"
 */
Then(/^the task should show the comment "([^"]*)"(?: by "([^"]*)")?$/, async function (text, by) {
  const id = this.vikunja && this.vikunja.task;
  const list = await h.api(this, 'GET', `/tasks/${id}/comments`, undefined, 'read the comments');
  const named = (c) => [c.author && c.author.name, c.author && c.author.username].filter(Boolean).map(String);
  const found = (list || []).find((c) => String(c.comment || '').includes(text) && (!by || named(c).some((n) => h.exactly(by).test(n))));
  if (!found) {
    const all = (list || []).map((c) => `"${h.tidy(String(c.comment || '').replace(/<[^>]+>/g, ' '))}" by ${named(c)[0] || 'someone'}`).join('; ') || 'none';
    throw friendly({ message: `Expected the task to show the comment "${text}"${by ? ` by ${by}` : ''}. Its comments: ${all}.`, hint: 'A comment is read with its author\'s name or username.' });
  }
  await h.assertPresence(this.page.locator('main .comment').filter({ hasText: text }).first(), null, { label: `the comment "${text}" on the task's page`, hint: 'The task\'s page lists its comments under Comments.', timeout: h.budget(this) });
});

/**
 * Add a label to the open task by its title, through "Add labels": a label the account can use.
 *
 * Example #1: When I add the label "bug" to the task
 * Example #2: When we add the label "bug" to the task
 * Example #3: And I add the label "bug" to the task
 * Example #4: And we add the label "bug" to the task
 * Example #5: When we add the label "bug" to the task
 */
When(/^(I |we )*add the label "([^"]*)" to the task$/, async function (_who, label) {
  const page = this.page;
  await h.actOrExplain('label the task', label, async () => {
    await h.taskButton(this, 'Add labels').click({ timeout: h.budget(this) });
    const field = page.locator('main .labels input, main input[placeholder*="label" i]').first();
    await field.waitFor({ state: 'visible', timeout: h.budget(this) });
    await field.pressSequentially(label);
    // A result is the label's tag and a hint ("Click or press enter to select"); a label that is not there is offered to be made, which this step never does.
    await page.locator('.search-results button').filter({ has: page.locator('.search-result', { hasText: h.exactly(label) }) }).first().click({ timeout: h.budget(this) });
  }, 'The task\'s page offers "Add labels" to an account that may change it; the label must be one the account can use.');
  const result = await h.waitForValue(() => h.taskNow(this), (t) => (t.labels || []).some((l) => h.exactly(label).test(String(l.title))), h.budget(this));
  if (!result.ok) throw friendly({ message: `The label "${label}" was not added to the task.`, hint: 'Vikunja\'s labels belong to the people who make them: the account must be able to use it.' });
});

/**
 * The open task has this label, as the site has it now.
 *
 * Example #1: Then the task should have the label "bug"
 * Example #2: Then the task should have the label "bug"
 * Example #3: And the task should have the label "bug"
 * Example #4: But the task should have the label "bug"
 * Example #5: Given the task should have the label "bug"
 */
Then(/^the task should have the label "([^"]*)"$/, async function (label) {
  const t = await h.taskNow(this);
  const titles = (t.labels || []).map((l) => String(l.title));
  if (!titles.some((x) => h.exactly(label).test(x))) throw friendly({ message: `Expected the task to have the label "${label}", but it has ${titles.length ? titles.map((x) => `"${x}"`).join(', ') : 'none'}.`, hint: 'A label is added with "Add labels".' });
});

/**
 * Assign the open task to someone the project is shared with (read & write or more), through "Assign to user".
 *
 * Example #1: When I assign the task to "Owner Test"
 * Example #2: When we assign the task to "member"
 * Example #3: And I assign the task to "Owner Test"
 * Example #4: And we assign the task to "member"
 * Example #5: When we assign the task to "Owner Test"
 */
When(/^(I |we )*assign the task to "([^"]*)"$/, async function (_who, name) {
  const page = this.page;
  const task = await h.taskNow(this);
  // The person, among the people the project gives access to, by their name or their username.
  const people = await h.api(this, 'GET', `/projects/${task.project_id}/projectusers?s=${encodeURIComponent(name.split(/\s+/)[0])}`, undefined, 'read the people of the project');
  const person = (Array.isArray(people) ? people : []).find((u) => [u.name, u.username].some((n) => h.exactly(name).test(String(n || ''))));
  if (!person) throw friendly({ message: `"${name}" is not among the people the project gives access to.`, hint: 'An assignee is someone the project is shared with, or its owner, named by their name or their username.' });
  const shown = String(person.name || person.username);
  await h.actOrExplain('assign the task to', name, async () => {
    await h.taskButton(this, 'Assign to user').click({ timeout: h.budget(this) });
    const field = page.locator('input[placeholder="Type to assign a user…"]').first();
    await field.waitFor({ state: 'visible', timeout: h.budget(this) });
    await field.pressSequentially(String(person.username));
    // A result is the person's name (their username when they have none) and a hint ("Assign this user").
    await page.locator('.search-results button').filter({ has: page.locator('.username', { hasText: h.exactly(shown) }) }).first().click({ timeout: h.budget(this) });
  }, 'The task\'s page offers "Assign to user" to an account that may change it.');
  const result = await h.waitForValue(() => h.taskNow(this), (t) => (t.assignees || []).some((a) => String(a.username) === String(person.username)), h.budget(this));
  if (!result.ok) throw friendly({ message: `The task was not assigned to "${name}".`, hint: 'An assignee is someone the project is shared with read & write or admin, or its owner.' });
});

/**
 * The open task is assigned to this person (their name or username), and its page shows them.
 *
 * Example #1: Then the task should be assigned to "Owner Test"
 * Example #2: Then the task should be assigned to "member"
 * Example #3: And the task should be assigned to "Owner Test"
 * Example #4: But the task should be assigned to "member"
 * Example #5: Given the task should be assigned to "Member Test"
 */
Then(/^the task should be assigned to "([^"]*)"$/, async function (name) {
  const t = await h.taskNow(this);
  const people = (t.assignees || []).map((a) => [a.name, a.username].filter(Boolean).map(String));
  const hit = people.find((names) => names.some((n) => h.exactly(name).test(n)));
  if (!hit) throw friendly({ message: `Expected the task to be assigned to "${name}", but it is assigned to ${people.length ? people.map((n) => n[0]).join(', ') : 'nobody'}.`, hint: 'Name the person by their name or their username.' });
  await h.assertPresence(this.page.locator(`main [aria-label="Remove ${hit[0]} as assignee"], main [title="Remove ${hit[0]} as assignee"]`).first(), null, { label: `${name} among the task's assignees`, hint: 'The task\'s page shows each assignee as an avatar.', timeout: h.budget(this) });
});

/**
 * The open task was made by this person, as its page says ("Created … by …").
 *
 * Example #1: Then the task should be created by "Owner Test"
 * Example #2: Then the task should be created by "owner"
 * Example #3: And the task should be created by "Owner Test"
 * Example #4: But the task should be created by "owner"
 * Example #5: Given the task should be created by "Member Test"
 */
Then(/^the task should be created by "([^"]*)"$/, async function (name) {
  const t = await h.taskNow(this);
  const names = [t.created_by && t.created_by.name, t.created_by && t.created_by.username].filter(Boolean).map(String);
  if (!names.some((n) => h.exactly(name).test(n))) throw friendly({ message: `Expected the task to be created by "${name}", but it was created by ${names[0] || 'nobody'}.`, hint: 'Name the person by their name or their username.' });
  const shown = names[0];
  await h.assertPresence(this.page.locator('main').getByText(new RegExp(`Created\\b.*\\bby\\s+${h.words(shown)}\\s*$`)).first(), null, { label: `"Created … by ${shown}" on the task's page`, hint: 'The task\'s page says who made it at its foot.', timeout: h.budget(this) });
});

/**
 * Move the open task to the site's trash from its page ("Delete"). The site keeps a task there 30 days; a task the
 * scenario made goes after it for good.
 *
 * Example #1: When I move the task to the trash
 * Example #2: When we move the task to the trash
 * Example #3: And I move the task to the trash
 * Example #4: And we move the task to the trash
 * Example #5: Then I move the task to the trash
 */
When(/^(I |we )*move the task to the trash$/, async function (_who) {
  const id = this.vikunja && this.vikunja.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  await h.actOrExplain('move to the trash the task', this.vikunja.title, async () => {
    await h.taskButton(this, 'Delete').click({ timeout: h.budget(this) });
  }, 'The task\'s page offers "Delete" to an account that may change it.');
  const result = await h.waitForValue(() => h.trashState(this, id), (state) => state === 'trash', h.budget(this));
  if (!result.ok) throw friendly({ message: `The task "${this.vikunja.title}" was not moved to the trash; it is ${result.value}.`, hint: 'The site moves a task to its trash once "Delete" on its page is clicked.' });
});

/**
 * The open task is in the site's trash (or not), as the site has it now; one that is shows on the trash page.
 *
 * Example #1: Then the task should be in the trash
 * Example #2: Then the task should not be in the trash
 * Example #3: And the task should be in the trash
 * Example #4: But the task should not be in the trash
 * Example #5: Given the task should be in the trash
 */
Then(/^the task should (not )?be in the trash$/, async function (notCase) {
  const id = this.vikunja && this.vikunja.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  const want = notCase ? 'live' : 'trash';
  const result = await h.waitForValue(() => h.trashState(this, id), (state) => state === want, h.budget(this));
  if (!result.ok) throw friendly({ message: `Expected the task "${this.vikunja.title}" ${notCase ? 'not to be in the trash' : 'to be in the trash'}, but it is ${result.value === 'trash' ? 'in the trash' : result.value === 'live' ? 'not in the trash' : 'gone'}.`, hint: 'A task goes to the trash with "Delete" on its page, and back with Restore on the trash page.' });
  if (!notCase) {
    await h.open(this, '/trash/tasks');
    // A row of the trash page reads the task's project, then its title.
    await h.assertPresence(this.page.locator('main').getByText(new RegExp(`(^|\\s)${h.words(this.vikunja.title)}\\s*$`)).first(), null, { label: `the task "${this.vikunja.title}" on the trash page`, hint: 'The trash page lists the trashed tasks of the projects the account may change.', timeout: h.budget(this) });
  }
});

/**
 * Restore the open task from the site's trash: its row of the trash page, Restore.
 *
 * Example #1: When I restore the task from the trash
 * Example #2: When we restore the task from the trash
 * Example #3: And I restore the task from the trash
 * Example #4: And we restore the task from the trash
 * Example #5: Then I restore the task from the trash
 */
When(/^(I |we )*restore the task from the trash$/, async function (_who) {
  const id = this.vikunja && this.vikunja.task;
  if (!id) throw friendly({ message: 'No task is open.', hint: 'Open one first: When I open the task "…".' });
  await h.open(this, '/trash/tasks');
  await h.actOrExplain('restore the task', this.vikunja.title, async () => {
    // A row of the trash page: the task's project, its title, who moved it there and when, and Restore.
    const restore = this.page.getByRole('button', { name: 'Restore', exact: true });
    const row = this.page.locator('main div').filter({ hasText: this.vikunja.title }).filter({ has: restore }).last();
    await row.getByRole('button', { name: 'Restore', exact: true }).click({ timeout: h.budget(this) });
  }, 'The trash page lists a trashed task with Restore for an account that may change its project.');
  const result = await h.waitForValue(() => h.trashState(this, id), (state) => state === 'live', h.budget(this));
  if (!result.ok) throw friendly({ message: `The task "${this.vikunja.title}" was not restored; it is ${result.value === 'trash' ? 'in the trash' : result.value}.`, hint: 'The site restores a task with Restore on its row of the trash page.' });
});

/**
 * The browser's account may not change the open task: its page offers no "Mark task done!" and its priority is closed.
 *
 * Example #1: Then I should not be able to change the task
 * Example #2: Then we should not be able to change the task
 * Example #3: And I should not be able to change the task
 * Example #4: But we should not be able to change the task
 * Example #5: Given I should not be able to change the task
 */
Then(/^(I |we )*should not be able to change the task$/, async function (_who) {
  const page = this.page;
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const markDone = await h.taskButton(this, 'Mark task done!').isVisible().catch(() => false);
  const selects = await page.locator('main select').count();
  const priority = selects ? await page.locator('main select').first().isDisabled().catch(() => true) : true;
  if (markDone || !priority) throw friendly({ message: 'Expected the task to be closed to this account, but its page lets it change the task.', hint: 'An account the project is shared with read only gets the task without its buttons, its priority closed.' });
});

/**
 * The browser's account may not comment on the open task: its page offers no COMMENT.
 *
 * Example #1: Then I should not be able to comment on the task
 * Example #2: Then we should not be able to comment on the task
 * Example #3: And I should not be able to comment on the task
 * Example #4: But we should not be able to comment on the task
 * Example #5: Given I should not be able to comment on the task
 */
Then(/^(I |we )*should not be able to comment on the task$/, async function (_who) {
  await this.page.locator('main h1').first().waitFor({ state: 'visible', timeout: h.budget(this) });
  const offered = await this.page.locator('main button').filter({ hasText: /^\s*Comment\s*$/i }).first().isVisible().catch(() => false);
  if (offered) throw friendly({ message: 'Expected no way to comment on the task, but its page offers COMMENT.', hint: 'An account the project is shared with read only reads a task\'s comments and adds none.' });
});

/**
 * The browser's account may not make a task in the project: its list offers no "Add a task…".
 *
 * Example #1: Then I should not be able to create a task in the project "Webship site"
 * Example #2: Then we should not be able to create a task in the project "Webship site"
 * Example #3: And I should not be able to create a task in the project "Webship site"
 * Example #4: But we should not be able to create a task in the project "Webship site"
 * Example #5: Given I should not be able to create a task in the project "Webship site"
 */
Then(/^(I |we )*should not be able to create a task in the project "([^"]*)"$/, async function (_who, title) {
  const project = await h.findProject(this, title);
  await h.open(this, `/projects/${project.id}`);
  await this.page.locator('main a[href*="/tasks/"], main .task').first().waitFor({ state: 'visible', timeout: h.budget(this) }).catch(() => {});
  const offered = await this.page.locator('textarea.add-task-textarea').count();
  if (offered) throw friendly({ message: `Expected no way to make a task in ${project.title}, but its list offers "Add a task…".`, hint: 'An account the project is shared with read & write makes tasks; read only does not.' });
});

/**
 * The browser's account is refused a task: the site reads it nothing of it, and shows its "Not found" page.
 *
 * Example #1: Then I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #2: Then we should be refused the task "WEB-1"
 * Example #3: And I should be refused the task "The greeting script says Helo instead of Hello"
 * Example #4: But we should be refused the task "WEB-1"
 * Example #5: Then we should be refused the task "The greeting script says Helo instead of Hello"
 */
Then(/^(I |we )*should be refused the task "([^"]*)"$/, async function (_who, which) {
  const task = await h.taskNamed(this, which);
  const [status, t] = await h.apiWith(this, 'GET', `/tasks/${task.id}`, undefined, await h.pageToken(this));
  if (status === 200 && t) throw friendly({ message: `Expected the task ${task.identifier || task.id} to be refused, but the account reads it ("${t.title}").`, hint: 'An account the project is not shared with is refused its tasks.' });
  await h.open(this, `/tasks/${task.id}`);
  await h.assertPresence(this.page.getByText('Not found', { exact: true }).first(), null, { label: 'the site\'s "Not found" page', hint: 'The site shows "Not found" for a task the account may not see.', timeout: h.budget(this) });
});
