CREATE TABLE IF NOT EXISTS issue_assignees (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(issue_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_assignees_issue ON issue_assignees(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_assignees_user ON issue_assignees(user_id);

-- Migrate existing single assignees into the new table
INSERT INTO issue_assignees (issue_id, user_id)
SELECT id, assignee_id FROM issues WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop old column
ALTER TABLE issues DROP COLUMN IF EXISTS assignee_id;
