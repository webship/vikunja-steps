@board
Feature: The board of a project
  A project's board holds its tasks in buckets, To-Do, Doing and Done; a task is in one bucket at a time, marking it
  done moves it to Done, and its own page, opened from its card, moves it to another bucket.

  Scenario: The sample tasks in their buckets
    Given I am a logged in user with the "member" user
    When I open the board of the project "Webship site"
    Then the bucket "Doing" should list the task "The greeting script says Helo instead of Hello"
    And the bucket "Doing" should not list the task "The usage line spells greeting as greting"
    And the bucket "To-Do" should list the task "The usage line spells greeting as greting"
    And the bucket "Done" should list the task "The greeting script ends without a newline"

  Scenario: A task marked done goes to the Done bucket
    Given there is a task "Webship test board" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the task "Webship test board"
    And I mark the task done
    And I open the board of the project "Webship site"
    Then the bucket "Done" should list the task "Webship test board"
    And the bucket "To-Do" should not list the task "Webship test board"

  Scenario: A task moved to another bucket from its page
    Given there is a task "Webship test bucket" in the project "Webship site"
    And I am a logged in user with the "member" user
    When I open the board of the project "Webship site"
    And I move the task "Webship test bucket" to the bucket "Doing"
    Then the bucket "Doing" should list the task "Webship test bucket"
    And the bucket "To-Do" should not list the task "Webship test bucket"
