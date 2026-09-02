# Data Model

## 1. Domain

### Important Entities

- User
- Department
- Request
- Request Category
- Approval
- Request History

### Relationships

- A user submits requests.
- A department handles requests.
- A request belongs to a category.
- A request can have approval records.
- A request can have history records.

### Cardinality


- One department can have many users, and each user belongs to one department.
- One user can submit many requests, and each request has one requester.
- One department can handle many requests, and each request is assigned to one department.
- One category can have many requests, and each request belongs to one category.
- One request can have zero or more approval records, and each approval belongs to one request.
- One user can give many approvals, and each approval is made by one user.
- One request can have many history records, and each history record belongs to one request.

The figure below, drawn using Excalidraw, explains the relationships and cardinality between the entities with the attributes of each entity.

![Entity Relationship](/figures/Entity_Relationship.png)

### Ownership

- The employee owns the request they submitted.
- The responsible department handles the request.
- The approver is responsible for the approval decision.
- The system keeps the request data and its history.

## 2. Lifecycle and Rules

### States

A request can move through different states depending on its progress:

- Submitted
- Assigned
- In Progress
- Waiting for Approval
- Approved
- Rejected
- Resolved
- Closed

### State Transitions
The figure below illustrates the transition between the states of the request including if approval is needed or no.

![State Transitions](/figures/State_Transition.png)

### Invariants
A request should:

- Always have a requester
- Belong to a category
- Be assigned to a responsible department
- Only have one current status at a time
- Important changes to the request should be kept in the request history.

### Sensitive and Authorization Rules

- Employees should only see requests related to them.
- Same for Department employees, they should only see and manage requests related to their department.
- Approvers should only approve or reject requests assigned to them.
- Only authorized users should be able to change the status of a request.
- Administrators can have the bigger access for them to manage the system.
- Sensitive request information should not be visible to users who are not involved in the request.

## 3. Storage

### Storage Type

A relational database is a good choice for this system because the main data has clear relationships.
As explained in the Domain Section, the relationships are organized and consitent. For example a user can sumbit many request, department can handle several requests, and so on..

A non-relational database is less suitable here because the data is strongly connected and we need clear relationships between users, departments, requests, approvals, and history.

Using a relational model also makes it easier to keep rules consistent, such as making sure every request belongs to a valid user and department.

### Durable Data

The following data should be stored permanently:

- Users
- Departments
- Request Categories
- Requests
- Approval Decisions
- Request History

### Derived Data

Some information can be calculated from the stored data instead of being saved permanently.

Examples include:

- Number of open requests
- Number of resolved requests
- Number of requests per department
- Dashboard totals
- Statistics based on request status

### Cached Data

Frequently accessed data can be stored temporarily in the cache to reduce repeated database queries.

The database remains the main source of truth.

## 4. Access Patterns

The data model should support the main actions users perform in the system.

### Employee

An employee should be able to view

- their own requests
- a specific request and its current status
- the history of their request


### Department Employee

A department employee should be able to:

- View requests assigned to their department.
- Filter requests by status.
- Open a request and view its details.
- Update requests they are responsible for.


### Approver

An approver should be able to:

- View requests waiting for their approval.
- View the information needed to make a decision.
- Approve or reject a request.


### Administrator

An administrator may need to view:

- users
- departments
- request categories
- requests across the system


### Important Query Patterns

Some common queries will be:

- Find all requests submitted by a specific employee.
- Find all requests assigned to a specific department.
- Find department requests with a certain status.
- Find approvals waiting for a specific approver.
- Find the history of a specific request.

### Indexes

Indexes can be useful on fields that are searched, filtered, or joined often.

- User ID: useful for quickly finding all requests submitted by a specific user.
- Department ID: useful for quickly finding all requests assigned to a specific department.
- Request Status: useful when filtering requests by states such as submitted, in progress, or resolved.
- Approver ID: useful for finding all approval requests assigned to a specific approver.
- Request ID: useful for quickly finding one specific request

Indexes should only be added if really needed, because too many indexes can take extra storage and can make updates slower.