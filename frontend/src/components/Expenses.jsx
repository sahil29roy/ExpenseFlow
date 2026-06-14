import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function Expenses({ users, groups, ledgerPage, onLedgerPageChange, refreshTrigger, showToast, showAddExpenseModal, onCloseAddExpenseModal }) {
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState(null);
  
  // Create expense form states
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [groupId, setGroupId] = useState('');
  const [splitType, setSplitType] = useState('EQUAL');
  const [groupMembers, setGroupMembers] = useState([]);
  const [participantSelection, setParticipantSelection] = useState({}); // { [userId]: { checked: boolean, val: string } }
  
  // Dynamic validation states
  const [remainingText, setRemainingText] = useState('$0.00 left');
  const [isBalanced, setIsBalanced] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [ledgerPage, refreshTrigger]);

  const fetchExpenses = async () => {
    try {
      const res = await apiRequest(`/expenses?limit=5&page=${ledgerPage}`);
      if (res && res.data) {
        setExpenses(res.data.expenses || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {}
  };

  // Group members fetcher
  useEffect(() => {
    if (showAddExpenseModal) {
      loadGroupMembers();
    }
  }, [groupId, showAddExpenseModal]);

  const loadGroupMembers = async () => {
    if (groupId) {
      try {
        const res = await apiRequest(`/groups/${groupId}/members`);
        if (res && res.data) {
          const members = res.data.members || [];
          setGroupMembers(members);
          initializeParticipantsState(members);
        }
      } catch (err) {}
    } else {
      setGroupMembers(users);
      initializeParticipantsState(users);
    }
  };

  const initializeParticipantsState = (list) => {
    const defaultState = {};
    const currentUser = JSON.parse(localStorage.getItem('user'));
    
    list.forEach(u => {
      // By default check everyone, and keep values blank
      defaultState[u.id] = {
        checked: true,
        val: ''
      };
    });
    setParticipantSelection(defaultState);
  };

  // Trigger split calculations reactive validation
  useEffect(() => {
    validateSplitMath();
  }, [totalAmount, splitType, participantSelection]);

  const validateSplitMath = () => {
    const amountFloat = parseFloat(totalAmount) || 0;
    const selected = Object.entries(participantSelection).filter(([_, data]) => data.checked);
    
    if (amountFloat <= 0) {
      setRemainingText('$0.00 left');
      setIsBalanced(false);
      return;
    }

    if (selected.length === 0) {
      setRemainingText('Select participants');
      setIsBalanced(false);
      return;
    }

    if (splitType === 'EQUAL') {
      const splitVal = amountFloat / selected.length;
      setRemainingText(`$${splitVal.toFixed(2)} each`);
      setIsBalanced(true);
      return;
    }

    let inputSum = 0;
    selected.forEach(([_, data]) => {
      inputSum += parseFloat(data.val) || 0;
    });

    if (splitType === 'EXACT') {
      const diff = amountFloat - inputSum;
      if (Math.abs(diff) < 0.01) {
        setRemainingText('$0.00 left');
        setIsBalanced(true);
      } else {
        setRemainingText(`$${diff.toFixed(2)} remaining`);
        setIsBalanced(false);
      }
    } else if (splitType === 'PERCENTAGE') {
      const diff = 100.0 - inputSum;
      if (Math.abs(diff) < 0.01) {
        setRemainingText('0% left');
        setIsBalanced(true);
      } else {
        setRemainingText(`${diff.toFixed(1)}% remaining`);
        setIsBalanced(false);
      }
    }
  };

  const handleCheckboxChange = (userId, checked) => {
    setParticipantSelection(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        checked,
        val: checked ? prev[userId].val : '' // clear val if unchecked
      }
    }));
  };

  const handleValChange = (userId, val) => {
    setParticipantSelection(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        val
      }
    }));
  };

  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!isBalanced) return;

    const selected = Object.entries(participantSelection).filter(([_, data]) => data.checked);
    const participants = selected.map(([uId, data]) => {
      const p = { userId: uId };
      if (splitType === 'EXACT') {
        p.amount = parseFloat(data.val) || 0;
      } else if (splitType === 'PERCENTAGE') {
        p.percentage = parseFloat(data.val) || 0;
      }
      return p;
    });

    const currentUser = JSON.parse(localStorage.getItem('user'));

    try {
      const res = await apiRequest('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          description,
          totalAmount: parseFloat(totalAmount),
          splitType,
          participants,
          groupId: groupId || null,
          paidBy: currentUser ? currentUser.id : null
        })
      });

      if (res && res.data) {
        showToast('Expense created successfully!', 'success');
        // Reset states
        setDescription('');
        setTotalAmount('');
        setGroupId('');
        setSplitType('EQUAL');
        onCloseAddExpenseModal();
        fetchExpenses();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const showExpenseDetail = async (expenseId) => {
    try {
      const res = await apiRequest(`/expenses/${expenseId}`);
      if (res && res.data) {
        const exp = res.data.expense;
        const detailsStr = exp.splits.map(s => 
          `${s.user_name}: $${Number(s.amount).toFixed(2)}${s.percentage ? ` (${s.percentage}%)` : ''}`
        ).join('\n');
        
        alert(`Expense: ${exp.description}\nTotal Paid: $${Number(exp.total_amount).toFixed(2)}\nPaid By: ${exp.paid_by_name || 'Group member'}\n\nSplits:\n${detailsStr}`);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user'));

  return (
    <div className="app-panel">
      <div className="card-wrapper">
        <div className="section-header">
          <h3>Full Expenses Ledger</h3>
          {pagination && pagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button 
                type="button" 
                className="pagination-btn"
                disabled={!pagination.hasPrevPage}
                onClick={() => onLedgerPageChange(ledgerPage - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                type="button" 
                className="pagination-btn"
                disabled={!pagination.hasNextPage}
                onClick={() => onLedgerPageChange(ledgerPage + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Group</th>
                <th>Total Amount</th>
                <th>Paid By</th>
                <th>Split Type</th>
                <th>Date</th>
                <th className="actions-col">Details</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length > 0 ? (
                expenses.map(exp => {
                  const isPayer = exp.paid_by === (currentUser ? currentUser.id : null);
                  const date = new Date(exp.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <tr key={exp.id}>
                      <td><strong>{exp.description}</strong></td>
                      <td>
                        {exp.group_name ? (
                          <span className="badge bg-green">{exp.group_name}</span>
                        ) : (
                          <span className="badge bg-red" style={{backgroundColor:'#f1f5f9', color:'#64748b'}}>P2P</span>
                        )}
                      </td>
                      <td>${Number(exp.total_amount).toFixed(2)}</td>
                      <td>{isPayer ? 'You' : exp.paid_by_name}</td>
                      <td><span className="badge bg-orange">{exp.split_type}</span></td>
                      <td>{date}</td>
                      <td className="actions-col">
                        <button 
                          type="button" 
                          className="btn btn-secondary btn-sm"
                          onClick={() => showExpenseDetail(exp.id)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="text-center empty-state">No expense records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD EXPENSE MODAL --- */}
      {showAddExpenseModal && (
        <div className="modal show">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add New Expense Split</h3>
                <button type="button" className="modal-close" onClick={onCloseAddExpenseModal}>
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSubmitExpense}>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="form-group col-6">
                      <label htmlFor="modal-exp-desc">Description</label>
                      <input 
                        type="text" 
                        id="modal-exp-desc" 
                        placeholder="e.g. Internet Bill" 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required 
                      />
                    </div>
                    <div className="form-group col-6">
                      <label htmlFor="modal-exp-amt">Total Amount ($)</label>
                      <input 
                        type="number" 
                        id="modal-exp-amt" 
                        step="0.01" 
                        min="0.01" 
                        placeholder="0.00" 
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group col-6">
                      <label htmlFor="modal-exp-grp">Associate with Group</label>
                      <select 
                        id="modal-exp-grp"
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                      >
                        <option value="">Non-group expense (P2P)</option>
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group col-6">
                      <label htmlFor="modal-exp-type">Split Logic</label>
                      <select 
                        id="modal-exp-type"
                        value={splitType}
                        onChange={(e) => setSplitType(e.target.value)}
                        required
                      >
                        <option value="EQUAL">Split Equally</option>
                        <option value="EXACT">Exact Split (Amounts)</option>
                        <option value="PERCENTAGE">Percentage Split</option>
                      </select>
                    </div>
                  </div>

                  <div className="split-participants-widget">
                    <div className="widget-header">
                      <h4>Split Participants</h4>
                      <p className="widget-subtitle">Select members and split amounts.</p>
                    </div>

                    <div className="participants-list-inputs">
                      {groupMembers.map(u => {
                        const isMe = u.id === (currentUser ? currentUser.id : null);
                        const selData = participantSelection[u.id] || { checked: false, val: '' };
                        return (
                          <div 
                            key={u.id} 
                            className={`participant-row ${selData.checked ? 'active' : ''}`}
                          >
                            <div className="part-left">
                              <input 
                                type="checkbox"
                                checked={selData.checked}
                                disabled={isMe} // Payer must participate
                                onChange={(e) => handleCheckboxChange(u.id, e.target.checked)}
                              />
                              <span className="part-name">{u.name} {isMe ? '(You)' : ''}</span>
                            </div>

                            {splitType !== 'EQUAL' && selData.checked && (
                              <div className="part-right">
                                <input 
                                  type="number"
                                  className="part-val-input"
                                  step={splitType === 'PERCENTAGE' ? '0.1' : '0.01'}
                                  min="0"
                                  placeholder="0.00"
                                  value={selData.val}
                                  onChange={(e) => handleValChange(u.id, e.target.value)}
                                  required
                                />
                                <span className="part-suffix">
                                  {splitType === 'PERCENTAGE' ? '%' : '$'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="split-validation-bar">
                      <div className="validation-message">
                        Status: <strong>{remainingText}</strong>
                      </div>
                      <div className={`validation-status badge ${isBalanced ? 'bg-green' : 'bg-red'}`}>
                        {isBalanced ? 'Balanced' : 'Unbalanced'}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={onCloseAddExpenseModal}>
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={!isBalanced}
                  >
                    Save Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
