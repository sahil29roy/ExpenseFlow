import React, { useState } from 'react';
import { apiRequest } from '../utils/api';
import { Wallet, Mail, Lock, User, UserPlus, ArrowRight } from 'lucide-react';

export default function Auth({ onAuthSuccess, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const body = isLogin 
        ? { email, password } 
        : { name, email, password };

      const res = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
      });

      if (res && res.data) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        showToast(isLogin ? `Welcome back, ${res.data.user.name}!` : 'Account registered successfully!', 'success');
        onAuthSuccess(res.data.token, res.data.user);
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo">
            <Wallet className="logo-icon" />
            <span>ExpenseFlow</span>
          </div>
          <p className="auth-subtitle">Simplify your group bills and settlements</p>
        </div>

        <div className="auth-tabs">
          <button 
            type="button" 
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </button>
          <button 
            type="button" 
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="reg-name">Full Name</label>
              <div className="input-icon-wrapper">
                <User />
                <input 
                  type="text" 
                  id="reg-name" 
                  placeholder="John Doe" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required 
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="auth-email">Email Address</label>
            <div className="input-icon-wrapper">
              <Mail />
              <input 
                type="email" 
                id="auth-email" 
                placeholder="name@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="auth-password">Password</label>
            <div className="input-icon-wrapper">
              <Lock />
              <input 
                type="password" 
                id="auth-password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block">
            <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
            {isLogin ? <ArrowRight size={18} /> : <UserPlus size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
