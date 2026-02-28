const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

router.get('/issue/:issueId', auth, async (req, res) => {
  try {
    const issue = await db.query('SELECT project_id FROM issues WHERE id = $1', [req.params.issueId]);
    if (issue.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const membership = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [issue.rows[0].project_id, req.user.id]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    const result = await db.query(
      `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
       FROM issue_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.issue_id = $1
       ORDER BY c.created_at ASC`,
      [req.params.issueId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Get comments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { issue_id, body } = req.body;
    if (!issue_id || !body?.trim()) {
      return res.status(400).json({ error: 'Issue ID and comment body are required' });
    }

    const issue = await db.query('SELECT project_id FROM issues WHERE id = $1', [issue_id]);
    if (issue.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const membership = await db.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [issue.rows[0].project_id, req.user.id]
    );
    if (membership.rows.length === 0) return res.status(403).json({ error: 'Not a member' });

    const result = await db.query(
      'INSERT INTO issue_comments (issue_id, user_id, body) VALUES ($1, $2, $3) RETURNING *',
      [issue_id, req.user.id, body.trim()]
    );

    const enriched = await db.query(
      `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
       FROM issue_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(enriched.rows[0]);
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: 'Comment body is required' });

    const comment = await db.query('SELECT * FROM issue_comments WHERE id = $1', [req.params.id]);
    if (comment.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    if (comment.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own comments' });
    }

    const result = await db.query(
      'UPDATE issue_comments SET body = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [body.trim(), req.params.id]
    );

    const enriched = await db.query(
      `SELECT c.*, u.name AS user_name, u.avatar_color AS user_color
       FROM issue_comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = $1`,
      [result.rows[0].id]
    );

    res.json(enriched.rows[0]);
  } catch (err) {
    console.error('Update comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await db.query('SELECT * FROM issue_comments WHERE id = $1', [req.params.id]);
    if (comment.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

    if (comment.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    await db.query('DELETE FROM issue_comments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    console.error('Delete comment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
