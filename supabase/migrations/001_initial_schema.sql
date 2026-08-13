-- HireWise AI Database Schema
-- Run this migration in Supabase SQL Editor or via CLI

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('candidate', 'recruiter');
CREATE TYPE job_status AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE employment_type AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'remote');
CREATE TYPE application_status AS ENUM ('applied', 'under_review', 'shortlisted', 'interview', 'rejected', 'selected');
CREATE TYPE interview_type AS ENUM ('technical', 'behavioral', 'hr', 'mixed');
CREATE TYPE interview_status AS ENUM ('active', 'completed', 'abandoned');
CREATE TYPE skill_level AS ENUM ('strong', 'moderate', 'missing');
CREATE TYPE notification_type AS ENUM (
  'application_submitted', 'status_updated', 'interview_scheduled',
  'resume_analysis_complete', 'job_recommendation', 'telegram_linked',
  'new_application', 'candidate_shortlisted', 'application_update'
);
CREATE TYPE telegram_link_status AS ENUM ('pending', 'linked', 'revoked');

-- Profiles (base user profile linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Candidate profiles
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT,
  location TEXT,
  headline TEXT,
  bio TEXT,
  linkedin_url TEXT,
  github_url TEXT,
  portfolio_url TEXT,
  years_of_experience NUMERIC(4,1),
  current_title TEXT,
  current_company TEXT,
  education JSONB DEFAULT '[]'::jsonb,
  -- Consented demographic data for fairness auditing only (never used in scoring)
  gender TEXT,
  age_group TEXT,
  demographic_consent BOOLEAN DEFAULT FALSE,
  profile_completeness INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recruiter profiles
CREATE TABLE recruiter_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_website TEXT,
  company_description TEXT,
  job_title TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resumes
CREATE TABLE resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  parsed_data JSONB DEFAULT '{}'::jsonb,
  raw_text TEXT,
  health_score INTEGER,
  health_analysis JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recruiter_id UUID NOT NULL REFERENCES recruiter_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  experience_min INTEGER DEFAULT 0,
  experience_max INTEGER,
  education_requirement TEXT,
  location TEXT,
  employment_type employment_type DEFAULT 'full_time',
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT DEFAULT 'USD',
  deadline TIMESTAMPTZ,
  status job_status DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job skills (normalized)
CREATE TABLE job_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  is_required BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, skill_name)
);

-- Candidate skills
CREATE TABLE candidate_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  proficiency_level TEXT,
  years_experience NUMERIC(4,1),
  source TEXT DEFAULT 'resume',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, skill_name)
);

-- Applications
CREATE TABLE applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  cover_letter TEXT,
  status application_status DEFAULT 'applied',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- Application status history
CREATE TABLE application_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status application_status,
  to_status application_status NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role fit scores
CREATE TABLE role_fit_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  overall_score NUMERIC(5,2) NOT NULL,
  semantic_match NUMERIC(5,2),
  skills_match NUMERIC(5,2),
  experience_match NUMERIC(5,2),
  project_relevance NUMERIC(5,2),
  education_match NUMERIC(5,2),
  scoring_metadata JSONB DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(candidate_id, job_id)
);

-- Role fit explanations
CREATE TABLE role_fit_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_fit_score_id UUID NOT NULL REFERENCES role_fit_scores(id) ON DELETE CASCADE,
  strong_matches JSONB DEFAULT '[]'::jsonb,
  missing_skills JSONB DEFAULT '[]'::jsonb,
  weak_areas JSONB DEFAULT '[]'::jsonb,
  experience_gaps JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  feature_importance JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Skill gaps
CREATE TABLE skill_gaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  skill_name TEXT NOT NULL,
  level skill_level NOT NULL,
  priority INTEGER DEFAULT 0,
  recommendation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Interview sessions
CREATE TABLE interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  interview_type interview_type NOT NULL,
  status interview_status DEFAULT 'active',
  overall_score NUMERIC(5,2),
  technical_score NUMERIC(5,2),
  communication_score NUMERIC(5,2),
  answer_quality_score NUMERIC(5,2),
  relevance_score NUMERIC(5,2),
  evaluation JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Interview messages
CREATE TABLE interview_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('interviewer', 'candidate', 'system')),
  content TEXT NOT NULL,
  evaluation JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resume optimizations
CREATE TABLE resume_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  optimized_content JSONB NOT NULL,
  changes_summary JSONB DEFAULT '[]'::jsonb,
  pdf_path TEXT,
  docx_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Career recommendations
CREATE TABLE career_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  roadmap JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Telegram accounts
CREATE TABLE telegram_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT UNIQUE,
  telegram_username TEXT,
  link_token TEXT UNIQUE,
  link_token_expires_at TIMESTAMPTZ,
  status telegram_link_status DEFAULT 'pending',
  linked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fairness audits (independent monitoring layer)
CREATE TABLE fairness_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  recruiter_id UUID NOT NULL REFERENCES recruiter_profiles(id) ON DELETE CASCADE,
  audit_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  demographic_parity JSONB DEFAULT '{}'::jsonb,
  selection_rate_ratio JSONB DEFAULT '{}'::jsonb,
  equal_opportunity JSONB DEFAULT '{}'::jsonb,
  sample_size INTEGER DEFAULT 0,
  confidence_level TEXT,
  alerts JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_candidate_profiles_user ON candidate_profiles(user_id);
CREATE INDEX idx_recruiter_profiles_user ON recruiter_profiles(user_id);
CREATE INDEX idx_resumes_candidate ON resumes(candidate_id);
CREATE INDEX idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_role_fit_scores_job ON role_fit_scores(job_id);
CREATE INDEX idx_role_fit_scores_candidate ON role_fit_scores(candidate_id);
CREATE INDEX idx_interview_sessions_candidate ON interview_sessions(candidate_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_telegram_accounts_token ON telegram_accounts(link_token) WHERE link_token IS NOT NULL;
CREATE INDEX idx_fairness_audits_job ON fairness_audits(job_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_candidate_profiles_updated_at BEFORE UPDATE ON candidate_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recruiter_profiles_updated_at BEFORE UPDATE ON recruiter_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_skill_gaps_updated_at BEFORE UPDATE ON skill_gaps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fairness_audits_updated_at BEFORE UPDATE ON fairness_audits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Application status history trigger
CREATE OR REPLACE FUNCTION log_application_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO application_status_history (application_id, from_status, to_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER application_status_change_trigger
  AFTER UPDATE OF status ON applications
  FOR EACH ROW EXECUTE FUNCTION log_application_status_change();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
