const db = require('../config/db');

class BalanceService {
  /**
   * Calculates detailed balance sheet for a user
   */
  static async getUserBalances(userId) {
    // 1. Optimized PostgreSQL aggregate query combining sums, joins, and settlements
    const balanceSummaryQuery = `
      SELECT 
        (COALESCE(p.total_paid, 0) + COALESCE(sp.settled_paid, 0)) AS total_paid,
        (COALESCE(o.total_owed, 0) + COALESCE(sr.settled_received, 0)) AS total_owed,
        ((COALESCE(p.total_paid, 0) + COALESCE(sp.settled_paid, 0)) - (COALESCE(o.total_owed, 0) + COALESCE(sr.settled_received, 0))) AS net_balance
      FROM users u
      LEFT JOIN (
        SELECT paid_by, SUM(total_amount) AS total_paid
        FROM expenses
        GROUP BY paid_by
      ) p ON u.id = p.paid_by
      LEFT JOIN (
        SELECT user_id, SUM(amount) AS total_owed
        FROM expense_splits
        GROUP BY user_id
      ) o ON u.id = o.user_id
      LEFT JOIN (
        SELECT payer_id, SUM(amount) AS settled_paid
        FROM settlements
        GROUP BY payer_id
      ) sp ON u.id = sp.payer_id
      LEFT JOIN (
        SELECT payee_id, SUM(amount) AS settled_received
        FROM settlements
        GROUP BY payee_id
      ) sr ON u.id = sr.payee_id
      WHERE u.id = $1
    `;
    
    const summaryResult = await db.query(balanceSummaryQuery, [userId]);
    
    const summaryRow = summaryResult.rows[0] || { total_paid: 0, total_owed: 0, net_balance: 0 };
    
    const totalPaid = Number(Number(summaryRow.total_paid).toFixed(2));
    const totalOwed = Number(Number(summaryRow.total_owed).toFixed(2));
    const netBalance = Number(Number(summaryRow.net_balance).toFixed(2));

    // 3. Get pairwise relationships: How much this user owes others
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

    // 5. Get pairwise settlements to offset debts
    const settlementsQuery = `
      SELECT s.payer_id, s.payee_id, SUM(s.amount) as amount
      FROM settlements s
      WHERE s.payer_id = $1 OR s.payee_id = $1
      GROUP BY s.payer_id, s.payee_id
    `;
    const settlementsResult = await db.query(settlementsQuery, [userId]);

    // Combine pairwise relationships
    const balanceMap = new Map();

    // Process others who owe this user (positive balance for current user)
    othersOweUserResult.rows.forEach(row => {
      const uId = row.user_id;
      balanceMap.set(uId, {
        userId: uId,
        name: row.name,
        email: row.email,
        amount: Number(Number(row.amount).toFixed(2))
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
          amount: Number((-Number(row.amount)).toFixed(2))
        });
      }
    });

    // Merge settlements to adjust pairwise balances
    settlementsResult.rows.forEach(row => {
      const isPayer = row.payer_id === userId;
      const targetUserId = isPayer ? row.payee_id : row.payer_id;
      const settledAmount = Number(row.amount);

      if (balanceMap.has(targetUserId)) {
        const existing = balanceMap.get(targetUserId);
        if (isPayer) {
          // Current user paid target user, reducing debt (negative balance goes towards 0)
          existing.amount = Number((existing.amount + settledAmount).toFixed(2));
        } else {
          // Current user received from target user, reducing credit (positive balance goes towards 0)
          existing.amount = Number((existing.amount - settledAmount).toFixed(2));
        }
      } else {
        // Handle settlement when no prior split exists (e.g. advance payment)
        // Retrieve details of the other user to create a balanceMap entry
        // We can skip or add a placeholder since we want to be safe.
        // Usually, a settlement is only created to clear a split, but we can register it:
        balanceMap.set(targetUserId, {
          userId: targetUserId,
          name: isPayer ? 'User' : 'User', // will be resolved or ignored if not in database query
          email: '',
          amount: isPayer ? settledAmount : -settledAmount
        });
      }
    });

    // Convert balance map to list and filter out empty balances
    const balances = [];
    balanceMap.forEach(val => {
      if (Math.abs(val.amount) > 0.01) {
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
          name: b.name === 'User' ? `User (${b.userId.substring(0, 8)})` : b.name,
          email: b.email,
          amount: Math.abs(b.amount)
        });
      } else {
        owedBy.push({
          userId: b.userId,
          name: b.name === 'User' ? `User (${b.userId.substring(0, 8)})` : b.name,
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
      owes,
      owedBy
    };
  }

  /**
   * Calculates simplified global settlements (min cash flow algorithm) incorporating settlements
   */
  static async getGlobalSettlements() {
    // Get net balance for all users including direct recorded settlements
    const query = `
      SELECT u.id, u.name, u.email,
        (
          (SELECT COALESCE(SUM(total_amount), 0) FROM expenses WHERE paid_by = u.id) +
          (SELECT COALESCE(SUM(amount), 0) FROM settlements WHERE payer_id = u.id)
        ) - (
          (SELECT COALESCE(SUM(amount), 0) FROM expense_splits WHERE user_id = u.id) +
          (SELECT COALESCE(SUM(amount), 0) FROM settlements WHERE payee_id = u.id)
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
