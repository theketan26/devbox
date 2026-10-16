-- ==============================================================================
-- Migration: Add project_id to application_links
-- ==============================================================================
-- Allows resource links to be attached directly to a project (project-wide links)
-- or to an application, matching the schema pattern of configs_and_secrets.
-- ==============================================================================

-- 1. Add project_id column with foreign key to projects
ALTER TABLE application_links
    ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- 2. Allow application_id to be nullable for project-level links
ALTER TABLE application_links
    ALTER COLUMN application_id DROP NOT NULL;

-- 3. Index for fast querying by project_id
CREATE INDEX IF NOT EXISTS idx_application_links_project_id ON application_links(project_id);
