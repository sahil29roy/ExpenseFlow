import React, { useState, useEffect } from 'react';
import { apiRequest } from '../utils/api';
import { Plus, Users, ChevronRight, Trash2, UserPlus, X } from 'lucide-react';

export default function Groups({ users, groups, onGroupsChange, showToast }) {
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [members, setMembers] = useState([]);
  
  // Modals state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  
  // Form values
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  useEffect(() => {
    if (groups && groups.length > 0 && !selectedGroup) {
      selectGroup(groups[0].id);
    } else if (selectedGroup) {
      // Refresh current selected group
      selectGroup(selectedGroup.id);
    }
  }, [groups]);

  const selectGroup = async (groupId) => {
    try {
      const res = await apiRequest(`/groups/${groupId}`);
      if (res && res.data) {
        setSelectedGroup(res.data.group);
        setMembers(res.data.members || []);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      const res = await apiRequest('/groups', {
        method: 'POST',
        body: JSON.stringify({ name: newGroupName, description: newGroupDesc })
      });
      if (res && res.data) {
        showToast('Group created successfully!', 'success');
        setNewGroupName('');
        setNewGroupDesc('');
        setShowCreateGroup(false);
        onGroupsChange(); // Notify parent to refresh group list
        setSelectedGroup(res.data.group);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;
    try {
      const res = await apiRequest(`/groups/${selectedGroup.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ userId: selectedUserId })
      });
      if (res) {
        showToast('Member added successfully!', 'success');
        setSelectedUserId('');
        setShowAddMember(false);
        selectGroup(selectedGroup.id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;
    try {
      const res = await apiRequest(`/groups/${selectedGroup.id}/members/${userId}`, {
        method: 'DELETE'
      });
      if (res) {
        showToast('Member removed successfully!', 'success');
        selectGroup(selectedGroup.id);
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this group permanently?')) return;
    try {
      const res = await apiRequest(`/groups/${groupId}`, {
        method: 'DELETE'
      });
      if (res) {
        showToast('Group deleted successfully.', 'success');
        setSelectedGroup(null);
        setMembers([]);
        onGroupsChange();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('user'));
  const isCreator = selectedGroup && selectedGroup.created_by === (currentUser ? currentUser.id : null);

  return (
    <div className="app-panel">
      <div className="panel-layout-split">
        {/* Left: Groups list */}
        <div className="panel-side-list card-wrapper">
          <div className="section-header">
            <h3>Your Groups</h3>
            <button 
              type="button" 
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateGroup(true)}
            >
              <Plus size={16} />
              <span>New Group</span>
            </button>
          </div>
          
          <div className="groups-grid-list">
            {groups && groups.length > 0 ? (
              groups.map(group => (
                <div 
                  key={group.id} 
                  className={`group-card-item ${selectedGroup && selectedGroup.id === group.id ? 'active' : ''}`}
                  onClick={() => selectGroup(group.id)}
                >
                  <div>
                    <h4>{group.name}</h4>
                    <p>{group.description || 'No description'}</p>
                  </div>
                  <ChevronRight size={18} />
                </div>
              ))
            ) : (
              <p className="empty-state">No group memberships. Create one above!</p>
            )}
          </div>
        </div>

        {/* Right: Selected group detail */}
        <div className="panel-main-content card-wrapper">
          {selectedGroup ? (
            <div className="group-detail-view">
              <div className="group-detail-header">
                <div>
                  <h2>{selectedGroup.name}</h2>
                  <p className="section-subtitle">{selectedGroup.description || 'No description'}</p>
                </div>
                {isCreator && (
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm text-red"
                    onClick={() => handleDeleteGroup(selectedGroup.id)}
                  >
                    <Trash2 size={16} />
                    <span>Delete Group</span>
                  </button>
                )}
              </div>

              <div className="group-members-section">
                <div className="section-header">
                  <h4>Members ({members.length})</h4>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddMember(true)}
                  >
                    <UserPlus size={16} />
                    <span>Add Member</span>
                  </button>
                </div>
                
                <div className="members-chips">
                  {members.map(m => {
                    const isGroupCreator = m.id === selectedGroup.created_by;
                    return (
                      <div key={m.id} className="member-chip">
                        <span>{m.name} {isGroupCreator ? '(Creator)' : ''}</span>
                        {!isGroupCreator && (
                          <button type="button" onClick={() => handleRemoveMember(m.id)}>
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state-large">
              <Users className="large-icon" />
              <h3>Select a group to view details</h3>
              <p>Manage members, view bills, and track shares.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- CREATE GROUP MODAL --- */}
      {showCreateGroup && (
        <div className="modal show">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Create New Group</h3>
                <button 
                  type="button" 
                  className="modal-close" 
                  onClick={() => setShowCreateGroup(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleCreateGroup}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="grp-name">Group Name</label>
                    <input 
                      type="text" 
                      id="grp-name" 
                      placeholder="e.g. Co-living Apartment 4B" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="grp-desc">Description</label>
                    <textarea 
                      id="grp-desc" 
                      placeholder="e.g. Splitting monthly utilities and rent bills"
                      value={newGroupDesc}
                      onChange={(e) => setNewGroupDesc(e.target.value)}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowCreateGroup(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Create Group</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD MEMBER MODAL --- */}
      {showAddMember && (
        <div className="modal show">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Add Member to Group</h3>
                <button 
                  type="button" 
                  className="modal-close" 
                  onClick={() => setShowAddMember(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleAddMember}>
                <div className="modal-body">
                  <div className="form-group">
                    <label htmlFor="member-user-id">Select User to Add</label>
                    <select 
                      id="member-user-id" 
                      value={selectedUserId} 
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      required
                    >
                      <option value="" disabled>Select user...</option>
                      {users.map(u => {
                        // Exclude existing members
                        const isAlreadyMember = members.some(m => m.id === u.id);
                        if (isAlreadyMember) return null;
                        return (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.email})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowAddMember(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">Add Member</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
