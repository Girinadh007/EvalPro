import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Student = {
  id: string;
  name: string;
  team_id: string;
  student_id: string;
  details?: any;
};

export type Team = {
  id: string;
  name: string;
  members: Student[];
};

export type SessionCriteria = {
  id: string;
  label: string;
  maxMarks: number;
};

export type ReviewSession = {
  id: string;
  event_id: string;
  session_number: number;
  criteria: SessionCriteria[];
};

export type EvaluationEvent = {
  id: string;
  name: string;
  num_sessions: number;
  created_at: string;
};

export type ReviewSubmission = {
  id?: string;
  team_id: string;
  session_id: string;
  attendance: Record<string, boolean>;
  marks: Record<string, number>;
  remarks: string;
  reviewer_id?: string;
  created_at?: string;
};
