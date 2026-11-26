@roles
Feature: What read-only sharing, or none, may not do
  An account the project is shared with read only reads its tasks and their comments, and neither changes a task, nor
  comments on it, nor makes one; an account the project is not shared with is refused its tasks.

  Scenario: Read-only sharing reads a task, and neither changes nor comments on it
    Given I am a logged in user with the "reader" user
    When I open the task "The greeting script says Helo instead of Hello"
    Then the task should show the comment "Seen on the test site" by "Owner Test"
    And I should not be able to change the task
    And I should not be able to comment on the task
    And I should not be able to create a task in the project "Webship site"

  @js-off
  Scenario: An account the project is not shared with is refused its tasks
    Given I am a logged in user with the "stranger" user
    Then I should be refused the task "The greeting script says Helo instead of Hello"
