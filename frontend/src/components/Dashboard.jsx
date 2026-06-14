import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { 
  TrendingUp, 
  ArrowDownRight, 
  ArrowUpRight, 
  Scale, 
  Receipt,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Dashboard({ user, refreshTrigger, showToast }) {
  const [metrics, setMetrics] = useState({
    totalAmountSpent: 0,
    amountUserOwes: 0,
    amountUserGetsBack: 0,
    netBalance: 0
  });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [balances, setBalances] = useState({ owes: [], owedBy: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [page, refreshTrigger]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch dashboard metrics & recent expenses
      const dashRes = await apiRequest(`/dashboard?limit=5&page=${page}`);
      if (dashRes && dashRes.data) {
        setMetrics(dashRes.data.metrics);
        setRecentExpenses(dashRes.data.recentExpenses || []);
        setPagination(dashRes.data.pagination);
      }

      // 2. Fetch balance details
      const balRes = await apiRequest('/expenses/balances');
      if (balRes && balRes.data && balRes.data.balances) {
        setBalances({
          owes: balRes.data.balances.owes || [],
          owedBy: balRes.data.balances.owedBy || []
        });
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => {
    return `$${Number(val || 0).toFixed(2)}`;
  };

  const getNetBalanceStyle = () => {
    if (metrics.netBalance > 0) return 'text-green';
    if (metrics.netBalance < 0) return 'text-red';
    return '';
  };

  const getGreetingMessage = () => {
    if (metrics.netBalance > 0) {
      return `You have a net positive balance of ${formatCurrency(metrics.netBalance)}. Great job keeping things balanced!`;
    }
    if (metrics.netBalance < 0) {
      return `You owe a net amount of ${formatCurrency(Math.abs(metrics.netBalance))}. Consider settling up soon.`;
    }
    return "You're completely settled up! Everyone is even.";
  };

  const getFormattedDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  return (
    <div className="app-panel">
      {/* Welcome Card */}
      <div className="card-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #ecfdf5, #ffffff)', borderColor: 'var(--accent-border)' }}>
        <div>
          <h2 style={{ fontSize: '20px', color: 'var(--primary)', marginBottom: '4px' }}>
            Welcome back, {user ? user.name : 'friend'}! 🌟
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {getGreetingMessage()}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="badge bg-green" style={{ textTransform: 'none', fontSize: '12px', fontWeight: '500' }}>
            {getFormattedDate()}
          </span>
        </div>
      </div>
      {/* Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card bg-gradient-green">
          <div className="metric-header">
            <span>Total Spent (Paid)</span>
            <TrendingUp />
          </div>
          <h2>{formatCurrency(metrics.totalAmountSpent)}</h2>
          <p className="metric-desc">Lifetime paid expenses</p>
        </div>

        <div className="metric-card bg-card-neutral">
          <div className="metric-header">
            <span>You Owe</span>
            <ArrowDownRight className="text-orange" />
          </div>
          <h2 className="text-orange">{formatCurrency(metrics.amountUserOwes)}</h2>
          <p className="metric-desc">Pending debts to clear</p>
        </div>

        <div className="metric-card bg-card-neutral">
          <div className="metric-header">
            <span>You Are Owed</span>
            <ArrowUpRight className="text-green" />
          </div>
          <h2 className="text-green">{formatCurrency(metrics.amountUserGetsBack)}</h2>
          <p className="metric-desc">Pending credits to receive</p>
        </div>

        <div className="metric-card bg-card-neutral">
          <div className="metric-header">
            <span>Net Balance</span>
            <Scale />
          </div>
          <h2 className={getNetBalanceStyle()}>
            {metrics.netBalance > 0 ? '+' : ''}{formatCurrency(metrics.netBalance)}
          </h2>
          <p className="metric-desc">Consolidated balance sheet</p>
        </div>
      </div>

      {/* Split views */}
      <div className="dashboard-split">
        {/* Recent Ledger Feed */}
        <div className="dashboard-section card-wrapper">
          <div className="section-header">
            <h3>Recent Activity Feed</h3>
            {pagination && pagination.totalPages > 1 && (
              <div className="pagination-controls mini-pages">
                <button 
                  type="button" 
                  className="pagination-btn"
                  disabled={!pagination.hasPrevPage}
                  onClick={() => setPage(prev => Math.max(1, prev - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="pagination-info">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button 
                  type="button" 
                  className="pagination-btn"
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage(prev => prev + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
          
          <div className="feed-list">
            {recentExpenses.length > 0 ? (
              recentExpenses.map(exp => {
                const isPayer = exp.paid_by === user.id;
                const formattedDate = new Date(exp.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <div key={exp.id} className="feed-item">
                    <div className="feed-item-left">
                      <div className="feed-icon">
                        <Receipt size={20} />
                      </div>
                      <div className="feed-info">
                        <h4>{exp.description}</h4>
                        <p>
                          {exp.group_name ? `Group: ${exp.group_name}` : 'Personal split'} • Paid by {isPayer ? 'You' : exp.paid_by_name}
                        </p>
                      </div>
                    </div>
                    <div className="feed-item-right">
                      <span className={`feed-amount ${isPayer ? 'text-green' : 'text-red'}`}>
                        {formatCurrency(exp.total_amount)}
                      </span>
                      <p className="feed-split-detail">{formattedDate}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty-state">No recent activity found. Click 'Add Expense' to get started!</p>
            )}
          </div>
        </div>

        {/* Pairwise debt relations */}
        <div className="dashboard-section card-wrapper">
          <div className="section-header">
            <h3>Pairwise Relationships</h3>
          </div>
          <div className="pairwise-relations">
            <div className="relations-box">
              <h4>People you owe</h4>
              <ul className="balances-list">
                {balances.owes.length > 0 ? (
                  balances.owes.map(debt => (
                    <li key={debt.userId}>
                      <span className="user-name">{debt.name}</span>
                      <span className="balance-val text-red">
                        You owe {formatCurrency(debt.amount)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="empty-state mini">You don't owe anyone!</li>
                )}
              </ul>
            </div>
            
            <div className="relations-box">
              <h4>People who owe you</h4>
              <ul className="balances-list">
                {balances.owedBy.length > 0 ? (
                  balances.owedBy.map(credit => (
                    <li key={credit.userId}>
                      <span className="user-name">{credit.name}</span>
                      <span className="balance-val text-green">
                        Owes you {formatCurrency(credit.amount)}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="empty-state mini">No one owes you.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
