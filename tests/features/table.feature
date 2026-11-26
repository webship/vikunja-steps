@table
Feature: The table of a project
  A project's table lists its tasks, done or not, a row each: its key, Done, its title, its labels, its assignees and
  its due date.

  Scenario: The sample tasks in the table, with their keys and labels
    Given I am a logged in user with the "member" user
    When I open the table of the project "Webship site"
    Then the table should show the task "The greeting script says Helo instead of Hello"
    And the table row of the task "The greeting script says Helo instead of Hello" should show "WEB-1"
    And the table row of the task "The greeting script says Helo instead of Hello" should show "bug"
    And the table should not show the task "Webship test nothing"

  Scenario: A task done stays in the table, marked Done
    Given there is a task "Webship test table" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test table"
    And I mark the task done
    And I open the table of the project "Webship site"
    Then the table row of the task "Webship test table" should show "Done"
