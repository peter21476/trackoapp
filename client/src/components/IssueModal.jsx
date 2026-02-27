import { useState, useEffect } from 'react';

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description || '');
      setStatus(issue.status);
      setPriority(issue.priority);
      setAssigneeId(issue.assignee_id || '');
    } else {
      setStatus(defaultStatus || 'issue');
    }
  }, [issue, defaultStatus]);

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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : issue ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
