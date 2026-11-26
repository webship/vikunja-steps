'use strict';

// The views of a project beside its list: the board (its Kanban view), its buckets, To-Do, Doing and Done by default,
// the tasks each holds, and a task moved to another bucket from its own page (opened from its card, the page offers the
// board's buckets); and the table (its Table view), a row a task, done or not.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./vikunja-helpers');

/**
 * Open the board of a project: its Kanban view.
 *
 * Example #1: When I open the board of the project "Webship site"
 * Example #2: When we open the board of the project "Webship site"
 * Example #3: And I open the board of the project "Webship site"
 * Example #4: And we open the board of the project "Webship site"
 * Example #5: Then I open the board of the project "Webship site"
 */
When(/^(I |we )*open the board of the project "([^"]*)"$/, async function (_who, title) {
  const project = await h.findProject(this, title);
  const views = await h.api(this, 'GET', `/projects/${project.id}/views`, undefined, `read the views of ${project.title}`);
  const board = (Array.isArray(views) ? views : []).find((v) => v.view_kind === 'kanban' || v.view_kind === 3);
  if (!board) throw friendly({ message: `${project.title} has no board.`, hint: 'A project has a Kanban view unless someone removed it.' });
  this.vikunja = this.vikunja || {};
  this.vikunja.project = project.title;
  this.vikunja.board = { project: project.id, view: String(board.id), url: `/projects/${project.id}/${board.id}` };
  await h.open(this, this.vikunja.board.url);
  await h.assertPresence(this.page.locator('.bucket').first(), null, { label: 'the board\'s buckets', hint: 'The board shows its buckets: To-Do, Doing, Done.', timeout: h.budget(this) });
});

/**
 * A bucket of the open board lists (or does not list) a task of this title.
 *
 * Example #1: Then the bucket "Doing" should list the task "The greeting script says Helo instead of Hello"
 * Example #2: Then the bucket "Doing" should not list the task "The usage line spells greeting as greting"
 * Example #3: And the bucket "To-Do" should list the task "The usage line spells greeting as greting"
 * Example #4: But the bucket "Done" should not list the task "The greeting script says Helo instead of Hello"
 * Example #5: Given the bucket "Doing" should list the task "The greeting script says Helo instead of Hello"
 */
Then(/^the bucket "([^"]*)" should (not )?list the task "([^"]*)"$/, async function (bucket, notCase, title) {
  const column = this.page.locator('.bucket').filter({ has: this.page.locator('.title, h2, .bucket-header').filter({ hasText: h.exactly(bucket) }) }).first();
  await h.assertPresence(column, null, { label: `the bucket "${bucket}"`, hint: 'Open the board first; name a bucket as it shows it (To-Do, Doing, Done).', timeout: h.budget(this) });
  await h.assertPresence(column.locator('.kanban-card, .task').filter({ hasText: title }).first(), notCase, { label: `the task "${title}" in the bucket "${bucket}"`, hint: 'A task is in one bucket of the board at a time.', timeout: h.budget(this) });
});

/**
 * Move a task of the open board to another bucket from its own page: its card opens it, and its page, opened from the
 * board, offers the board's buckets by the bucket's name under its title. The board opens again after the move.
 *
 * Example #1: When I move the task "Webship test bucket" to the bucket "Doing"
 * Example #2: When we move the task "Webship test bucket" to the bucket "To-Do"
 * Example #3: And I move the task "Webship test bucket" to the bucket "Doing"
 * Example #4: And we move the task "Webship test bucket" to the bucket "To-Do"
 * Example #5: Then I move the task "Webship test bucket" to the bucket "Doing"
 */
When(/^(I |we )*move the task "([^"]*)" to the bucket "([^"]*)"$/, async function (_who, title, bucket) {
  const board = this.vikunja && this.vikunja.board;
  if (!board) throw friendly({ message: 'No board is open.', hint: 'Open one first: When I open the board of the project "…".' });
  const page = this.page;
  const task = await h.taskNamed(this, title);
  this.vikunja.task = String(task.id);
  await h.actOrExplain('move the task', title, async () => {
    await page.locator('.bucket .kanban-card, .bucket .task').filter({ hasText: title }).first().click({ timeout: h.budget(this) });
    await page.waitForURL(new RegExp(`/tasks/${task.id}(\\b|/|$)`), { timeout: h.budget(this) });
    await page.locator('.subtitle .bucket-name').first().click({ timeout: h.budget(this) });
    await page.locator('.subtitle .dropdown-item').filter({ hasText: h.exactly(bucket) }).first().click({ timeout: h.budget(this) });
  }, `A task opened from its card on the board offers the board's buckets under its title: "${bucket}" must be one of them, named as the board shows it.`);
  const moved = await h.waitForValue(async () => {
    const buckets = await h.api(this, 'GET', `/projects/${board.project}/views/${board.view}/tasks`, undefined, 'read the board');
    const holder = (Array.isArray(buckets) ? buckets : []).find((b) => (b.tasks || []).some((t) => String(t.id) === String(task.id)));
    return holder ? String(holder.title) : '';
  }, (name) => h.exactly(bucket).test(name), h.budget(this));
  if (!moved.ok) throw friendly({ message: `The task "${title}" was not moved to the bucket "${bucket}"; it is in ${moved.value ? `"${moved.value}"` : 'no bucket'}.`, hint: 'The site moves a task once a bucket is chosen under its title.' });
  await h.open(this, board.url);
  await h.assertPresence(page.locator('.bucket').first(), null, { label: 'the board\'s buckets', hint: 'The board shows its buckets: To-Do, Doing, Done.', timeout: h.budget(this) });
});

/**
 * Open the table of a project: its Table view, which lists its tasks done or not, a row each.
 *
 * Example #1: When I open the table of the project "Webship site"
 * Example #2: When we open the table of the project "Webship site"
 * Example #3: And I open the table of the project "Webship site"
 * Example #4: And we open the table of the project "Webship site"
 * Example #5: Then I open the table of the project "Webship site"
 */
When(/^(I |we )*open the table of the project "([^"]*)"$/, async function (_who, title) {
  const project = await h.findProject(this, title);
  const views = await h.api(this, 'GET', `/projects/${project.id}/views`, undefined, `read the views of ${project.title}`);
  const table = (Array.isArray(views) ? views : []).find((v) => v.view_kind === 'table' || v.view_kind === 2);
  if (!table) throw friendly({ message: `${project.title} has no table.`, hint: 'A project has a Table view unless someone removed it.' });
  this.vikunja = this.vikunja || {};
  this.vikunja.project = project.title;
  await h.open(this, `/projects/${project.id}/${table.id}`);
  await h.assertPresence(this.page.locator('main table'), null, { label: 'the table of the project', hint: 'The Table view lists the tasks in a table: #, Done, Title, Labels, Assignees, Due Date.', timeout: h.budget(this) });
});

/** The row of a task of the open table, by its title. */
function tableRow(world, title) {
  return world.page.locator('main table tbody tr').filter({ has: world.page.locator('td').filter({ hasText: h.exactly(title) }) }).first();
}

/**
 * The open table shows (or does not show) a row of a task of this title.
 *
 * Example #1: Then the table should show the task "The greeting script says Helo instead of Hello"
 * Example #2: Then the table should not show the task "Webship test nothing"
 * Example #3: And the table should show the task "The greeting script says Helo instead of Hello"
 * Example #4: But the table should not show the task "Webship test nothing"
 * Example #5: Given the table should show the task "The usage line spells greeting as greting"
 */
Then(/^the table should (not )?show the task "([^"]*)"$/, async function (notCase, title) {
  await h.assertPresence(tableRow(this, title), notCase, { label: `the task "${title}" in the table`, hint: 'Open the table first: When I open the table of the project "…".', timeout: h.budget(this) });
});

/**
 * The row of a task in the open table shows a text in one of its cells: its key, "Done", a label, a due date.
 *
 * Example #1: Then the table row of the task "The greeting script says Helo instead of Hello" should show "bug"
 * Example #2: Then the table row of the task "The greeting script says Helo instead of Hello" should show "WEB-1"
 * Example #3: And the table row of the task "Webship test done" should show "Done"
 * Example #4: But the table row of the task "The usage line spells greeting as greting" should show "WEB-2"
 * Example #5: Given the table row of the task "The greeting script says Helo instead of Hello" should show "bug"
 */
Then(/^the table row of the task "([^"]*)" should show "([^"]*)"$/, async function (title, text) {
  const row = tableRow(this, title);
  await h.assertPresence(row, null, { label: `the task "${title}" in the table`, hint: 'Open the table first: When I open the table of the project "…".', timeout: h.budget(this) });
  const cell = row.locator('td').filter({ hasText: h.exactly(text) }).first();
  const shown = await cell.waitFor({ state: 'visible', timeout: h.budget(this) }).then(() => true).catch(() => false);
  if (!shown) {
    const cells = (await row.locator('td').allInnerTexts()).map((t) => h.tidy(t)).filter(Boolean);
    throw friendly({ message: `Expected the table row of the task "${title}" to show "${text}", but it shows ${cells.map((c) => `"${c}"`).join(', ') || 'nothing'}.`, hint: 'A row shows the task\'s key, Done when it is done, its title, its labels and its due date; its assignees as pictures.' });
  }
});
