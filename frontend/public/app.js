// Single Page Application State & Logic Controller
const API_URL = 'http://localhost:5000/api';

const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  activePanel: 'panel-dashboard',
  users: [],           // Cached list of all registered users
  groups: [],          // Cached list of user's groups
  selectedGroup: null, // Currently selected group detail info
  dashboardPage: 1,
  ledgerPage: 1,
  pageSize: 5
};

// --- APPLICATION INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  registerEventListeners();
});

function initApp() {
  if (state.token && state.user) {
    showAppScreen();
    switchPanel('panel-dashboard');
    fetchInitialData();
  } else {
    showAuthScreen();
  }
  lucide.createIcons();
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
}

function showAppScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  
  if (state.user) {
    document.getElementById('user-profile-name').textContent = state.user.name;
    document.getElementById('user-profile-email').textContent = state.user.email;
    document.getElementById('user-avatar-lbl').textContent = state.user.name.charAt(0).toUpperCase();
  }
}

function fetchInitialData() {
  fetchUsers();
  fetchGroups();
}

// --- GENERAL EVENT ROUTING ---
function registerEventListeners() {
  // 1. Auth screen tab toggle
  document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  });

  document.getElementById('tab-register').addEventListener('click', () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
  });

  // 2. Auth Submit Handlers
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    await loginAction(email, password);
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    await registerAction(name, email, password);
  });

  // 3. Logout action
  document.getElementById('logout-btn').addEventListener('click', () => {
    logoutAction();
  });

  // 4. Panel Navigation click router
  document.querySelectorAll('.sidebar-menu .menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchPanel(target);
    });
  });

  // 5. Trigger buttons for Modal popups
  document.getElementById('btn-trigger-expense').addEventListener('click', () => {
    openModal('modal-add-expense');
    prepareExpenseModalForm();
  });

  document.getElementById('btn-trigger-settle').addEventListener('click', () => {
    openModal('modal-record-settlement');
    prepareSettlementModalForm();
  });

  document.getElementById('btn-create-group-trigger').addEventListener('click', () => {
    openModal('modal-create-group');
  });

  // 6. Generic Modal Close bindings
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-close');
      closeModal(target);
    });
  });

  // 7. Modal forms submits
  document.getElementById('form-create-group').addEventListener('submit', handleCreateGroupSubmit);
  document.getElementById('form-add-expense').addEventListener('submit', handleAddExpenseSubmit);
  document.getElementById('form-record-settlement').addEventListener('submit', handleRecordSettlementSubmit);
  document.getElementById('form-add-member').addEventListener('submit', handleAddMemberSubmit);

  // 8. Expense Form field reactive validation triggers
  document.getElementById('exp-amount').addEventListener('input', updateSplitInputsMath);
  document.getElementById('exp-split-type').addEventListener('change', () => {
    renderExpenseParticipantsInputs();
    updateSplitInputsMath();
  });

  // 9. CSV drag-and-drop elements
  setupCsvUploader();
}

// --- CORE PANEL STATE MANAGER ---
function switchPanel(panelId) {
  state.activePanel = panelId;
  
  document.querySelectorAll('.app-panel').forEach(panel => {
    if (panel.id === panelId) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });

  document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
    if (item.getAttribute('data-target') === panelId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const titleMap = {
    'panel-dashboard': 'Dashboard',
    'panel-groups': 'Groups Management',
    'panel-expenses': 'Expenses Ledger',
    'panel-settlements': 'Settlements Engine',
    'panel-csv': 'CSV File Imports'
  };
  document.getElementById('viewport-title').textContent = titleMap[panelId] || 'ExpenseFlow';

  // Lazy loaders
  if (panelId === 'panel-dashboard') {
    loadDashboard();
  } else if (panelId === 'panel-groups') {
    loadGroupsPanel();
  } else if (panelId === 'panel-expenses') {
    loadExpensesLedger();
  } else if (panelId === 'panel-settlements') {
    loadSettlementsPanel();
  }
}

// --- API COMMUNICATIONS UTILITIES ---
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = { ...options, headers };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401) {
      showToast('Session expired. Please log in again.', 'error');
      logoutAction();
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || 'API request failed.');
    }

    return data;
  } catch (error) {
    showToast(error.message, 'error');
    throw error;
  }
}

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconName = 'check-circle';
  if (type === 'error') iconName = 'alert-triangle';
  if (type === 'warning') iconName = 'alert-circle';
  
  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <div class="toast-content">${message}</div>
  `;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- MODAL HELPERS ---
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('show');
  lucide.createIcons();
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
}

// --- AUTH ACTIONS ---
async function loginAction(email, password) {
  try {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res && res.data) {
      state.token = res.data.token;
      state.user = res.data.user;
      localStorage.setItem('token', state.token);
      localStorage.setItem('user', JSON.stringify(state.user));
      
      showAppScreen();
      switchPanel('panel-dashboard');
      fetchInitialData();
      showToast(`Welcome back, ${state.user.name}!`, 'success');
    }
  } catch (err) {}
}

async function registerAction(name, email, password) {
  try {
    const res = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });

    if (res && res.data) {
      state.token = res.data.token;
      state.user = res.data.user;
      localStorage.setItem('token', state.token);
      localStorage.setItem('user', JSON.stringify(state.user));
      
      showAppScreen();
      switchPanel('panel-dashboard');
      fetchInitialData();
      showToast(`Account created successfully!`, 'success');
    }
  } catch (err) {}
}

function logoutAction() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
  showAuthScreen();
  showToast('You have been logged out.', 'info');
}

// --- USER AND GROUP FETCHERS ---
async function fetchUsers() {
  try {
    const res = await apiRequest('/auth/users');
    if (res && res.data) {
      state.users = res.data.users;
    }
  } catch (err) {}
}

async function fetchGroups() {
  try {
    const res = await apiRequest('/groups');
    if (res && res.data) {
      state.groups = res.data.groups;
    }
  } catch (err) {}
}

// --- 1. DASHBOARD LOADER ---
async function loadDashboard() {
  try {
    const res = await apiRequest(`/dashboard?limit=${state.pageSize}&page=${state.dashboardPage}`);
    if (res && res.data) {
      const { metrics, recentExpenses, pagination } = res.data;
      
      // Update Metrics UI
      document.getElementById('metric-spent').textContent = `$${metrics.totalAmountSpent.toFixed(2)}`;
      document.getElementById('metric-owes').textContent = `$${metrics.amountUserOwes.toFixed(2)}`;
      document.getElementById('metric-owed-by').textContent = `$${metrics.amountUserGetsBack.toFixed(2)}`;
      
      const net = metrics.netBalance;
      const netEl = document.getElementById('metric-net');
      if (net > 0) {
        netEl.textContent = `+$${net.toFixed(2)}`;
        netEl.className = 'text-green';
      } else if (net < 0) {
        netEl.textContent = `-$${Math.abs(net).toFixed(2)}`;
        netEl.className = 'text-red';
      } else {
        netEl.textContent = `$0.00`;
        netEl.className = '';
      }

      // Render Recent activity feed
      const feedContainer = document.getElementById('dashboard-recent-expenses');
      if (recentExpenses && recentExpenses.length > 0) {
        feedContainer.innerHTML = recentExpenses.map(exp => {
          const isPayer = exp.paid_by === state.user.id;
          const formattedDate = new Date(exp.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          return `
            <div class="feed-item">
              <div class="feed-item-left">
                <div class="feed-icon">
                  <i data-lucide="receipt"></i>
                </div>
                <div class="feed-info">
                  <h4>${escapeHtml(exp.description)}</h4>
                  <p>${exp.group_name ? `Group: ${escapeHtml(exp.group_name)}` : 'Personal split'} • Paid by ${isPayer ? 'You' : escapeHtml(exp.paid_by_name)}</p>
                </div>
              </div>
              <div class="feed-item-right">
                <span class="feed-amount ${isPayer ? 'text-green' : 'text-red'}">
                  $${Number(exp.total_amount).toFixed(2)}
                </span>
                <p class="feed-split-detail">${formattedDate}</p>
              </div>
            </div>
          `;
        }).join('');
        
        // Render Mini pagination controls
        renderPaginationControls('dashboard-feed-pages', pagination, (newPage) => {
          state.dashboardPage = newPage;
          loadDashboard();
        });
      } else {
        feedContainer.innerHTML = '<p class="empty-state">No recent activity found.</p>';
      }

      // Render Pairwise debt balances
      const balanceDetails = await apiRequest('/expenses/balances');
      if (balanceDetails && balanceDetails.data) {
        const { owes, owedBy } = balanceDetails.data.balances;
        
        const owesContainer = document.getElementById('owes-list');
        if (owes && owes.length > 0) {
          owesContainer.innerHTML = owes.map(debt => `
            <li>
              <span class="user-name">${escapeHtml(debt.name)}</span>
              <span class="balance-val text-red">You owe $${debt.amount.toFixed(2)}</span>
            </li>
          `).join('');
        } else {
          owesContainer.innerHTML = '<li class="empty-state mini">You do not owe anyone!</li>';
        }

        const owedByContainer = document.getElementById('owed-by-list');
        if (owedBy && owedBy.length > 0) {
          owedByContainer.innerHTML = owedBy.map(credit => `
            <li>
              <span class="user-name">${escapeHtml(credit.name)}</span>
              <span class="balance-val text-green">Owes you $${credit.amount.toFixed(2)}</span>
            </li>
          `).join('');
        } else {
          owedByContainer.innerHTML = '<li class="empty-state mini">No one owes you money.</li>';
        }
      }

      lucide.createIcons();
    }
  } catch (err) {}
}

// --- 2. GROUPS PANEL LOADER ---
async function loadGroupsPanel() {
  try {
    await fetchGroups();
    const listContainer = document.getElementById('groups-list-container');
    
    if (state.groups && state.groups.length > 0) {
      listContainer.innerHTML = state.groups.map(group => `
        <div class="group-card-item ${state.selectedGroup && state.selectedGroup.id === group.id ? 'active' : ''}" onclick="selectGroup('${group.id}')">
          <div>
            <h4>${escapeHtml(group.name)}</h4>
            <p>${group.description ? escapeHtml(group.description) : 'No description'}</p>
          </div>
          <i data-lucide="chevron-right"></i>
        </div>
      `).join('');
      lucide.createIcons();
      
      // Auto-select first group if none is selected
      if (!state.selectedGroup) {
        selectGroup(state.groups[0].id);
      } else {
        // Refresh detail view
        selectGroup(state.selectedGroup.id);
      }
    } else {
      listContainer.innerHTML = '<p class="empty-state">No group memberships. Create one above!</p>';
      document.getElementById('group-details-box').innerHTML = `
        <div class="empty-state-large">
          <i data-lucide="users" class="large-icon"></i>
          <h3>Select or Create a Group</h3>
          <p>Create groups to track shared receipts between friends, roommates or projects.</p>
        </div>
      `;
      lucide.createIcons();
    }
  } catch (err) {}
}

async function selectGroup(groupId) {
  try {
    const res = await apiRequest(`/groups/${groupId}`);
    if (res && res.data) {
      state.selectedGroup = res.data.group;
      const members = res.data.members;

      // Make active group card highlighted
      document.querySelectorAll('.group-card-item').forEach(card => {
        card.classList.remove('active');
      });
      // Try to find the selected element to add active class
      loadGroupsPanelListActiveState(groupId);

      const isCreator = state.selectedGroup.created_by === state.user.id;

      const detailsBox = document.getElementById('group-details-box');
      detailsBox.innerHTML = `
        <div class="group-detail-view">
          <div class="group-detail-header">
            <div>
              <h2>${escapeHtml(state.selectedGroup.name)}</h2>
              <p class="section-subtitle">${state.selectedGroup.description ? escapeHtml(state.selectedGroup.description) : 'No description'}</p>
            </div>
            ${isCreator ? `
              <button class="btn btn-secondary btn-sm text-red" onclick="deleteGroupAction('${state.selectedGroup.id}')">
                <i data-lucide="trash-2"></i>
                <span>Delete Group</span>
              </button>
            ` : ''}
          </div>

          <div class="group-members-section">
            <div class="section-header">
              <h4>Members (${members.length})</h4>
              <button class="btn btn-secondary btn-sm" onclick="triggerAddMemberModal('${state.selectedGroup.id}')">
                <i data-lucide="user-plus"></i>
                <span>Add Member</span>
              </button>
            </div>
            
            <div class="members-chips">
              ${members.map(m => `
                <div class="member-chip">
                  <span>${escapeHtml(m.name)}</span>
                  ${(members.length > 1 && m.id !== state.selectedGroup.created_by) ? `
                    <button onclick="removeMemberAction('${state.selectedGroup.id}', '${m.id}')">
                      <i data-lucide="x"></i>
                    </button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      lucide.createIcons();
    }
  } catch (err) {}
}

function loadGroupsPanelListActiveState(activeId) {
  // Add class active to currently selected group item in sidebar list
  const container = document.getElementById('groups-list-container');
  if (container) {
    const cards = container.children;
    for (let card of cards) {
      if (card.getAttribute('onclick') && card.getAttribute('onclick').includes(activeId)) {
        card.classList.add('active');
      }
    }
  }
}

// --- 3. EXPENSES LEDGER ---
async function loadExpensesLedger() {
  try {
    const res = await apiRequest(`/expenses?limit=${state.pageSize}&page=${state.ledgerPage}`);
    const tableBody = document.getElementById('expenses-table-body');
    
    if (res && res.data) {
      const { expenses, pagination } = res.data;

      if (expenses && expenses.length > 0) {
        tableBody.innerHTML = expenses.map(exp => {
          const isPayer = exp.paid_by === state.user.id;
          const date = new Date(exp.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });

          // Fetch split description
          let splitStr = '';
          const mySplit = exp.splits.find(s => s.user_id === state.user.id);
          if (mySplit) {
            if (isPayer) {
              const netCollect = Number(exp.total_amount) - Number(mySplit.amount);
              splitStr = `<span class="text-green">Owed $${netCollect.toFixed(2)}</span>`;
            } else {
              splitStr = `<span class="text-red">You owe $${Number(mySplit.amount).toFixed(2)}</span>`;
            }
          } else {
            splitStr = '<span>Not involved</span>';
          }

          return `
            <tr>
              <td>
                <strong>${escapeHtml(exp.description)}</strong>
              </td>
              <td>${exp.group_name ? `<span class="badge bg-green">${escapeHtml(exp.group_name)}</span>` : 'P2P'}</td>
              <td>$${Number(exp.total_amount).toFixed(2)}</td>
              <td>${isPayer ? 'You' : escapeHtml(exp.paid_by_name)}</td>
              <td><span class="badge bg-orange">${exp.split_type}</span></td>
              <td>${date}</td>
              <td class="actions-col">
                <button class="btn btn-secondary btn-sm" onclick="showExpenseDetailModal('${exp.id}')">Details</button>
              </td>
            </tr>
          `;
        }).join('');

        renderPaginationControls('expenses-ledger-pagination', pagination, (newPage) => {
          state.ledgerPage = newPage;
          loadExpensesLedger();
        });
      } else {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center empty-state">No expense records found.</td></tr>';
        document.getElementById('expenses-ledger-pagination').innerHTML = '';
      }
    }
  } catch (err) {}
}

// --- 4. SETTLEMENTS PANEL ---
async function loadSettlementsPanel() {
  try {
    // 1. Get simplified settlements recommended
    const resRecs = await apiRequest('/expenses/settlements');
    const recsContainer = document.getElementById('simplified-settlements-list');
    
    if (resRecs && resRecs.data && resRecs.data.settlements && resRecs.data.settlements.length > 0) {
      recsContainer.innerHTML = resRecs.data.settlements.map(rec => `
        <div class="settle-card">
          <div class="settle-flow">
            <span class="settle-user">${escapeHtml(rec.from.name)}</span>
            <span class="settle-arrow">
              pays
              <i data-lucide="arrow-right"></i>
            </span>
            <span class="settle-user">${escapeHtml(rec.to.name)}</span>
          </div>
          <div class="settle-amount">$${rec.amount.toFixed(2)}</div>
        </div>
      `).join('');
    } else {
      recsContainer.innerHTML = '<p class="empty-state">No settlements recommended. Everyone is even!</p>';
    }

    // 2. Get recorded settlements list
    const resHist = await apiRequest('/settlements');
    const histContainer = document.getElementById('recorded-settlements-list');
    
    if (resHist && resHist.data && resHist.data.length > 0) {
      histContainer.innerHTML = resHist.data.map(settle => {
        const isPayer = settle.payer_id === state.user.id;
        const date = new Date(settle.settled_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
        return `
          <div class="settlement-item">
            <div class="feed-item-left">
              <div class="feed-icon" style="background-color: #ecfdf5; color: #10b981;">
                <i data-lucide="check-circle2"></i>
              </div>
              <div class="feed-info">
                <h4>Payment Recorded</h4>
                <p>
                  <strong>${isPayer ? 'You' : escapeHtml(settle.payer_name)}</strong> paid 
                  <strong>${settle.payee_id === state.user.id ? 'You' : escapeHtml(settle.payee_name)}</strong>
                </p>
              </div>
            </div>
            <div class="feed-item-right">
              <span class="feed-amount text-green">$${Number(settle.amount).toFixed(2)}</span>
              <p class="feed-split-detail">${date}</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      histContainer.innerHTML = '<p class="empty-state">No settlement payments recorded yet.</p>';
    }

    lucide.createIcons();
  } catch (err) {}
}

// --- PAGINATION RENDERING CONTROLS ---
function renderPaginationControls(elementId, pagination, onPageChange) {
  const container = document.getElementById(elementId);
  if (!pagination) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button class="pagination-btn" id="${elementId}-prev" ${!pagination.hasPrevPage ? 'disabled' : ''}>
      <i data-lucide="chevron-left"></i>
    </button>
    <span class="pagination-info">Page ${pagination.page} of ${pagination.totalPages || 1}</span>
    <button class="pagination-btn" id="${elementId}-next" ${!pagination.hasNextPage ? 'disabled' : ''}>
      <i data-lucide="chevron-right"></i>
    </button>
  `;
  lucide.createIcons();

  document.getElementById(`${elementId}-prev`).addEventListener('click', () => {
    onPageChange(pagination.page - 1);
  });
  document.getElementById(`${elementId}-next`).addEventListener('click', () => {
    onPageChange(pagination.page + 1);
  });
}

// --- MODAL ACTION PREPARATIONS ---
async function prepareExpenseModalForm() {
  await fetchUsers();
  await fetchGroups();

  // Populate Groups dropdown
  const groupSelect = document.getElementById('exp-group');
  groupSelect.innerHTML = '<option value="">Non-group expense (P2P)</option>';
  state.groups.forEach(g => {
    groupSelect.innerHTML += `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
  });

  // Re-render split inputs list initially based on P2P context (all users selected)
  renderExpenseParticipantsInputs();
  updateSplitInputsMath();

  // Listen to group dropdown changes to update participant list (limit to group members)
  groupSelect.onchange = async () => {
    await renderExpenseParticipantsInputs();
    updateSplitInputsMath();
  };
}

async function renderExpenseParticipantsInputs() {
  const groupId = document.getElementById('exp-group').value;
  const splitType = document.getElementById('exp-split-type').value;
  const container = document.getElementById('expense-participants-wrapper');
  container.innerHTML = '';

  let splitUsers = [];
  if (groupId) {
    // Fetch group members
    try {
      const res = await apiRequest(`/groups/${groupId}/members`);
      if (res && res.data) {
        splitUsers = res.data.members;
      }
    } catch (err) {}
  } else {
    // Non-group (use all users)
    splitUsers = state.users;
  }

  if (splitUsers.length === 0) {
    container.innerHTML = '<p class="empty-state mini text-center">No participants available.</p>';
    return;
  }

  container.innerHTML = splitUsers.map(u => {
    const isMe = u.id === state.user.id;
    let inputField = '';
    
    if (splitType === 'EXACT') {
      inputField = `
        <div class="part-right">
          <input type="number" class="part-val-input participant-share-input" step="0.01" min="0" placeholder="0.00" data-user-id="${u.id}">
          <span class="part-suffix">$</span>
        </div>
      `;
    } else if (splitType === 'PERCENTAGE') {
      inputField = `
        <div class="part-right">
          <input type="number" class="part-val-input participant-share-input" step="0.1" min="0" max="100" placeholder="0" data-user-id="${u.id}">
          <span class="part-suffix">%</span>
        </div>
      `;
    }

    return `
      <div class="participant-row" id="row-participant-${u.id}">
        <div class="part-left">
          <input type="checkbox" class="participant-checkbox" data-user-id="${u.id}" ${isMe ? 'checked disabled' : 'checked'}>
          <span class="part-name">${escapeHtml(mName(u.name, isMe))}</span>
        </div>
        ${inputField}
      </div>
    `;
  }).join('');

  // Re-bind input listeners
  document.querySelectorAll('.participant-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const uId = chk.getAttribute('data-user-id');
      const row = document.getElementById(`row-participant-${uId}`);
      
      const input = row.querySelector('.participant-share-input');
      if (chk.checked) {
        row.classList.add('active');
        if (input) input.disabled = false;
      } else {
        row.classList.remove('active');
        if (input) {
          input.disabled = true;
          input.value = '';
        }
      }
      updateSplitInputsMath();
    });
  });

  document.querySelectorAll('.participant-share-input').forEach(input => {
    input.addEventListener('input', updateSplitInputsMath);
  });
}

function mName(name, isMe) {
  return isMe ? `${name} (You)` : name;
}

// --- REACTIVE MATHEMATICAL SPLITS VALIDATION ---
function updateSplitInputsMath() {
  const totalAmount = parseFloat(document.getElementById('exp-amount').value) || 0;
  const splitType = document.getElementById('exp-split-type').value;
  const submitBtn = document.getElementById('btn-submit-expense');
  const remAmountEl = document.getElementById('split-remaining-amount');
  const validationStatusEl = document.getElementById('split-validation-status');

  // Find all checked boxes
  const checkedBoxes = Array.from(document.querySelectorAll('.participant-checkbox:checked'));
  const checkedUserIds = checkedBoxes.map(chk => chk.getAttribute('data-user-id'));

  if (totalAmount <= 0) {
    remAmountEl.textContent = '$0.00';
    validationStatusEl.textContent = 'Unbalanced';
    validationStatusEl.className = 'validation-status badge bg-red';
    submitBtn.disabled = true;
    return;
  }

  if (checkedUserIds.length === 0) {
    remAmountEl.textContent = 'Select participants';
    validationStatusEl.textContent = 'Unbalanced';
    validationStatusEl.className = 'validation-status badge bg-red';
    submitBtn.disabled = true;
    return;
  }

  if (splitType === 'EQUAL') {
    // Equal splits are always balanced by definition
    const perPerson = totalAmount / checkedUserIds.length;
    remAmountEl.textContent = `$${perPerson.toFixed(2)} each`;
    validationStatusEl.textContent = 'Balanced';
    validationStatusEl.className = 'validation-status badge bg-green';
    submitBtn.disabled = false;
    return;
  }

  // Get inputs
  const inputs = Array.from(document.querySelectorAll('.participant-share-input:not(:disabled)'));
  let totalInputSum = 0;

  inputs.forEach(inp => {
    totalInputSum += parseFloat(inp.value) || 0;
  });

  if (splitType === 'EXACT') {
    const diff = totalAmount - totalInputSum;
    if (Math.abs(diff) < 0.01) {
      remAmountEl.textContent = '$0.00 left';
      validationStatusEl.textContent = 'Balanced';
      validationStatusEl.className = 'validation-status badge bg-green';
      submitBtn.disabled = false;
    } else {
      remAmountEl.textContent = `$${diff.toFixed(2)} remaining`;
      validationStatusEl.textContent = 'Unbalanced';
      validationStatusEl.className = 'validation-status badge bg-red';
      submitBtn.disabled = true;
    }
  } else if (splitType === 'PERCENTAGE') {
    const diff = 100.0 - totalInputSum;
    if (Math.abs(diff) < 0.01) {
      remAmountEl.textContent = '0% left';
      validationStatusEl.textContent = 'Balanced';
      validationStatusEl.className = 'validation-status badge bg-green';
      submitBtn.disabled = false;
    } else {
      remAmountEl.textContent = `${diff.toFixed(1)}% remaining`;
      validationStatusEl.textContent = 'Unbalanced';
      validationStatusEl.className = 'validation-status badge bg-red';
      submitBtn.disabled = true;
    }
  }
}

// --- SUBMIT HANDLERS ---
async function handleCreateGroupSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('group-name-input').value;
  const description = document.getElementById('group-desc-input').value;

  try {
    const res = await apiRequest('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });

    if (res && res.data) {
      showToast('Group created successfully!', 'success');
      closeModal('modal-create-group');
      document.getElementById('form-create-group').reset();
      
      // Auto switch panel
      state.selectedGroup = res.data.group;
      switchPanel('panel-groups');
    }
  } catch (err) {}
}

async function handleAddExpenseSubmit(e) {
  e.preventDefault();
  const description = document.getElementById('exp-desc').value;
  const totalAmount = parseFloat(document.getElementById('exp-amount').value);
  const groupId = document.getElementById('exp-group').value || null;
  const splitType = document.getElementById('exp-split-type').value;

  const checkedBoxes = Array.from(document.querySelectorAll('.participant-checkbox:checked'));
  const participants = checkedBoxes.map(chk => {
    const uId = chk.getAttribute('data-user-id');
    const pItem = { userId: uId };

    if (splitType === 'EXACT') {
      const input = document.querySelector(`.participant-share-input[data-user-id="${uId}"]`);
      pItem.amount = parseFloat(input.value) || 0;
    } else if (splitType === 'PERCENTAGE') {
      const input = document.querySelector(`.participant-share-input[data-user-id="${uId}"]`);
      pItem.percentage = parseFloat(input.value) || 0;
    }
    return pItem;
  });

  try {
    const res = await apiRequest('/expenses', {
      method: 'POST',
      body: JSON.stringify({
        description,
        totalAmount,
        splitType,
        participants,
        groupId
      })
    });

    if (res && res.data) {
      showToast('Expense created successfully!', 'success');
      closeModal('modal-add-expense');
      document.getElementById('form-add-expense').reset();
      
      // Refresh panel
      if (state.activePanel === 'panel-dashboard') {
        loadDashboard();
      } else if (state.activePanel === 'panel-expenses') {
        loadExpensesLedger();
      }
    }
  } catch (err) {}
}

async function prepareSettlementModalForm() {
  await fetchUsers();
  await fetchGroups();

  const payeeSelect = document.getElementById('settle-payee');
  payeeSelect.innerHTML = '<option value="" disabled selected>Select user...</option>';
  state.users.forEach(u => {
    if (u.id !== state.user.id) {
      payeeSelect.innerHTML += `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`;
    }
  });

  const groupSelect = document.getElementById('settle-group');
  groupSelect.innerHTML = '<option value="">Non-group settlement</option>';
  state.groups.forEach(g => {
    groupSelect.innerHTML += `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
  });
}

async function handleRecordSettlementSubmit(e) {
  e.preventDefault();
  const payeeId = document.getElementById('settle-payee').value;
  const amount = parseFloat(document.getElementById('settle-amount').value);
  const groupId = document.getElementById('settle-group').value || null;

  try {
    const res = await apiRequest('/settlements', {
      method: 'POST',
      body: JSON.stringify({
        payeeId,
        amount,
        groupId,
        payerId: state.user.id
      })
    });

    if (res && res.data) {
      showToast('Settlement payment recorded successfully!', 'success');
      closeModal('modal-record-settlement');
      document.getElementById('form-record-settlement').reset();

      if (state.activePanel === 'panel-dashboard') {
        loadDashboard();
      } else if (state.activePanel === 'panel-settlements') {
        loadSettlementsPanel();
      }
    }
  } catch (err) {}
}

// --- GROUP WORKFLOW MEMBER MANAGEMENT ---
function triggerAddMemberModal(groupId) {
  document.getElementById('add-member-group-id').value = groupId;
  
  const select = document.getElementById('add-member-select');
  select.innerHTML = '<option value="" disabled selected>Select member...</option>';
  
  // Exclude users already in the group
  // To keep it simple, list all users
  state.users.forEach(u => {
    select.innerHTML += `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`;
  });

  openModal('modal-add-member');
}

async function handleAddMemberSubmit(e) {
  e.preventDefault();
  const groupId = document.getElementById('add-member-group-id').value;
  const userId = document.getElementById('add-member-select').value;

  try {
    const res = await apiRequest(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });

    if (res && res.data) {
      showToast('Member added to group successfully!', 'success');
      closeModal('modal-add-member');
      selectGroup(groupId);
    }
  } catch (err) {}
}

async function removeMemberAction(groupId, userId) {
  if (confirm('Are you sure you want to remove this member from the group?')) {
    try {
      const res = await apiRequest(`/groups/${groupId}/members/${userId}`, {
        method: 'DELETE'
      });
      if (res) {
        showToast('Member removed successfully!', 'success');
        selectGroup(groupId);
      }
    } catch (err) {}
  }
}

async function deleteGroupAction(groupId) {
  if (confirm('Are you sure you want to delete this group permanently?')) {
    try {
      const res = await apiRequest(`/groups/${groupId}`, {
        method: 'DELETE'
      });
      if (res) {
        showToast('Group deleted successfully.', 'success');
        state.selectedGroup = null;
        loadGroupsPanel();
      }
    } catch (err) {}
  }
}

// --- LEDGER EXPENSE DETAILS SHOW ---
async function showExpenseDetailModal(expenseId) {
  try {
    const res = await apiRequest(`/expenses/${expenseId}`);
    if (res && res.data) {
      const exp = res.data.expense;
      
      const detailsHtml = exp.splits.map(split => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #f1f5f9; padding-bottom:6px;">
          <span>${escapeHtml(split.user_name)}</span>
          <span style="font-weight:600;">$${Number(split.amount).toFixed(2)} ${split.percentage ? `(${split.percentage}%)` : ''}</span>
        </div>
      `).join('');

      showToast(`
        <div style="text-align:left;">
          <strong style="display:block; margin-bottom:6px;">${escapeHtml(exp.description)} Details</strong>
          ${detailsHtml}
        </div>
      `, 'info');
    }
  } catch (err) {}
}

// --- CSV IMPORT DRAG DROP ZONE ---
function setupCsvUploader() {
  const dropZone = document.getElementById('csv-drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  const metadataBar = document.getElementById('csv-file-metadata');
  const uploadBtn = document.getElementById('btn-upload-csv');
  let selectedFile = null;

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = 'var(--accent-light)';
    dropZone.style.borderColor = 'var(--accent)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.backgroundColor = '#f9fbf9';
    dropZone.style.borderColor = 'var(--accent-border)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.backgroundColor = '#f9fbf9';
    dropZone.style.borderColor = 'var(--accent-border)';
    
    if (e.dataTransfer.files.length > 0) {
      handleCsvFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleCsvFile(fileInput.files[0]);
    }
  });

  function handleCsvFile(file) {
    if (!file.name.endsWith('.csv')) {
      showToast('Only CSV spreadsheets are supported.', 'error');
      return;
    }
    selectedFile = file;
    document.getElementById('csv-filename').textContent = file.name;
    document.getElementById('csv-filesize').textContent = `${(file.size / 1024).toFixed(1)} KB`;
    
    metadataBar.classList.remove('hidden');
    uploadBtn.disabled = false;
  }

  document.getElementById('btn-clear-csv').addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    metadataBar.classList.add('hidden');
    uploadBtn.disabled = true;
    document.getElementById('csv-result-card').classList.add('hidden');
  });

  uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading and importing...';

    try {
      const response = await fetch(`${API_URL}/expenses/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`
        },
        body: formData
      });

      const data = await response.json();
      
      const resultCard = document.getElementById('csv-result-card');
      const detailsContainer = document.getElementById('csv-result-details');
      resultCard.classList.remove('hidden');

      if (response.ok && data.data && data.data.success) {
        showToast(data.message || 'CSV Imported successfully!', 'success');
        const report = data.data.report;
        
        detailsContainer.innerHTML = `
          <div class="csv-report-summary">
            <div class="report-stat-card bg-green">
              <h2>${report.importedCount}</h2>
              <p>Imported Rows</p>
            </div>
            <div class="report-stat-card" style="background:#e2e8f0;">
              <h2>${report.totalRows}</h2>
              <p>Total Processed</p>
            </div>
            <div class="report-stat-card bg-green">
              <h2>100%</h2>
              <p>Success Rate</p>
            </div>
          </div>
          <p class="text-green text-center"><strong>Success: All expenses saved atomically in a single transaction block!</strong></p>
        `;
      } else {
        showToast('Import aborted. Some rows contain validation errors.', 'error');
        const report = data.data ? data.data.report : { totalRows: 0, failedCount: 1, errors: [{ rowNum: 1, error: data.message }] };
        
        const errorsList = report.errors.map(err => `
          <li>Row ${err.rowNum}: ${escapeHtml(err.error)}</li>
        `).join('');

        detailsContainer.innerHTML = `
          <div class="csv-report-summary">
            <div class="report-stat-card" style="background:#e2e8f0;">
              <h2>0</h2>
              <p>Imported Rows</p>
            </div>
            <div class="report-stat-card bg-red">
              <h2>${report.failedCount}</h2>
              <p>Validation Failures</p>
            </div>
            <div class="report-stat-card" style="background:#cbd5e1;">
              <h2>${report.totalRows}</h2>
              <p>Processed</p>
            </div>
          </div>
          <div class="csv-errors-log">
            <h5>Import Aborted & Database Transaction Rolled Back</h5>
            <ul>${errorsList}</ul>
          </div>
        `;
      }
    } catch (error) {
      showToast(error.message || 'Network upload failed.', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `
        <i data-lucide="check-circle2"></i>
        <span>Process and Import File</span>
      `;
      lucide.createIcons();
    }
  });
}

// --- UTILITY ESCAPING FUNCTION ---
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
