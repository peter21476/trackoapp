CREATE TABLE IF NOT EXISTS issue_screenshots (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER REFERENCES issues(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  public_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_screenshots_issue ON issue_screenshots(issue_id);

-- Migrate existing single screenshots into the new table
INSERT INTO issue_screenshots (issue_id, url, public_id)
SELECT id, screenshot_url, screenshot_public_id
FROM issues
WHERE screenshot_url IS NOT NULL AND screenshot_public_id IS NOT NULL;

-- Drop old columns
ALTER TABLE issues DROP COLUMN IF EXISTS screenshot_url;
ALTER TABLE issues DROP COLUMN IF EXISTS screenshot_public_id;
