import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api';
import IssueCard from '../components/IssueCard';
import IssueModal from '../components/IssueModal';
import AddMemberModal from '../components/AddMemberModal';

const COLUMNS = [
  { id: 'issue', title: 'Issue', color: '#ef4444' },
  { id: 'to_work', title: 'To Work', color: '#f59e0b' },
  { id: 'resolving', title: 'Resolving', color: '#3b82f6' },
  { id: 'resolved', title: 'Resolved', color: '#10b981' },
];

export default function ProjectBoard() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [issues, setIssues] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editIssue, setEditIssue] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createStatus, setCreateStatus] = useState('issue');
  const [showAddMember, setShowAddMember] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, issuesRes, membersRes] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/issues/project/${id}`),
        api.get(`/projects/${id}/members`),
      ]);
      setProject(projRes.data);
      setIssues(issuesRes.data);
      setMembers(membersRes.data);
    } catch (err) {
      console.error('Failed to load project', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getColumnIssues = (status) =>
    issues.filter((i) => i.status === status).sort((a, b) => a.position - b.position);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const issueId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    const newPosition = destination.index;

    setIssues((prev) => {
      const updated = prev.map((i) =>
        i.id === issueId ? { ...i, status: newStatus, position: newPosition } : i
      );
      return updated;
    });

    try {
      await api.patch(`/issues/${issueId}/move`, { status: newStatus, position: newPosition });
    } catch {
      fetchData();
    }
  };

  const handleCreateIssue = async (data) => {
    const res = await api.post('/issues', { ...data, project_id: parseInt(id) });
    setIssues((prev) => [...prev, res.data]);
    setShowCreate(false);
  };

  const handleUpdateIssue = async (data) => {
    const res = await api.put(`/issues/${editIssue.id}`, data);
    setIssues((prev) => prev.map((i) => (i.id === editIssue.id ? res.data : i)));
    setEditIssue(null);
  };

  const handleDeleteIssue = async (issueId) => {
    await api.delete(`/issues/${issueId}`);
    setIssues((prev) => prev.filter((i) => i.id !== issueId));
    setEditIssue(null);
  };

  const handleAddMember = async (email) => {
    const res = await api.post(`/projects/${id}/members`, { email });
    setMembers((prev) => [...prev, res.data]);
  };

  const openCreate = (status) => {
    setCreateStatus(status);
    setShowCreate(true);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="board-page">
      <div className="board-header">
        <div>
          <h1>{project?.name}</h1>
          {project?.description && <p className="subtitle">{project.description}</p>}
        </div>
        <div className="board-header-right">
          <div className="members-list">
            {members.map((m) => (
              <div
                key={m.id}
                className="user-badge small"
                style={{ background: m.avatar_color }}
                title={m.name}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddMember(true)}>
              + Add
            </button>
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map((col) => {
            const colIssues = getColumnIssues(col.id);
            return (
              <div key={col.id} className="kanban-column">
                <div className="column-header">
                  <div className="column-dot" style={{ background: col.color }} />
                  <h3>{col.title}</h3>
                  <span className="column-count">{colIssues.length}</span>
                  <button className="btn btn-icon btn-ghost" onClick={() => openCreate(col.id)} title="Add issue">+</button>
                </div>
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`column-body ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                    >
                      {colIssues.map((issue, index) => (
                        <Draggable key={issue.id} draggableId={String(issue.id)} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={snapshot.isDragging ? 'dragging' : ''}
                            >
                              <IssueCard issue={issue} onClick={setEditIssue} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {showCreate && (
        <IssueModal
          members={members}
          defaultStatus={createStatus}
          onSave={handleCreateIssue}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editIssue && (
        <IssueModal
          issue={editIssue}
          members={members}
          onSave={handleUpdateIssue}
          onDelete={handleDeleteIssue}
          onClose={() => setEditIssue(null)}
        />
      )}

      {showAddMember && (
        <AddMemberModal
          onAdd={handleAddMember}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </div>
  );
}
