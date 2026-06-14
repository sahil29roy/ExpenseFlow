# Expense Sharing System API Documentation

The Expense Sharing System backend provides a complete solution for managing shared expenses, groups, pairwise balances, simplified global settlements, and CSV data imports.

---

## Base URL
`http://localhost:5000`

---

## Authentication
All API endpoints (except `/api/auth/register` and `/api/auth/login`) require Bearer Token Authentication. Pass your JWT token in the `Authorization` header.

**Format**: `Authorization: Bearer <your_jwt_token>`

---

## Endpoints

### 1. User Authentication

#### `POST /api/auth/register`
Creates a new user account and returns a JWT token.
- **Request Body**:
  ```json
  {
    "name": "Alice Smith",
    "email": "alice@example.com",
    "password": "password123"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "af27186d-8e35-4f04-be5d-715722bab49b",
        "name": "Alice Smith",
        "email": "alice@example.com"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### `POST /api/auth/login`
Authenticates an existing user and returns a JWT token.
- **Request Body**:
  ```json
  {
    "email": "alice@example.com",
    "password": "password123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "af27186d-8e35-4f04-be5d-715722bab49b",
        "name": "Alice Smith",
        "email": "alice@example.com"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

---

### 2. Group Management

#### `POST /api/groups`
Creates a new group. The creator is automatically added as a member.
- **Request Body**:
  ```json
  {
    "name": "Apartment 4B",
    "description": "Splitting bills and groceries"
  }
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "status": "success",
    "data": {
      "group": {
        "id": "e97d21d3-14de-45e8-9f34-1c9af526adc1",
        "name": "Apartment 4B",
        "description": "Splitting bills and groceries",
        "created_by": "af27186d-8e35-4f04-be5d-715722bab49b",
        "created_at": "2026-06-14T16:46:50.507Z",
        "updated_at": "2026-06-14T16:46:50.507Z"
      }
    }
  }
  ```

#### `GET /api/groups`
Lists all groups the authenticated user belongs to. Supports pagination.
- **Query Parameters**:
  - `limit` (optional): Number of records per page (e.g. `10`)
  - `page` (optional): Page number (e.g. `1`)
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "groups": [ ... ],
      "pagination": {
        "page": 1,
        "limit": 10,
        "totalGroups": 3,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPrevPage": false
      }
    }
  }
  ```

#### `GET /api/groups/:id`
Retrieves single group details and the member list.
- **Success Response (200 OK)**:
  ```json
  {
    "status": "success",
    "data": {
      "group": {
        "id": "e97d21d3-14de-45e8-9f34-1c9af526adc1",
        "name": "Apartment 4B",
        "description": "Splitting bills and groceries"
      },
      "members": [
        { "id": "af27186d...", "name": "Alice Smith", "email": "alice@..." }
      ]
    }
  }
  ```

#### `PUT /api/groups/:id`
Updates group details. (Members only).
- **Request Body**:
  ```json
  {
    "name": "Co-living Apartment 4B",
    "description": "Updated grocery splitting"
  }
  ```

#### `DELETE /api/groups/:id`
Deletes a group. (Creator only).

#### `GET /api/groups/:id/members`
Lists all members in the group.

#### `POST /api/groups/:id/members`
Adds a member to the group.
- **Request Body**:
  ```json
  {
    "userId": "01ba4268-050f-4eb6-b591-7c01a95188d4"
  }
  ```

#### `DELETE /api/groups/:id/members/:userId`
Removes a member from the group.

---

### 3. Expenses & Splits

#### `POST /api/expenses`
Creates a new expense split record.
- **Request Body**:
  ```json
  {
    "description": "Internet Bill",
    "totalAmount": 150.00,
    "groupId": "e97d21d3-14de-45e8-9f34-1c9af526adc1",
    "splitType": "EQUAL",
    "participants": [
      { "userId": "af27186d-8e35-4f04-be5d-715722bab49b" },
      { "userId": "01ba4268-050f-4eb6-b591-7c01a95188d4" }
    ]
  }
  ```
  *(Note: For `EXACT` or `UNEQUAL` splitType, pass `"amount"` for each participant. For `PERCENTAGE`, pass `"percentage"`)*.

#### `GET /api/expenses`
Lists all expenses involving the authenticated user. Supports pagination.
- **Query Parameters**:
  - `limit` (optional): Number of records per page (default `10`)
  - `page` (optional): Page number (default `1`)

#### `GET /api/expenses/balances`
Calculates the user's total paid, total owed, net balance, and pairwise relationships (who they owe and who owes them).

#### `GET /api/expenses/settlements`
Calculates optimized simplified debt clearance transactions for all users using the greedy min cash flow algorithm.

#### `GET /api/expenses/:id`
Retrieves a single expense with its detail splits list.

#### `POST /api/expenses/import`
Imports a CSV file containing multiple expense records atomically. Runs validation on all rows and commits everything inside a single transaction. If any row is invalid, the entire import rolls back.
- **Content-Type**: `multipart/form-data`
- **Request Fields**:
  - `file`: CSV file

---

### 4. Dashboard

#### `GET /api/dashboard`
Aggregates dashboard stats (total groups, total expenses, amount spent, net balance, owes summary) and returns a paginated feed of recent expenses.
- **Query Parameters**:
  - `limit` (optional): Defaults to `5`
  - `page` (optional): Defaults to `1`

---

### 5. Settlements

#### `POST /api/settlements`
Records a manual payment clearing debts between users.
- **Request Body**:
  ```json
  {
    "payeeId": "af27186d-8e35-4f04-be5d-715722bab49b",
    "amount": 50.00,
    "groupId": "e97d21d3-14de-45e8-9f34-1c9af526adc1"
  }
  ```

#### `GET /api/settlements`
Lists settlements paid or received by the authenticated user.

#### `GET /api/settlements/group/:groupId`
Lists settlements recorded within a specific group.
