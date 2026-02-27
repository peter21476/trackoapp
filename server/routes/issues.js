const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

function checkMembership(projectId, userId) {
  return db.query(
    'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
}

router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const membership = await checkMembership(req.params.projectId, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const result = await db.query(
      `SELECT i.*, 
        u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_color,
        u_reporter.name AS reporter_name
       FROM issues i
       LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
       LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
       WHERE i.project_id = $1
       ORDER BY i.position ASC, i.created_at DESC`,
      [req.params.projectId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get issues error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { project_id, title, description, priority, assignee_id, status } = req.body;

    if (!project_id || !title) {
      return res.status(400).json({ error: 'Project and title are required' });
    }

    const membership = await checkMembership(project_id, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), 0) + 1 AS next_pos FROM issues WHERE project_id = $1 AND status = $2',
      [project_id, status || 'issue']
    );

    const result = await db.query(
      `INSERT INTO issues (project_id, title, description, status, priority, assignee_id, reporter_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        project_id,
        title,
        description || '',
        status || 'issue',
        priority || 'medium',
        assignee_id || null,
        req.user.id,
        posResult.rows[0].next_pos,
      ]
    );

    const issue = result.rows[0];

    const enriched = await db.query(
      `SELECT i.*,
        u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_color,
        u_reporter.name AS reporter_name
       FROM issues i
       LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
       LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
       WHERE i.id = $1`,
      [issue.id]
    );

    res.status(201).json(enriched.rows[0]);
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignee_id } = req.body;

    const issueResult = await db.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (issueResult.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const issue = issueResult.rows[0];
    const membership = await checkMembership(issue.project_id, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const result = await db.query(
      `UPDATE issues SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        assignee_id = $5,
        updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [title, description, status, priority, assignee_id === undefined ? issue.assignee_id : assignee_id, req.params.id]
    );

    const enriched = await db.query(
      `SELECT i.*,
        u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_color,
        u_reporter.name AS reporter_name
       FROM issues i
       LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
       LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
       WHERE i.id = $1`,
      [req.params.id]
    );

    res.json(enriched.rows[0]);
  } catch (err) {
    console.error('Update issue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/move', auth, async (req, res) => {
  try {
    const { status, position } = req.body;

    const issueResult = await db.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (issueResult.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const issue = issueResult.rows[0];
    const membership = await checkMembership(issue.project_id, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    await db.query(
      'UPDATE issues SET status = $1, position = $2, updated_at = NOW() WHERE id = $3',
      [status, position, req.params.id]
    );

    const enriched = await db.query(
      `SELECT i.*,
        u_assignee.name AS assignee_name, u_assignee.avatar_color AS assignee_color,
        u_reporter.name AS reporter_name
       FROM issues i
       LEFT JOIN users u_assignee ON i.assignee_id = u_assignee.id
       LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
       WHERE i.id = $1`,
      [req.params.id]
    );

    res.json(enriched.rows[0]);
  } catch (err) {
    console.error('Move issue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const issueResult = await db.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (issueResult.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const issue = issueResult.rows[0];
    const membership = await checkMembership(issue.project_id, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    await db.query('DELETE FROM issues WHERE id = $1', [req.params.id]);
    res.json({ message: 'Issue deleted' });
  } catch (err) {
    console.error('Delete issue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
