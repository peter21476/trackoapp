import { useState } from 'react';
import ImageLightbox from './ImageLightbox';

const PRIORITY_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

export default function IssueCard({ issue, onClick }) {
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const screenshots = issue.screenshots || [];

  const handleThumbClick = (e, url) => {
    e.stopPropagation();
    setLightboxUrl(url);
  };

  return (
    <>
      <div className="issue-card" onClick={() => onClick(issue)}>
        <div className="issue-card-top">
          <span className="priority-dot" style={{ background: PRIORITY_COLORS[issue.priority] }} title={issue.priority} />
          <span className="issue-id">#{issue.id}</span>
        </div>
        <h4 className="issue-title">{issue.title}</h4>
        {screenshots.length > 0 && (
          <div className="issue-card-thumbs">
            {screenshots.map((shot, i) => (
              <div key={shot.public_id || i} className="issue-card-thumb" onClick={(e) => handleThumbClick(e, shot.url)}>
                <img src={shot.url} alt={`Screenshot ${i + 1}`} />
              </div>
            ))}
          </div>
        )}
        {issue.description && (
          <p className="issue-desc">{issue.description.slice(0, 80)}{issue.description.length > 80 ? '...' : ''}</p>
        )}
        <div className="issue-card-bottom">
          <span className={`priority-badge priority-${issue.priority}`}>{issue.priority}</span>
          {issue.assignee_name ? (
            <div className="assignee-badge" style={{ background: issue.assignee_color || '#6366f1' }} title={issue.assignee_name}>
              {issue.assignee_name.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="assignee-badge unassigned" title="Unassigned">?</div>
          )}
        </div>
      </div>
      {lightboxUrl && (
        <ImageLightbox src={lightboxUrl} alt="Screenshot" onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
}
