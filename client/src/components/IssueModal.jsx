import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api';
import ImageLightbox from './ImageLightbox';

const STATUSES = [
  { value: 'issue', label: 'Issue' },
  { value: 'to_work', label: 'To Work' },
  { value: 'resolving', label: 'Resolving' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function IssueModal({ issue, members, onSave, onDelete, onClose, defaultStatus }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('issue');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [screenshots, setScreenshots] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setStatus(issue.status);
      setPriority(issue.priority);
      setAssigneeId(issue.assignee_id || '');
      setScreenshots(issue.screenshots || []);
    } else {
      setStatus(defaultStatus || 'issue');
    }
  }, [issue, defaultStatus]);

  const uploadBlob = useCallback(async (blob, filename) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', blob, filename);
      const res = await api.post('/upload/screenshot', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setScreenshots((prev) => [...prev, { url: res.data.url, public_id: res.data.public_id }]);
    } catch {
      alert('Failed to upload screenshot');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('screenshot', file);
        const res = await api.post('/upload/screenshot', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setScreenshots((prev) => [...prev, { url: res.data.url, public_id: res.data.public_id }]);
      }
    } catch {
      alert('Failed to upload one or more screenshots');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' },
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Small delay to ensure the frame is rendered
      await new Promise((r) => setTimeout(r, 200));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);

      stream.getTracks().forEach((t) => t.stop());

      canvas.toBlob(async (blob) => {
        if (blob) {
          await uploadBlob(blob, `screenshot-${Date.now()}.png`);
        }
      }, 'image/png');
    } catch (err) {
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        alert('Screen capture failed. Your browser may not support this feature.');
      }
    }
  };

  // Clipboard paste handler
  useEffect(() => {
    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await uploadBlob(blob, `pasted-${Date.now()}.png`);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [uploadBlob]);

  const handleRemoveScreenshot = async (index) => {
    const shot = screenshots[index];
    if (shot.public_id) {
      try {
        await api.delete(`/upload/${shot.public_id}`);
      } catch {
        // ignore cleanup failures
      }
    }
    setScreenshots((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title,
        description,
        status,
        priority,
        assignee_id: assigneeId || null,
        screenshots: screenshots.map((s) => ({ url: s.url, public_id: s.public_id })),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this issue?')) return;
    onDelete(issue.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{issue ? 'Edit Issue' : 'New Issue'}</h2>
          <button className="btn btn-icon btn-ghost" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="issue-title">Title</label>
            <input
              id="issue-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the issue"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="issue-desc">Description</label>
            <textarea
              id="issue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description, steps to reproduce, etc."
              rows={4}
            />
          </div>
          <div className="form-group">
            <label>Screenshots</label>
            {screenshots.length > 0 && (
              <div className="screenshots-grid">
                {screenshots.map((shot, i) => (
                  <div key={shot.public_id || i} className="screenshot-preview-item">
                    <img src={shot.url} alt={`Screenshot ${i + 1}`} onClick={() => setLightboxUrl(shot.url)} />
                    <button
                      type="button"
                      className="screenshot-remove-btn"
                      onClick={() => handleRemoveScreenshot(i)}
                      title="Remove"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="screenshot-actions">
              <div className="screenshot-upload" onClick={() => fileInputRef.current?.click()}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUpload}
                  hidden
                />
                {uploading ? (
                  <span className="upload-text">Uploading...</span>
                ) : (
                  <>
                    <svg className="upload-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span className="upload-text">Upload files</span>
                  </>
                )}
              </div>
              <button type="button" className="screenshot-upload" onClick={handleScreenCapture} disabled={uploading}>
                <svg className="upload-svg-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                <span className="upload-text">Capture screen</span>
              </button>
            </div>
            <span className="upload-hint">Or paste from clipboard (Cmd+V / Ctrl+V)</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="issue-status">Status</label>
              <select id="issue-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="issue-priority">Priority</label>
              <select id="issue-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="issue-assignee">Assignee</label>
              <select id="issue-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-actions">
            {issue && (
              <button type="button" className="btn btn-danger" onClick={handleDelete}>Delete</button>
            )}
            <div className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading}>
              {saving ? 'Saving...' : issue ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Screenshot" onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  );
}
