@tasks
Feature: The tasks of a project
  An account the project is shared with read & write reads its list, opens a task, marks it done and not done again,
  comments on it, labels it and assigns it, moves it to the trash and restores it, and makes a new task from the list.
  Every task a scenario makes goes after it, for good.

  Scenario: The list shows the project's open tasks
    Given I am a logged in user with the "member" user
    When I open the project "Webship site"
    Then the task list should show "The greeting script says Helo instead of Hello"
    And the task list should not show "Webship test nothing"

  Scenario: A sample task by its key: its author, its assignee, its label and its comment
    Given I am a logged in user with the "member" user
    When I open the task "WEB-1"
    Then the task should be created by "Owner Test"
    And the task should be assigned to "Member Test"
    And the task should have the label "bug"
    And the task should show the comment "Seen on the test site" by "Owner Test"
    And the task should not be done

  Scenario: A task marked done, and not done again
    Given there is a task "Webship test done" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test done"
    And I mark the task done
    Then the task should be done
    When I mark the task undone
    Then the task should not be done

  Scenario: A comment, a label and an assignee on a task
    Given there is a task "Webship test work" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test work"
    And I add the comment "Checked on the test site" to the task
    Then the task should show the comment "Checked on the test site" by "Member Test"
    When I add the label "bug" to the task
    Then the task should have the label "bug"
    When I assign the task to "Owner Test"
    Then the task should be assigned to "Owner Test"

  Scenario: A new task from the list
    Given there is no task "Webship test new" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I create a task "Webship test new" in the project "Webship site"
    Then the task list should show "Webship test new"

  Scenario: A task moved to the trash, and restored
    Given there is a task "Webship test trash" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test trash"
    And I move the task to the trash
    Then the task should be in the trash
    When I restore the task from the trash
    Then the task should not be in the trash
