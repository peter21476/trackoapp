import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function ProfileModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarPublicId, setAvatarPublicId] = useState(user?.avatar_public_id || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUrl(res.data.url);
      setAvatarPublicId(res.data.public_id);
    } catch {
      setError('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (avatarPublicId) {
      try {
        await api.delete(`/upload/${avatarPublicId}`);
      } catch {}
    }
    setAvatarUrl('');
    setAvatarPublicId('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/auth/profile', {
        name: name.trim(),
        avatar_url: avatarUrl || null,
        avatar_public_id: avatarPublicId || null,
      });
      updateUser(res.data);
      onClose();
    } catch {
      setError('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Profile</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSave}>
          <div className="profile-avatar-section">
            <div className="profile-avatar-preview">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="profile-avatar-img" />
              ) : (
                <div
                  className="profile-avatar-placeholder"
                  style={{ background: user?.avatar_color || '#6366f1' }}
                >
                  {name.charAt(0).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="profile-avatar-actions">
              <input
                type="file"
                accept="image/*"
                ref={fileRef}
                onChange={handleAvatarUpload}
                hidden
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload photo'}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleRemoveAvatar}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="profile-name">Name</label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={user?.email || ''} disabled />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
