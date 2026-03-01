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

async function attachScreenshots(issues) {
  if (issues.length === 0) return issues;

  const ids = issues.map((i) => i.id);
  const result = await db.query(
    'SELECT * FROM issue_screenshots WHERE issue_id = ANY($1) ORDER BY created_at ASC',
    [ids]
  );

  const map = {};
  for (const s of result.rows) {
    if (!map[s.issue_id]) map[s.issue_id] = [];
    map[s.issue_id].push(s);
  }

  return issues.map((i) => ({ ...i, screenshots: map[i.id] || [] }));
}

async function attachAssignees(issues) {
  if (issues.length === 0) return issues;

  const ids = issues.map((i) => i.id);
  const result = await db.query(
    `SELECT ia.issue_id, u.id, u.name, u.email, u.avatar_color, u.avatar_url
     FROM issue_assignees ia
     JOIN users u ON ia.user_id = u.id
     WHERE ia.issue_id = ANY($1)
     ORDER BY ia.created_at ASC`,
    [ids]
  );

  const map = {};
  for (const a of result.rows) {
    if (!map[a.issue_id]) map[a.issue_id] = [];
    map[a.issue_id].push(a);
  }

  return issues.map((i) => ({ ...i, assignees: map[i.id] || [] }));
}

async function syncScreenshots(issueId, screenshots) {
  if (!screenshots) return;

  const existing = await db.query(
    'SELECT id, public_id FROM issue_screenshots WHERE issue_id = $1',
    [issueId]
  );

  const incomingPublicIds = new Set(screenshots.map((s) => s.public_id));
  const existingPublicIds = new Set(existing.rows.map((s) => s.public_id));

  const toDelete = existing.rows.filter((s) => !incomingPublicIds.has(s.public_id));
  for (const s of toDelete) {
    await db.query('DELETE FROM issue_screenshots WHERE id = $1', [s.id]);
  }

  const toInsert = screenshots.filter((s) => !existingPublicIds.has(s.public_id));
  for (const s of toInsert) {
    await db.query(
      'INSERT INTO issue_screenshots (issue_id, url, public_id) VALUES ($1, $2, $3)',
      [issueId, s.url, s.public_id]
    );
  }
}

async function syncAssignees(issueId, assigneeIds) {
  if (!assigneeIds) return;

  const existing = await db.query(
    'SELECT user_id FROM issue_assignees WHERE issue_id = $1',
    [issueId]
  );

  const incoming = new Set(assigneeIds.map(Number));
  const current = new Set(existing.rows.map((r) => r.user_id));

  for (const uid of current) {
    if (!incoming.has(uid)) {
      await db.query('DELETE FROM issue_assignees WHERE issue_id = $1 AND user_id = $2', [issueId, uid]);
    }
  }

  for (const uid of incoming) {
    if (!current.has(uid)) {
      await db.query('INSERT INTO issue_assignees (issue_id, user_id) VALUES ($1, $2)', [issueId, uid]);
    }
  }
}

async function enrichIssue(issueId) {
  const result = await db.query(
    `SELECT i.*, u_reporter.name AS reporter_name
     FROM issues i
     LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
     WHERE i.id = $1`,
    [issueId]
  );
  let issues = await attachScreenshots(result.rows);
  issues = await attachAssignees(issues);
  return issues[0];
}

router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const membership = await checkMembership(req.params.projectId, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    const result = await db.query(
      `SELECT i.*, u_reporter.name AS reporter_name
       FROM issues i
       LEFT JOIN users u_reporter ON i.reporter_id = u_reporter.id
       WHERE i.project_id = $1
       ORDER BY i.position ASC, i.created_at DESC`,
      [req.params.projectId]
    );

    let issues = await attachScreenshots(result.rows);
    issues = await attachAssignees(issues);
    res.json(issues);
  } catch (err) {
    console.error('Get issues error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { project_id, title, description, priority, assignee_ids, status, screenshots } = req.body;

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
      `INSERT INTO issues (project_id, title, description, status, priority, reporter_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        project_id,
        title,
        description || '',
        status || 'issue',
        priority || 'medium',
        req.user.id,
        posResult.rows[0].next_pos,
      ]
    );

    const issue = result.rows[0];

    if (assignee_ids && assignee_ids.length > 0) {
      await syncAssignees(issue.id, assignee_ids);
    }
    if (screenshots && screenshots.length > 0) {
      await syncScreenshots(issue.id, screenshots);
    }

    const enriched = await enrichIssue(issue.id);
    res.status(201).json(enriched);
  } catch (err) {
    console.error('Create issue error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, status, priority, assignee_ids, screenshots } = req.body;

    const issueResult = await db.query('SELECT * FROM issues WHERE id = $1', [req.params.id]);
    if (issueResult.rows.length === 0) return res.status(404).json({ error: 'Issue not found' });

    const issue = issueResult.rows[0];
    const membership = await checkMembership(issue.project_id, req.user.id);
    if (membership.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this project' });
    }

    await db.query(
      `UPDATE issues SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        updated_at = NOW()
       WHERE id = $5`,
      [title, description, status, priority, req.params.id]
    );

    if (assignee_ids !== undefined) {
      await syncAssignees(req.params.id, assignee_ids);
    }
    if (screenshots !== undefined) {
      await syncScreenshots(req.params.id, screenshots);
    }

    const enriched = await enrichIssue(req.params.id);
    res.json(enriched);
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

    const enriched = await enrichIssue(req.params.id);
    res.json(enriched);
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
