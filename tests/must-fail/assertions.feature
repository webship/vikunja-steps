@must-fail
Feature: Assertions that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A session that is not the account named
    Fails with: Expected to be logged in as "Owner Test", but the session is Member Test (member).
    Given I am a logged in user with the "member" user
    Then I should be logged in as "Owner Test"

  Scenario: A session that is there
    Fails with: Expected no session, but the session is member's.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: A login that worked is not refused
    Fails with: Expected to see the login form, but it did not appear within
    Given I am not logged in
    When I log in with the "member" user
    Then the login should be refused with "Wrong username or password"

  Scenario: A task the list does not show
    Fails with: Expected to see the task "Webship test nothing" in the list, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the task list should show "Webship test nothing"

  Scenario: A task that is not done
    Fails with: Expected the task to be done, but it is not done.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be done

  Scenario: A comment the task does not have
    Fails with: Expected the task to show the comment "Webship test nothing". Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Webship test nothing"

  Scenario: A comment by another account
    Fails with: Expected the task to show the comment "Seen on the test site" by Member Test. Its comments: "Seen on the test site: the greeting prints Helo." by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Seen on the test site" by "Member Test"

  Scenario: A label the task does not have
    Fails with: Expected the task to have the label "feature", but it has "bug".
    Given I am a logged in user with the "member" user
    When I open the task "WEB-1"
    Then the task should have the label "feature"

  Scenario: An assignee the task does not have
    Fails with: Expected the task to be assigned to "Owner Test", but it is assigned to Member Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be assigned to "Owner Test"

  Scenario: An author the task does not have
    Fails with: Expected the task to be created by "Member", but it was created by Owner Test.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be created by "Member"

  Scenario: Read & write sharing may change a task
    Fails with: Expected the task to be closed to this account, but its page lets it change the task.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to change the task

  Scenario: Read & write sharing may comment on a task
    Fails with: Expected no way to comment on the task, but its page offers COMMENT.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then I should not be able to comment on the task

  Scenario: Read & write sharing may make a task
    Fails with: Expected no way to make a task in Webship site, but its list offers "Add a task…".
    Given I am a logged in user with the "member" user
    Then I should not be able to create a task in the project "Webship site"

  Scenario: An account the project is shared with is not refused it
    Fails with: Expected the project "Webship site" to be refused, but the account reads it.
    Given I am a logged in user with the "member" user
    Then I should be refused the project "Webship site"

  Scenario: An account the project is shared with is not refused its task
    Fails with: to be refused, but the account reads it ("The greeting script says Helo instead of Hello").
    Given I am a logged in user with the "reader" user
    Then I should be refused the task "The greeting script says Helo instead of Hello"

  Scenario: A task the bucket does not list
    Fails with: Expected to see the task "The usage line spells greeting as greting" in the bucket "Doing", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the board of the project "Webship site"
    Then the bucket "Doing" should list the task "The usage line spells greeting as greting"

  Scenario: A task that is not in the trash
    Fails with: Expected the task "The greeting script says Helo instead of Hello" to be in the trash, but it is not in the trash.
    Given I am a logged in user with the "member" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should be in the trash

  Scenario: A bucket the board does not have
    Fails with: Could not move the task "The usage line spells greeting as greting".
    Given I am a logged in user with the "member" user
    When I open the board of the project "Webship site"
    And I move the task "The usage line spells greeting as greting" to the bucket "Webship test nowhere"

  Scenario: A text the table row does not show
    Fails with: Expected the table row of the task "The usage line spells greeting as greting" to show "bug", but it shows "WEB-2", "The usage line spells greeting as greting", "-".
    Given I am a logged in user with the "member" user
    When I open the table of the project "Webship site"
    Then the table row of the task "The usage line spells greeting as greting" should show "bug"
