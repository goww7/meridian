ALTER TABLE flows ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_flows_search ON flows USING GIN(search_vector);

ALTER TABLE requirements ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_requirements_search ON requirements USING GIN(search_vector);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,''))) STORED;
CREATE INDEX IF NOT EXISTS idx_tasks_search ON tasks USING GIN(search_vector);
