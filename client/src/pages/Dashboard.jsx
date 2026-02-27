import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data);
    } catch {
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', { name, description });
      setName('');
      setDescription('');
      setShowModal(false);
      fetchProjects();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create project');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this project and all its issues?')) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects(projects.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete project');
    }
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Projects</h1>
          <p className="subtitle">Manage your bug tracking projects</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {projects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No projects yet</h2>
          <p>Create your first project to start tracking bugs</p>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            Create Project
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-card-header">
                <Link to={`/project/${project.id}`} className="project-title">
                  {project.name}
                </Link>
                <button
                  className="btn btn-icon btn-ghost"
                  onClick={() => handleDelete(project.id)}
                  title="Delete project"
                >
                  &times;
                </button>
              </div>
              {project.description && (
                <p className="project-desc">{project.description}</p>
              )}
              <div className="project-meta">
                <span>{project.issue_count || 0} issues</span>
                <span>{project.member_count || 1} member{project.member_count > 1 ? 's' : ''}</span>
              </div>
              <Link to={`/project/${project.id}`} className="btn btn-secondary btn-full">
                Open Board
              </Link>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Project</h2>
              <button className="btn btn-icon btn-ghost" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor="project-name">Project Name</label>
                <input
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Awesome Project"
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="project-desc">Description (optional)</label>
                <textarea
                  id="project-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="A brief description of the project"
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
