# Internal Operations Service Hub 
# Product Specification
A company-internal system for requesting and tracking help from departments such as IT, HR , and Finance.



## 1. Problem / Context

Employees request help from departments like IT, HR, or Finance, usually through email, phone calls, or chat.

This can make things messy and confusing because a request might be forgotten, sent to the wrong person, or take too much time to follow up. Employees may also not know who is handling their request or what its current status is.

The idea of this system is to have one place where employees can submit their requests and follow their progress until the issue is solved.


## 2. Known Facts

- Employees need help from different departments such as IT, HR, and Finance.
- Requests are currently made through different ways like email, chat, phone calls, or direct messages.
- Employees should be able to submit a request in one system.
- Each request should have a clear status.
- The responsible department should be able to manage and update the request.
- Some requests may need approval before they are completed.
- Employees should track the progress of their requests.

## 3. Actors and Stakeholders

### Actors
- Employee (submits and track requests)
- Department Employee (handles the requests)
- Approver (approve or reject a request)
- Administrator (manages the system)

### Stakeholders
- the actors listed above
- Department Managers
- Company Management

## 4. Functional Requirements

- Employees can submit a new request.
- Employees can choose the category of the request.
- Employees can view the requests they submitted.
- Employees can check the status of their requests.
- Requests can be assigned to the responsible department.
- Department employees can view requests assigned to them.
- Department employees can update the request status.
- Department employees can add comments or updates to a request.
- Some requests can require approval.
- Approvers can approve or reject requests.
- Administrators can manage users, departments, and request categories.
- The system keeps a history of important changes made to a request.
- An employee can describe a need in their own words and get a suggestion. The suggestion is saved only when the employee submits it.
- The department that receives the request is the department of the chosen category. A department employee can transfer it to another department while it is Submitted, Assigned, or In Progress.
- Any department employee of that department can update the request. It is not assigned to one person.
- The department employee decides whether an in-progress request needs approval.
- A closed request cannot be reopened.
- Users get an in-app notice when a request they are involved in changes.
- An employee can ask for status updates by email. If email is unavailable, the status change is still saved.
- An administrator can see request status across the system without seeing the request text.


## 5. Non-Functional Requirements

- The system should be easy to use.
- The system should respond within a reasonable amount of time.
- User data and requests should be secure.
- Users should only access information allowed for their role.
- The system should be reliable and not lose submitted requests.
- The system should be able to handle multiple users at the same time.


## 6. Assumptions

- All users are employees of the company.
- Each user has an account to access the system. In this release, the person picks that account with Acting as. There is no separate password.
- Some requests may need approval while others may not.


## 7. Constraints

- The system is only for internal company use.
- Only employees of the company can use it.
- Week 4 also uses an AI service on the internet as an external dependency. The employee can describe what they need in their own words, and the service suggests a category or a status. The request is saved only when the employee submits it.
- The live release runs without this laptop. Requests there are stored in Postgres. Local work stays on SQLite.




## 8. Unknowns

- Can employees attach files to a request?
- Should there be a deadline or expected response time for requests?


## 9. Non-Goals

The system is not trying to solve:

- External customer support.
- Full HR management.
- Full financial management.
- Employee performance evaluation.
- Project management.





## 10. Acceptance Criteria

- An employee can submit a new request successfully.
- The request can be assigned to the correct department.
- The employee can see the current status of the request.
- A department employee can update the status of the request.
- An approver can approve or reject a request when needed.
- Important changes made to the request can be tracked.
- A request can be marked as resolved when the work is finished.