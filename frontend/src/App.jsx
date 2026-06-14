import React, { useState, useEffect } from 'react';
import { apiRequest } from './utils/api';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Groups from './components/Groups';
import Expenses from './components/Expenses';
import Settlements from './components/Settlements';
import CsvImport from './components/CsvImport';
import { Plus, CheckCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activePanel, setActivePanel] = useState('panel-dashboard');
  
  // Dynamic lists caches
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  
  // Shared refresh triggers
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [toasts, setToasts] = useState([]);

  // Modal toggle states
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showSettle, setShowSettle] = useState(false);

  // Auto-redirect on unauthorized API responses
  useEffect(() => {
    const handleAuthExpired = () => {
      setToken(null);
      setUser(null);
      setActivePanel('panel-dashboard');
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  // Fetch initial select lists
  useEffect(() => {
    if (token && user) {
      fetchGlobalData();
    }
  }, [token, refreshTrigger]);

  const fetchGlobalData = async () => {
    try {
      const usersRes = await apiRequest('/auth/users');
      if (usersRes && usersRes.data) {
        setUsers(usersRes.data.users || []);
      }
      
      const groupsRes = await apiRequest('/groups');
      if (groupsRes && groupsRes.data) {
        setGroups(groupsRes.data.groups || []);
      }
    } catch (err) {}
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto-remove toast
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleAuthSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    setActivePanel('panel-dashboard');
    showToast(`Successfully signed in as ${newUser.name}!`, 'success');
  };

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setActivePanel('panel-dashboard');
    showToast('You have signed out.', 'info');
  };

  const getPanelTitle = () => {
    const titleMap = {
      'panel-dashboard': 'Dashboard',
      'panel-groups': 'Groups Management',
      'panel-expenses': 'Expenses Ledger',
      'panel-settlements': 'Settlements Engine',
      'panel-csv': 'CSV Imports'
    };
    return titleMap[activePanel] || 'ExpenseFlow';
  };

  if (!token || !user) {
    return (
      <>
        <ToastContainer toasts={toasts} />
        <Auth onAuthSuccess={handleAuthSuccess} showToast={showToast} />
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} />
      
      <div className="app-screen">
        {/* Sidebar Navigation */}
        <Sidebar 
          user={user} 
          activePanel={activePanel} 
          onPanelChange={setActivePanel} 
          onLogout={handleLogout} 
        />

        {/* Main Viewport */}
        <main className="main-viewport">
          <header className="main-header">
            <h1>{getPanelTitle()}</h1>
            <div className="header-actions">
              <button 
                type="button" 
                className="btn btn-accent"
                onClick={() => setShowAddExpense(true)}
              >
                <Plus size={16} />
                <span>Add Expense</span>
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowSettle(true)}
              >
                <CheckCircle size={16} />
                <span>Record Payment</span>
              </button>
            </div>
          </header>

          <div className="panels-container">
            {activePanel === 'panel-dashboard' && (
              <Dashboard 
                user={user} 
                refreshTrigger={refreshTrigger} 
                showToast={showToast} 
              />
            )}

            {activePanel === 'panel-groups' && (
              <Groups 
                users={users}
                groups={groups} 
                onGroupsChange={triggerRefresh} 
                showToast={showToast} 
              />
            )}

            {activePanel === 'panel-expenses' && (
              <Expenses 
                users={users}
                groups={groups}
                ledgerPage={ledgerPage}
                onLedgerPageChange={setLedgerPage}
                refreshTrigger={refreshTrigger}
                showToast={showToast}
                showAddExpenseModal={showAddExpense}
                onCloseAddExpenseModal={() => {
                  setShowAddExpense(false);
                  triggerRefresh();
                }}
              />
            )}

            {activePanel === 'panel-settlements' && (
              <Settlements 
                users={users}
                groups={groups}
                refreshTrigger={refreshTrigger}
                onRecordSettlementSuccess={triggerRefresh}
                showToast={showToast}
                showSettleModal={showSettle}
                onCloseSettleModal={() => {
                  setShowSettle(false);
                  triggerRefresh();
                }}
              />
            )}

            {activePanel === 'panel-csv' && (
              <CsvImport 
                refreshTrigger={refreshTrigger}
                onImportSuccess={triggerRefresh}
                showToast={showToast}
              />
            )}
          </div>
        </main>
      </div>
    </>
  );
}

// Subcomponent: Toast Notification Manager
function ToastContainer({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map(t => {
        let Icon = CheckCircle2;
        if (t.type === 'error') Icon = AlertTriangle;
        if (t.type === 'info') Icon = Info;
        
        return (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon size={18} />
            <div className="toast-content">{t.message}</div>
          </div>
        );
      })}
    </div>
  );
}
