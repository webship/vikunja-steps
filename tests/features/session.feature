@session
Feature: Logging in and out
  An account logs in with its username (or its e-mail address) and its password, and out again; a wrong password is
  refused, and an account a project is not shared with is refused the project.

  @js-off
  Scenario: An account logs in through the form and out again
    Given I am not logged in
    When I log in with the "member" user
    Then I should be logged in as "Member Test"
    When I log out
    Then I should not be logged in

  @js-off
  Scenario: A wrong password is refused
    When I log in as "member" with the password "not-the-right-password"
    Then the login should be refused with "Wrong username or password"
    And I should not be logged in

  Scenario: The session of an account, by its name and its username
    Given I am a logged in user with the "owner" user
    Then I should be logged in as "Owner Test"
    And I should be logged in as "owner"

  @js-off
  Scenario: An account the project is not shared with is refused it, and logs out
    Given I am a logged in user with the "stranger" user
    Then I should be refused the project "Webship site"
    When I log out
    Then I should not be logged in
