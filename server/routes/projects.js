const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT p.*, u.name AS owner_name,
        (SELECT COUNT(*) FROM issues WHERE project_id = p.id) AS issue_count,
        (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) AS member_count
       FROM projects p
       JOIN users u ON p.owner_id = u.id
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const result = await db.query(
      'INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description || '', req.user.id]
    );

    const project = result.rows[0];

    await db.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.user.id, 'owner']
    );

    res.status(201).json(project);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const membership = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const result = await db.query(
      `SELECT p.*, u.name AS owner_name FROM projects p
       JOIN users u ON p.owner_id = u.id WHERE p.id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description } = req.body;

    const ownership = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    );
    if (ownership.rows.length === 0) {
      return res.status(403).json({ error: 'Only the owner can edit this project' });
    }

    const result = await db.query(
      'UPDATE projects SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, req.params.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const ownership = await db.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.id]
    );
    if (ownership.rows.length === 0) {
      return res.status(403).json({ error: 'Only the owner can delete this project' });
    }

    await db.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/members', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_color, pm.role
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.role DESC, u.name ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get members error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', auth, async (req, res) => {
  try {
    const { email } = req.body;

    const ownership = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = $3',
      [req.params.id, req.user.id, 'owner']
    );
    if (ownership.rows.length === 0) {
      return res.status(403).json({ error: 'Only the owner can add members' });
    }

    const userResult = await db.query('SELECT id, name, email, avatar_color FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'No user found with that email' });
    }

    const newUser = userResult.rows[0];

    const existing = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, newUser.id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    await db.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [req.params.id, newUser.id, 'member']
    );

    res.status(201).json({ ...newUser, role: 'member' });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const ownership = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = $3',
      [req.params.id, req.user.id, 'owner']
    );
    if (ownership.rows.length === 0) {
      return res.status(403).json({ error: 'Only the owner can remove members' });
    }

    if (parseInt(req.params.userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await db.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
      [req.params.id, req.params.userId]
    );

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
