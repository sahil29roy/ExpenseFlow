const db = require('../config/db');
const BalanceService = require('./balanceService');

class DashboardService {
  /**
   * Fetches aggregated metrics and paginated recent expenses for a user's dashboard
   */
  static async getUserDashboard(userId, { limit = 5, page = 1 }) {
    const parsedLimit = parseInt(limit, 10) || 5;
    const parsedPage = parseInt(page, 10) || 1;
    const offset = (parsedPage - 1) * parsedLimit;

    // Run aggregate metrics and list count queries in parallel
    const [
      groupsCountResult,
      totalExpensesResult,
      totalSpentResult,
      paginatedExpensesResult,
      balances
    ] = await Promise.all([
      // 1. Total Groups user belongs to
      db.query('SELECT COUNT(*) AS count FROM group_members WHERE user_id = $1', [userId]),
      
      // 2. Total count of expenses user is involved in
      db.query(`
        SELECT COUNT(DISTINCT e.id) AS count 
        FROM expenses e
        LEFT JOIN expense_splits s ON e.id = s.expense_id
        WHERE e.paid_by = $1 OR s.user_id = $1
      `, [userId]),

      // 3. Total amount paid/spent by user
      db.query('SELECT COALESCE(SUM(total_amount), 0) AS total_spent FROM expenses WHERE paid_by = $1', [userId]),

      // 4. Paginated recent expenses list involving user
      db.query(`
        SELECT DISTINCT 
          e.id, 
          e.description, 
          e.total_amount, 
          e.paid_by, 
          u.name AS paid_by_name, 
          e.split_type, 
          e.group_id, 
          g.name AS group_name, 
          e.created_at
        FROM expenses e
        LEFT JOIN expense_splits s ON e.id = s.expense_id
        JOIN users u ON e.paid_by = u.id
        LEFT JOIN groups g ON e.group_id = g.id
        WHERE e.paid_by = $1 OR s.user_id = $1
        ORDER BY e.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, parsedLimit, offset]),

      // 5. User balance sheet (giving us owes, gets back, and net balance)
      BalanceService.getUserBalances(userId)
    ]);

    // Parse counts
    const totalGroups = parseInt(groupsCountResult.rows[0].count, 10);
    const totalExpenses = parseInt(totalExpensesResult.rows[0].count, 10);
    const totalAmountSpent = Number(Number(totalSpentResult.rows[0].total_spent).toFixed(2));

    // Calculate sum of what user owes and gets back based on pairwise balances
    let amountUserOwes = 0;
    let amountUserGetsBack = 0;

    balances.owes.forEach(item => {
      amountUserOwes += item.amount;
    });

    balances.owedBy.forEach(item => {
      amountUserGetsBack += item.amount;
    });

    amountUserOwes = Number(amountUserOwes.toFixed(2));
    amountUserGetsBack = Number(amountUserGetsBack.toFixed(2));

    // Compile recent expenses list
    const recentExpenses = paginatedExpensesResult.rows;

    // Compile pagination metadata
    const totalPages = Math.ceil(totalExpenses / parsedLimit);

    return {
      metrics: {
        totalGroups,
        totalExpenses,
        totalAmountSpent,
        amountUserOwes,
        amountUserGetsBack,
        netBalance: balances.summary.netBalance
      },
      recentExpenses,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalExpenses,
        totalPages,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    };
  }
}

module.exports = DashboardService;
