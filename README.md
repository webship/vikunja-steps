<p align="center"><img src="https://raw.githubusercontent.com/webship/vikunja-steps/2.0.x/assets/logo.svg" alt="Vikunja logo" width="160"></p>

# vikunja-steps

[![Test](https://github.com/webship/vikunja-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/vikunja-steps/actions/workflows/test.yml)

Cucumber step definitions for testing Vikunja, the open-source to-do and project management app, with
[webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD browser automation harness built on Playwright and
Cucumber-js. The pack covers what a project's tasks go through:

- **logging in and out**: an account of the users registry by its handle, the login form, a refused login, who the
  session is, logging out;
- **a project**: opened by its title, and refused to an account it is not shared with;
- **the task list** of a project, and **one task** on its own page: done or not, a comment, a label, its assignee, who
  made it, and the trash, each through its own control;
- **a new task** made from the list's own field;
- **the board and the table**: the board's buckets and the tasks each holds, a task moved to another bucket from its
  own page, and the table's rows, a task each, done or not;
- **what an account may not do**: an account the project is shared with read only neither changes a task, nor
  comments on it, nor makes one, and an account it is not shared with is refused the project's tasks.

The steps make and remove their test content through the site's own API, as a managing account (the owner of the
project) with a login of its own, apart from the browser: a task a scenario makes goes after it for good (to the site's
trash, then out of it), so a run leaves the site as it found it.

No step phrase names the platform: a scenario reads `When I mark the task done` and
`Then the bucket "Doing" should list the task "…"`.

CI builds a real Vikunja site with [DDEV](https://ddev.com) on the runner (Vikunja's own image on the project's own
MariaDB, the accounts of the suite made by Vikunja's own command, the sample content), runs the whole suite against it
twice on every push and pull request, checks after each run that the site holds what it held before, its trash
included, then runs the assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## Logging in first

Every feature starts by logging in: an account of the users registry, by its handle.

| Step | What it does |
| --- | --- |
| `Given I am a logged in user with the "member" user` | Logs in as an account of the users registry, by its handle. The first time in a run through the login form, then its session is put back |
| `When I log in with the "member" user` | Fills and submits the login form with the account's username and password, and waits until the session is the account's |
| `When I log in as "member" with the password "wrong"` | Fills and submits the login form with a username and a password as typed, and asserts nothing: for scenarios about the login itself |
| `Given I am not logged in` | The browser forgets its session |
| `When I log out` | Logs out from the user menu (the account's name), Logout, and waits until the session is gone (give the scenario `@js-off`) |
| `Then I should be logged in as "Member Test"` | The session is the account's: its name as the site shows it, or its username |
| `Then I should not be logged in` | The browser holds no session |
| `Then the login should be refused with "Wrong username or password"` | The login form stayed, with that message (give the scenario `@js-off`) |

```gherkin
@js-off
Scenario: An account logs in through the form and out again
  Given I am not logged in
  When I log in with the "member" user
  Then I should be logged in as "Member Test"
  When I log out
  Then I should not be logged in
```

The site keeps a session in the page's storage (a token), with a cookie that renews it: the steps read who the session
is from the site's own API, with that token, and put an account's session back (its token and its cookies) after its
first login.

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, python3, `script` (util-linux, which every Linux
distribution has), Node.js 24 or later with npm, and about 1 GB of free memory for Vikunja and MariaDB. Vikunja runs in
DDEV's containers.

**1. The site.** The pack's own build script (the one CI runs) makes the site in a DDEV project: Vikunja's own image
(`vikunja/vikunja:2.8.0`, `RELEASE` for another release) on MariaDB 11.4, the four accounts of
[Test users](#test-users), and the sample content (see [The test site](#the-test-site)). It takes a minute or two once
the images are pulled (Vikunja's is a download of about 55 MB). Vikunja supports MySQL, MariaDB, PostgreSQL and SQLite;
the test site runs MariaDB, as the Webship Workspace builds Vikunja.

```bash
git clone https://github.com/webship/vikunja-steps.git
SITE_DIR="$PWD/vikunja-site" vikunja-steps/.github/scripts/build-ddev-site.sh
```

The site answers at `https://vikunjasteps.ddev.site`. In the [Webship Workspace](https://github.com/webship/workspace),
its Vikunja plugin builds the same site in a sites folder, on DDEV, and wires this pack into the testing setup of the
site:

```bash
bash core/scripts/plugins.sh --require @webship.co/workspace-vikunja
bash core/scripts/plugins.sh --activate vikunja --with-needs
bash core/scripts/plugins.sh --install vikunja --with-needs
bash dev/cmd-vikunja-project.sh vksite --install --add-users --sample-content
bash dev/cmd-tools-testing.sh vksite --run
```

**2. A test project.**

```bash
mkdir vikunja-tests && cd vikunja-tests
npm init -y
npm install --save-dev webship-js @webship-js/vikunja-steps
npx init-webship-js
```

**3. `cucumber.js`.** Add the pack's step definitions after webship-js's own, and give the world its parameters:

```javascript
require: [
  'node_modules/webship-js/tests/step-definitions/**/*.js',
  'node_modules/@webship-js/vikunja-steps/tests/step-definitions/**/*.js',
],
tags: process.env.CUCUMBER_TAGS || 'not @wip and not @must-fail',
worldParameters: {
  launchUrl: process.env.LAUNCH_URL || 'https://vikunjasteps.ddev.site',
  // The account that makes and removes test content through the site's API: the owner of the projects used.
  manager: process.env.MANAGER || 'owner',
  // The project a step works in when it names none (its title).
  project: process.env.PROJECT || 'Webship site',
  // The site logs in with the username (its e-mail address works too), and shows the name.
  users: {
    owner: { username: process.env.VIKUNJA_OWNER_USER || 'owner', password: process.env.VIKUNJA_OWNER_PASSWORD, name: 'Owner Test' },
    member: { username: process.env.VIKUNJA_MEMBER_USER || 'member', password: process.env.VIKUNJA_MEMBER_PASSWORD, name: 'Member Test' },
    reader: { username: process.env.VIKUNJA_READER_USER || 'reader', password: process.env.VIKUNJA_READER_PASSWORD, name: 'Reader Test' },
    stranger: { username: process.env.VIKUNJA_STRANGER_USER || 'stranger', password: process.env.VIKUNJA_STRANGER_PASSWORD, name: 'Stranger Test' },
  },
  // … webship-js's own parameters (minWaitTime, screenshot, javascript …)
},
```

This repository's own [`cucumber.js`](cucumber.js) is a whole example.

**4. Run.**

```bash
npx cucumber-js                                  # every feature
npx cucumber-js tests/features/tasks.feature     # one feature
CUCUMBER_TAGS=@board npx cucumber-js             # one tag
```

## Steps

### Projects

| Step | What it does |
| --- | --- |
| `When I open the project "Webship site"` | Opens the project, by its title: its list |
| `Then I should be refused the project "Webship site"` | The session reads nothing of it, and its page shows none of its tasks (`@js-off`) |

### Test content

| Step | What it does |
| --- | --- |
| `Given there is a task "Webship test …" in the project "Webship site"` | Makes it through the site's API as the managing account, when it is not there. It goes after the scenario |
| `Given there is no task "Webship test …" in the project "Webship site"` | Removes any of the title, for good |

### The task list

| Step | What it does |
| --- | --- |
| `Then the task list should show "…"` / `should not show "…"` | A task of the title is (not) in the open project's list, which shows the tasks not done |
| `When I create a task "Webship test …" in the project "Webship site"` | Through the list's "Add a task…": its title, then Enter. It goes after the scenario |

### One task

A task opens on its own page (`/tasks/<id>`). The steps read what they changed back from the site's API.

| Step | What it does |
| --- | --- |
| `When I open the task "…"` | Opens it by its title, or by its key ("WEB-1") |
| `When I mark the task done` / `undone` | Through "Mark task done!" / "Mark as undone" |
| `Then the task should be done` / `should not be done` | As the site has it, and the "Done" mark beside its key |
| `When I add the comment "…" to the task` | Through the comment editor and COMMENT |
| `Then the task should show the comment "…"` (`… by "Member Test"`) | It holds the comment, written by that person when one is named, and its page shows it |
| `When I add the label "bug" to the task` | Through "Add labels": a label the account can use (the site's labels belong to the people who make them, and to the tasks that carry them) |
| `Then the task should have the label "bug"` | Its labels now |
| `When I assign the task to "Owner Test"` | Through "Assign to user": someone the project gives access to, by their name or username |
| `Then the task should be assigned to "Owner Test"` | Its assignees now, and its page shows them |
| `Then the task should be created by "Owner Test"` | Who made it, by their name or username, as its page says ("Created … by …") |
| `When I move the task to the trash` | Through "Delete": the site keeps a task in its trash 30 days |
| `Then the task should be in the trash` / `should not be in the trash` | As the site has it; one in the trash shows on the trash page |
| `When I restore the task from the trash` | Through Restore on its row of the trash page |

### What an account may not do

| Step | What it does |
| --- | --- |
| `Then I should not be able to change the task` | Its page offers no "Mark task done!", and its priority is closed (read-only sharing) |
| `Then I should not be able to comment on the task` | Its page offers no COMMENT (read-only sharing) |
| `Then I should not be able to create a task in the project "Webship site"` | The list offers no "Add a task…" (read-only sharing) |
| `Then I should be refused the task "…"` | The session reads nothing of it, and its page is the site's "Not found" (an account the project is not shared with) (`@js-off`) |

### The board and the table

| Step | What it does |
| --- | --- |
| `When I open the board of the project "Webship site"` | The project's Kanban view, with its buckets |
| `Then the bucket "Doing" should list the task "…"` / `should not list` | What a bucket holds |
| `When I move the task "…" to the bucket "Doing"` | Opens the task from its card, chooses the bucket under its title, and opens the board again |
| `When I open the table of the project "Webship site"` | The project's Table view: a row a task, done or not |
| `Then the table should show the task "…"` / `should not show` | A row of the task's title |
| `Then the table row of the task "…" should show "Done"` | A cell of its row: its key, Done, a label, a due date (its assignees show as pictures) |

Every step carries five example phrasings in its JSDoc, and `npm run test:examples` checks that each one matches its
own step only.

## Rules of a suite

- Log in by a handle of the users registry; never write a password into a feature.
- Never create or delete an account in a suite: accounts are configuration, made by the build of the site.
- Change only what the scenario made: done, a comment, a label, an assignee, a bucket and the trash go on a task of
  `Given there is a task "…"`, which goes after the scenario.
- Name test content "Webship test …". A run that was stopped half way leaves its tasks; the Workspace's
  `cmd-tools-vikunja-cli.sh <site> --tidy` deletes them for good (only tasks of that title made by the test accounts in
  the sample project, live or in the trash), or delete them as the managing account.
- The site's own delete of a task moves it to its trash, where it stays 30 days with everything attached to it: the
  pack takes it out of the trash too (the site's API v2), so the counts CI compares are the same after a run.
- A refusal (a wrong password, a project or a task an account may not see) and a logout make the browser log the
  refused requests: give those scenarios `@js-off`.
- The site allows a set number of requests a minute before a login from one address (10 by default,
  `VIKUNJA_RATELIMIT_NOAUTHLIMIT`), its rate limit on or off. A suite logs in more often than a person, so the test
  site allows 100, a setting for a test site only. The pack puts each account's session back after its first login,
  and the managing account logs in once a run.

## Test users

The accounts the features log in as, each with the password `dD.123123ddd`:

| Handle | Username | Name | What Webship site gives them |
| --- | --- | --- | --- |
| `owner` | `owner` | Owner Test | Its owner (the managing account) |
| `member` | `member` | Member Test | Read & write |
| `reader` | `reader` | Reader Test | Read only: reads, and neither changes nor comments |
| `stranger` | `stranger` | Stranger Test | Nothing: the project is not shared with them |

Each logs in with its username or its address (`member@example.com`). Every account is made by Vikunja's own command
(`vikunja user create`), which takes a password from its flag or from a terminal only: the build gives it the password
through a pseudo-terminal (`script`), from a file only its owner reads, which goes right after, never on a command line.
Then the account is made active (`vikunja user change-status --enable`), as the site, its mailer on, would otherwise
wait for the account to confirm its address.

## The test site

`.github/scripts/build-ddev-site.sh` builds it, and `COUNTS_ONLY=1` makes it print what the sample project holds
(tasks, live or in the trash, open ones, comments, assignees, labels on tasks, tasks in buckets, shares, labels, users):
CI compares them before and after each run. The sample content, in the project Webship site (key `WEB`), owned by owner
and shared with member (read & write) and reader (read only):

- "The greeting script says Helo instead of Hello" (WEB-1): by the owner, high, labelled bug, assigned to the member,
  in the board's Doing, with the owner's comment;
- "The usage line spells greeting as greting" (WEB-2): by the member, in To-Do.

The features read the sample content and never change it. The site script (`site/vikunja-site.php`) is the one of the
Webship Workspace's Vikunja plugin: as Vikunja's image has no shell, it runs with PHP in the project's web container,
and reaches Vikunja's API and the project's database from there.

What the open-source edition does not have: Vikunja's admin panel and its time tracking are features of its paid
licence. The pack, like the Webship Workspace, uses the open-source edition only: it has no step for either.

## The assertions that must fail

`tests/must-fail/` holds scenarios that assert something that is not true on the test site; `npm run test:must-fail`
runs them and checks that each fails at its last step with the message its description announces, and a hint. A step
that cannot fail proves nothing.

## Logo

The logo is Vikunja's own mark, as [Simple Icons](https://simpleicons.org) (CC0-1.0) carries it from Vikunja's website
(`public/favicon.svg` of go-vikunja/website), in Vikunja's blue (#196AFF); the name and the mark are Vikunja's. It names
the platform the pack tests.

## License

MIT (see `LICENSE`). Vikunja itself is AGPL-3.0: the pack drives a running site and carries none of its code. Its
repository's browser tests were read for their flows only (a task marked done, the trash, a bucket chosen from a task's
page).
