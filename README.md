# ExpenseFlow — Smart Expense Sharing System

ExpenseFlow is a production-ready, full-stack expense sharing application designed to split bills, track balances, and optimize debt settlements. The system consists of a robust **Node.js/Express** backend backed by a **PostgreSQL** database, and a highly responsive, modern **React + Vite** frontend styled with a premium green color format (sage, mint, and emerald palettes).

---

## 🚀 Key Features

### 1. Core Balance & Settlement Engine
*   **PostgreSQL Aggregate Engine**: Computes exact balances (Total Paid, Total Owed, Net Balance) directly in the database using optimized aggregate queries.
*   **Settlement Generation Solver**: Implements the **Greedy Min-Cash-Flow Algorithm** to calculate the absolute minimum number of transaction clearances required to settle all debts in a group.
*   **Manual Clearances**: Record specific member-to-member payments to clear existing debts, automatically updating balances in real time.

### 2. Transaction-Safe CSV Import
*   **Atomic Imports**: Upload and parse CSV formatted expenses.
*   **Rollback Guarantee**: All rows are parsed, validated, and inserted within a single database transaction client context. If a single row fails validation or constraint verification, the entire batch rolls back, preventing partial or corrupt states.

### 3. Dynamic User Dashboard
*   **Unified Metrics**: Instantly view Total Groups, Total Expenses, Amount Spent, Amount Owed, and Amount to Get Back.
*   **Recent Activity Feed**: Paginated view of the latest expenses added across user groups.

### 4. Interactive Group & Expense Management
*   **Group Creation & Collaboration**: Create groups, list members, and add/remove participants.
*   **Advanced Expense Splits**: Supports three custom split types:
    *   `EQUAL`: Automatically divides the amount evenly among participants.
    *   `EXACT`: Manually specify the exact share (in currency units) for each member.
    *   `PERCENTAGE`: Define custom splits using percentages (must sum to exactly 100%).

### 5. Production-Ready Architecture & Security
*   **Connection Pooling**: Managed via `pg.Pool` with strict limit, idle timeout, and connection timeout configurations.
*   **Query Index Optimization**: Custom database indexes on high-frequency sorting and filtering columns (`created_at`, `settled_at`) to maximize throughput.
*   **API Security**: Hardened headers via `helmet`, CORS protections, JWT token authentication, and API request rate limiting.
*   **Structured Logging**: Integration with `winston` for rotating file logs (`logs/combined.log`, `logs/error.log`) and colorized console logs.
*   **Global Error Handling**: Custom `AppError` subclasses maps PostgreSQL constraints (like unique emails or foreign keys) directly to clean HTTP statuses.
*   **Interactive Documentation**: Integrated OpenAPI 3.0 (Swagger UI) served live at `/api-docs`.

---

## 🛠️ Technology Stack

### Backend
*   **Runtime**: Node.js (v18+)
*   **Framework**: Express.js
*   **Database**: PostgreSQL
*   **Libraries**: `pg` (node-postgres), `bcryptjs`, `jsonwebtoken` (JWT), `multer`, `csv-parser`
*   **Security & Logs**: `helmet`, `cors`, `express-rate-limit`, `morgan`, `winston`
*   **Documentation**: `swagger-ui-express`

### Frontend
*   **Framework**: React (v19) + Vite
*   **Styling**: Modern Vanilla CSS (Harmonious green color schemes, responsive grid layouts, card micro-animations)
*   **Icons**: `lucide-react`

---

## 📂 Project Directory Structure

```text
├── backend/
│   ├── config/             # DB Connection pool configuration
│   ├── controllers/        # Express route controller logic
│   ├── middleware/         # Security headers, rate limit, JWT verify, error handlers
│   ├── models/             # Database access queries (User, Group, Expense, Split, Settlement)
│   ├── routes/             # REST endpoints (auth, groups, expenses, settlements, dashboard)
│   ├── services/           # Balance computing & CSV parsing service layers
│   ├── utils/              # Winston logger, AppError classes
│   ├── schema.sql          # SQL schema creation & index definitions
│   ├── swagger.json        # OpenAPI 3.0 specification definition
│   ├── server.js           # Server entry point
│   └── test_api.js         # Integration tests
│
└── frontend/
    ├── public/             # Static public assets
    ├── src/
    │   ├── components/     # UI Views (Dashboard, Auth, Groups, Expenses, Settlements, CsvImport)
    │   ├── utils/          # API client handler & JWT storage
    │   ├── App.jsx         # App router & workspace toggles
    │   ├── index.css       # Core green design system variables & utilities
    │   └── main.jsx        # App entry point
```

---

## ⚙️ Quick Start & Setup

### Database Configuration

1. Create a PostgreSQL database called `expense_sharing`:
   ```sql
   CREATE DATABASE expense_sharing;
   ```
2. Run the `backend/schema.sql` script to set up tables and optimized indexes:
   ```bash
   psql -U postgres -d expense_sharing -f backend/schema.sql
   ```

### Backend Setup

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   DB_USER=your_pg_user
   DB_PASSWORD=your_pg_password
   DB_HOST=localhost
   DB_PORT=5432
   DB_DATABASE=expense_sharing
   JWT_SECRET=your_jwt_super_secret_key
   CORS_ORIGIN=http://localhost:5173
   ```
4. Start the backend server:
   * **Development Mode (Auto-restart)**:
     ```bash
     npm run dev
     ```
   * **Production Mode**:
     ```bash
     npm start
     ```

### Frontend Setup

1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to `http://localhost:5173` to interact with ExpenseFlow.

---

## 🧪 Testing & Verification

We have included a comprehensive automated integration script. To verify the backend's core routes (Registration, Login, Group creation, equal/exact splits computation, balance resolution, min-cash-flow settlement solver, and error boundaries):

```bash
cd backend
node test_api.js
```

---

## 📝 API Endpoints Summary

### Authentication
*   `POST /api/auth/register` — Create user and get token.
*   `POST /api/auth/login` — Login user.

### Group Management
*   `POST /api/groups` — Create a group.
*   `GET /api/groups` — Get user groups (paginated).
*   `POST /api/groups/:id/members` — Add a member to a group.
*   `DELETE /api/groups/:id/members/:userId` — Remove a member from a group.

### Expense & Splits
*   `POST /api/expenses` — Create expense (supports EQUAL, EXACT, PERCENTAGE).
*   `GET /api/expenses` — Get user expenses (paginated).
*   `GET /api/expenses/balances` — Retrieve user aggregate balances & relationships.
*   `GET /api/expenses/settlements` — Calculate recommended simplified settlements.
*   `POST /api/expenses/import` — Atomically import CSV file.

### Settlements
*   `POST /api/settlements` — Record a manual clearance payment.
*   `GET /api/settlements` — Retrieve settlements involving the current user.

### Dashboard
*   `GET /api/dashboard` — Get metrics & paginated feed of recent expenses.

---

## 🎨 Design Theme & Styling
The frontend utilizes a customized CSS variables design system inside `frontend/src/index.css` using beautiful, high-contrast greens:
*   **Primary Accent**: `#10b981` (Emerald Green)
*   **Secondary Accent**: `#059669` (Darker Emerald)
*   **Background Canvas**: Slate Dark backgrounds blended with sage borders for dark mode / glassmorphism-friendly surfaces.
*   **Hover states**: Smooth transition transforms and glow effects on active buttons and sidebar tabs.
