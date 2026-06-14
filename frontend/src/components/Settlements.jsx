import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';

export default function Settlements({ users, groups, refreshTrigger, onRecordSettlementSuccess, showToast, showSettleModal, onCloseSettleModal }) {
  const [recs, setRecs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [payeeId, setPayeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [groupId, setGroupId] = useState('');

  useEffect(() => {
    fetchSettlementsData();
  }, [refreshTrigger]);

  const fetchSettlementsData = async () => {
    setLoading(true);
    try {
      // 1. Get simplified recommendations
      const recsRes = await apiRequest('/expenses/settlements');
      if (recsRes && recsRes.data) {
        setRecs(recsRes.data.settlements || []);
      }

      // 2. Get recorded history
      const histRes = await apiRequest('/settlements');
      if (histRes && histRes.data) {
        setHistory(histRes.data || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSubmit = async (e) => {
    e.preventDefault();
    if (!payeeId || !amount) return;

    try {
      const res = await apiRequest('/settlements', {
        method: 'POST',
        body: JSON.stringify({
          payeeId,
          amount: parseFloat(amount),
          groupId: groupId || null
        })
      });

      if (res && res.data) {
        showToast('Settlement payment recorded successfully!', 'success');
        setPayeeId('');
        setAmount('');
        setGroupId('');
        onCloseSettleModal();
        onRecordSettlementSuccess(); // Refresh dashboard and list
        fetchSettlementsData();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="app-panel">
      <div className="settlements-split">
        {/* Left: Recommendations */}
        <div className="card-wrapper">
          <div className="section-header">
            <h3>Debt Simplification Recommendations</h3>
            <Sparkles className="text-green" />
          </div>
          <p className="section-subtitle">
            Optimized transactions computed using the greedy min cash flow algorithm to clear all balances with minimum transfers.
          </p>
          <div className="settlement-runs">
            {recs.length > 0 ? (
              recs.map((rec, idx) => (
                <div key={idx} className="settle-card">
                  <div className="settle-flow">
                    <span className="settle-user">{rec.from.name}</span>
                    <span className="settle-arrow">
                      pays
                      <ArrowRight size={16} />
                    </span>
                    <span className="settle-user">{rec.to.name}</span>
                  </div>
                  <div className="settle-amount">${rec.amount.toFixed(2)}</div>
                </div>
              ))
            ) : (
              <p className="empty-state">No settlements recommended. Everyone is even!</p>
            )}
          </div>
        </div>

        {/* Right: Payment Settlement logs */}
        <div className="card-wrapper">
          <div className="section-header">
            <h3>Payment Settlement History</h3>
          </div>
          <div className="feed-list">
            {history.length > 0 ? (
              history.map(settle => {
                const isPayer = settle.payer_id === (currentUser ? currentUser.id : null);
                const date = new Date(settle.settled_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
                return (
                  <div key={settle.id} className="settlement-item">
                    <div className="feed-item-left">
                      <div className="feed-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                        <CheckCircle2 size={20} />
                      </div>
                      <div className="feed-info">
                        <h4>Payment Recorded</h4>
                        <p>
                          <strong>{isPayer ? 'You' : settle.payer_name}</strong> paid <strong>{settle.payee_id === (currentUser ? currentUser.id : null) ? 'You' : settle.payee_name}</strong>
                        </p>
                      </div>
                    </div>
                    <div className="feed-item-right">
                      <span className="feed-amount text-green">
                        ${Number(settle.amount).toFixed(2)}
                      </span>
                      <p className="feed-split-detail">{date}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="empty-state">No settlement payments recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* --- RECORD SETTLEMENT MODAL --- */}
      {showSettleModal && (
        <div className="modal show">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Record a Payment Settlement</h3>
                <button type="button" className="modal-close" onClick={onCloseSettleModal}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleRecordSubmit}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="settle-payee-select">Recipient (Who did you pay?)</label>
                    <select
                      id="settle-payee-select"
                      value={payeeId}
                      onChange={(e) => setPayeeId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select user...</option>
                      {users.map(u => {
                        if (currentUser && u.id === currentUser.id) return null;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="settle-amt-val">Amount Settled ($)</label>
                    <input
                      type="number"
                      id="settle-amt-val"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="settle-grp-select">Associated Group (Optional)</label>
                    <select
                      id="settle-grp-select"
                      value={groupId}
                      onChange={(e) => setGroupId(e.target.value)}
                    >
                      <option value="">Non-group settlement</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={onCloseSettleModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Save Record</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
