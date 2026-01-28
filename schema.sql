-- SQL Schema for Supabase

-- Teams Table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  name TEXT NOT NULL,
  details JSONB,
  UNIQUE(team_id, student_id)
);

-- Evaluation Events Table
CREATE TABLE IF NOT EXISTS evaluation_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  num_sessions INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Review Sessions Table (Criteria config)
CREATE TABLE IF NOT EXISTS review_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES evaluation_events(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  criteria JSONB NOT NULL,
  UNIQUE(event_id, session_number)
);

-- Reviews Table (Actual scores)
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  session_id UUID REFERENCES review_sessions(id) ON DELETE CASCADE,
  attendance JSONB NOT NULL, -- Map of student_id -> boolean
  marks JSONB NOT NULL, -- Map of criterion_id -> number
  remarks TEXT,
  reviewer_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure a team can only be reviewed ONCE for a specific session
  UNIQUE(team_id, session_id)
);

-- Enable RLS (Optional, but good practice)
-- For this demo, we'll assume public access with simple policies or no RLS
-- ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
-- ... etc
