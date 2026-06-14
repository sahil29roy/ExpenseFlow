const db = require('../config/db');

class BalanceService {
  /**
   * Calculates detailed balance sheet for a user
   */
  static async getUserBalances(userId) {
    // 1. Get sum of all expenses paid by this user
    const paidQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total_paid
      FROM expenses
      WHERE paid_by = $1
    `;
    const paidResult = await db.query(paidQuery, [userId]);
    const totalPaid = Number(paidResult.rows[0].total_paid);

    // 2. Get sum of all splits this user owes (including when they split their own expenses)
    const owedQuery = `
      SELECT COALESCE(SUM(amount), 0) as total_owed
      FROM expense_splits
      WHERE user_id = $1
    `;
    const owedResult = await db.query(owedQuery, [userId]);
    const totalOwed = Number(owedResult.rows[0].total_owed);

    const netBalance = Number((totalPaid - totalOwed).toFixed(2));

    // 3. Get pairwise relationships: How much this user owes others
    // (User is a participant in expenses paid by other users)
    const owesOthersQuery = `
      SELECT 
        e.paid_by as user_id, 
        u.name, 
        u.email,
        SUM(s.amount) as amount
      FROM expense_splits s
      JOIN expenses e ON s.expense_id = e.id
      JOIN users u ON e.paid_by = u.id
      WHERE s.user_id = $1 AND e.paid_by != $1
      GROUP BY e.paid_by, u.name, u.email
    `;
    const owesOthersResult = await db.query(owesOthersQuery, [userId]);

    // 4. Get pairwise relationships: How much others owe this user
    // (Other users are participants in expenses paid by this user)
    const othersOweUserQuery = `
      SELECT 
        s.user_id, 
        u.name, 
        u.email,
        SUM(s.amount) as amount
      FROM expense_splits s
      JOIN expenses e ON s.expense_id = e.id
      JOIN users u ON s.user_id = u.id
      WHERE e.paid_by = $1 AND s.user_id != $1
      GROUP BY s.user_id, u.name, u.email
    `;
    const othersOweUserResult = await db.query(othersOweUserQuery, [userId]);

    // Combine pairwise relationships
    const balanceMap = new Map();

    // Process others who owe this user (positive balance for current user)
    othersOweUserResult.rows.forEach(row => {
      const uId = row.user_id;
      balanceMap.set(uId, {
        userId: uId,
        name: row.name,
        email: row.email,
        amount: Number(Number(row.amount).toFixed(2)) // Positive means they owe current user
      });
    });

    // Process other users who this user owes (negative balance for current user)
    owesOthersResult.rows.forEach(row => {
      const uId = row.user_id;
      if (balanceMap.has(uId)) {
        const existing = balanceMap.get(uId);
        existing.amount = Number((existing.amount - Number(row.amount)).toFixed(2));
      } else {
        balanceMap.set(uId, {
          userId: uId,
          name: row.name,
          email: row.email,
          amount: Number((-Number(row.amount)).toFixed(2)) // Negative means current user owes them
        });
      }
    });

    // Convert balance map to list and categorize
    const balances = [];
    balanceMap.forEach(val => {
      if (val.amount !== 0) {
        balances.push(val);
      }
    });

    // Format list into friendly owes/owed categories
    const owes = [];
    const owedBy = [];

    balances.forEach(b => {
      if (b.amount < 0) {
        owes.push({
          userId: b.userId,
          name: b.name,
          email: b.email,
          amount: Math.abs(b.amount)
        });
      } else {
        owedBy.push({
          userId: b.userId,
          name: b.name,
          email: b.email,
          amount: b.amount
        });
      }
    });

    return {
      userId,
      summary: {
        totalPaid: Number(totalPaid.toFixed(2)),
        totalOwed: Number(totalOwed.toFixed(2)),
        netBalance
      },
      owes,     // Who the current user owes money to
      owedBy    // Who owes money to the current user
    };
  }

  /**
   * Calculates simplified global settlements (min cash flow algorithm)
   */
  static async getGlobalSettlements() {
    // Get net balance for all users
    const query = `
      SELECT u.id, u.name, u.email,
        (
          SELECT COALESCE(SUM(total_amount), 0) 
          FROM expenses 
          WHERE paid_by = u.id
        ) - (
          SELECT COALESCE(SUM(amount), 0) 
          FROM expense_splits 
          WHERE user_id = u.id
        ) as net_balance
      FROM users u
      ORDER BY u.id
    `;
    const { rows } = await db.query(query);

    // Filter into debtors (negative balance) and creditors (positive balance)
    const debtors = [];
    const creditors = [];

    rows.forEach(r => {
      const balance = Number(Number(r.net_balance).toFixed(2));
      if (balance < 0) {
        debtors.push({ id: r.id, name: r.name, email: r.email, balance });
      } else if (balance > 0) {
        creditors.push({ id: r.id, name: r.name, email: r.email, balance });
      }
    });

    const settlements = [];

    let dIdx = 0;
    let cIdx = 0;

    // Greedy min cash flow settlement solver
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const debtAmount = Math.abs(debtor.balance);
      const creditAmount = creditor.balance;

      const settledAmount = Number(Math.min(debtAmount, creditAmount).toFixed(2));

      settlements.push({
        from: { id: debtor.id, name: debtor.name, email: debtor.email },
        to: { id: creditor.id, name: creditor.name, email: creditor.email },
        amount: settledAmount
      });

      debtor.balance = Number((debtor.balance + settledAmount).toFixed(2));
      creditor.balance = Number((creditor.balance - settledAmount).toFixed(2));

      if (Math.abs(debtor.balance) < 0.01) {
        dIdx++;
      }
      if (creditor.balance < 0.01) {
        cIdx++;
      }
    }

    return settlements;
  }
}

module.exports = BalanceService;
