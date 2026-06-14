import React from 'react';
import { 
  Wallet, 
  LayoutDashboard, 
  Users, 
  Receipt, 
  HandCoins, 
  FileSpreadsheet, 
  BookOpen, 
  LogOut 
} from 'lucide-react';

export default function Sidebar({ user, activePanel, onPanelChange, onLogout }) {
  const avatarChar = user ? user.name.charAt(0).toUpperCase() : 'U';

  const menuItems = [
    { id: 'panel-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'panel-groups', label: 'Groups', icon: Users },
    { id: 'panel-expenses', label: 'Expenses', icon: Receipt },
    { id: 'panel-settlements', label: 'Settlements', icon: HandCoins },
    { id: 'panel-csv', label: 'CSV Import', icon: FileSpreadsheet },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <Wallet className="logo-icon" />
        <span>ExpenseFlow</span>
      </div>

      {user && (
        <div className="user-profile-widget">
          <div className="user-avatar">{avatarChar}</div>
          <div className="user-info">
            <h4>{user.name}</h4>
            <p>{user.email}</p>
          </div>
        </div>
      )}

      <nav className="sidebar-menu">
        {menuItems.map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`menu-item ${activePanel === item.id ? 'active' : ''}`}
              onClick={() => onPanelChange(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <a 
          href="http://localhost:5000/api-docs" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="menu-item api-docs-btn"
        >
          <BookOpen size={20} />
          <span>API Docs</span>
        </a>
        <button 
          type="button" 
          className="menu-item logout-btn"
          onClick={onLogout}
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
