# Architecture

## 1. Purpose and Scope

This architecture is based on the requirements from the product specification.

The system should allow employees to submit internal requests, send them to the right department, follow their status, and handle approvals when needed.

It should also make sure that users only see the information they are allowed to access.

### Actors

* Employee
* Department Employee
* Approver
* Administrator

### System Boundary

The system includes:

* Frontend / User Interface
* Internal API
* Backend
* Request Management
* Approval Management
* Authentication and Authorization
* Notification Component
* Cache
* Database

The users themselves are outside the system.

Since this is an internal company system, the core system does not depend on a third-party service. However, an email notification provider can be used as an external dependency if email notifications are needed.

Week 4 also uses an AI service on the internet as an external dependency. The employee types what they need in their own words. That service suggests a category, or the status of a request they are allowed to see. The backend checks the suggestion before the screen shows it.

Week 5 runs that same system without this laptop. One service serves the page and the API. The AI process runs on that same machine. The laptop database is SQLite. The live database is Postgres, because the free host does not keep a file on disk.

## 2. Structure and Flow

The system is divided into a few main parts.

### Components and Responsibilities

* Frontend / User Interface: where users interact with the system.
* Internal API: allows the frontend to communicate with the backend.
* Backend: handles the main logic of the system.
* Request Management: handles creating, assigning, updating, transferring, and resolving requests.
* Approval Management: handles requests that need approval. The department employee decides that when the request is In Progress.
* Authentication and Authorization: checks who the user is and what they are allowed to do. In this release the person is chosen with Acting as.
* Notification Component: handles in-app notices when a request is updated. Email is optional.
* Cache: keeps frequently used data temporarily so the system does not always need to query the database.
* Database: stores users, requests, statuses, approvals, and request history.
* External Email Service: can be used to send email notifications if needed.

The figure below (drawn using Excalidraw) shows the flow of the components using Excali

![Structure Flow](/figures/diagram_1.png)

### External Dependencies

The main system can work without any external dependency.

The only optional external dependency in this design is the email notification provider.

If the email service is unavailable, requests should still be created, updated, approved, and resolved normally.

Week 4 adds another external dependency: an AI service. The page does not talk to it. The backend does. If that service is down, Suggest stops, but the employee can still submit a request, open one, and change a status by hand.

### Important Data Flow

A normal request would move through the system like this:

1. The user opens the frontend.
2. The frontend sends the request through the internal API.
3. The backend checks the user's identity and permissions.
4. Request Management processes the request.
5. The request is assigned to the correct department.
6. If approval is needed, Approval Management handles it.
7. The request is stored in the database.
8. The backend sends the result back to the frontend.
9. The employee can later check the status of the request.
10. If an important update happens, the Notification Component can notify the user.
11. If email notifications are enabled, the external email service can also be used.

![Data Flow](/figures/diagram_2.png)

For frequently accessed data, the system can first check the cache. If the data is not there, it can get it from the database.

## 3. Trust and Resilience

### Trust and Authorization

The system should make sure that every user only has access to the things they are allowed to see or manage.

- Employees should only see requests related to them.
- Department employees should only see requests related to their department.
- Approvers should only approve requests they are responsible for.
- Administrators can see every request's status, department, and requester, and they manage users, departments, and categories. They do not see the title, the description, the category, or the comments, and they do not change the status.

The system should check the user's permissions before allowing important actions such as viewing, updating, approving, or managing requests.


### Failure Scenarios

- If a request cannot be saved, the user should see a message that the submission failed.
- If the email notification provider is not working, the request should still be processed normally.
- If the AI service is not working, Suggest cannot finish, but the employee can still submit a request and update a status by hand. The live host checks `/live`, which stays up in that case, so the whole service is not restarted. `/health` reports the AI as down until the process is started again.
- If the needed data is not found in the cache, the system should get it from the database.
- If the cache is unavailable, the system should still be able to use the database.
- If a user tries to do something they are not allowed to do, the system should deny the action.
- A notification problem should not stop the main request from being created or updated.


### Scalability and Reliability

- The system should be able to handle multiple users at the same time.
- Frequently used data can be cached to reduce the number of database queries.
- Important request data should be stored in the database so it is not lost.
- Optional services such as email notifications should not affect the main system if they fail.

## 4. Architecture Decisions

### Communication Decisions

- The frontend talks to the backend through an internal API.
- The frontend does not connect directly to the database.
- The backend manages the system before reading or updating data.
- If email notifications are used, the Notification Component can communicate with an Email Notification Provider.


### Major Decisions

- Separate frontend and backend:  
  This makes the system easier to organize because the user interface and the main logic are handled separately.

- Use an internal API:  
  This gives the frontend a clear way to send and receive data from the backend.

- Use authentication and authorization:  
  This makes sure users only see and manage the information they are allowed to access.

- Separate request handling and approval handling:  
  Not every request needs approval, so it makes sense to handle approvals separately.

- Keep notifications separate from the main request process:  
  If there is a problem with notifications, the request should still be created or updated normally.

- Use a database for permanent data:  
  Requests, statuses, approvals, and history need to be saved so they are not lost.

- Use caching when useful:  
  This helps reduce repeated database queries and can make the system faster. The current release does not use a cache. The database is read directly.

- Store the live requests in Postgres:  
  The laptop keeps SQLite for local work. The free live host has no disk that survives a restart, so the released service uses Postgres. A restart does not seed again once users exist, so stored requests stay.

- Keep email notifications optional:
  The main system should still work even if the external email service is unavailable.

- Use an external AI service for suggestions:
  The employee can describe a need in their own words. If that service is unavailable, the rest of the hub still works.