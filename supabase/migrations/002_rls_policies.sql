-- Row Level Security Policies for HireWise AI

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruiter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_fit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_fit_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fairness_audits ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_candidate_profile_id()
RETURNS UUID AS $$
  SELECT id FROM candidate_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_recruiter_profile_id()
RETURNS UUID AS $$
  SELECT id FROM recruiter_profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Candidate profiles policies
CREATE POLICY "Candidates can view own profile" ON candidate_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Candidates can insert own profile" ON candidate_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Candidates can update own profile" ON candidate_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Recruiters can view applicant profiles" ON candidate_profiles FOR SELECT
  USING (
    get_user_role() = 'recruiter' AND
    id IN (
      SELECT a.candidate_id FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE j.recruiter_id = get_recruiter_profile_id()
    )
  );

-- Recruiter profiles policies
CREATE POLICY "Recruiters can view own profile" ON recruiter_profiles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Recruiters can insert own profile" ON recruiter_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Recruiters can update own profile" ON recruiter_profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Anyone can view recruiter company info" ON recruiter_profiles FOR SELECT USING (true);

-- Resumes policies
CREATE POLICY "Candidates can manage own resumes" ON resumes FOR ALL USING (
  candidate_id = get_candidate_profile_id()
);
CREATE POLICY "Recruiters can view applicant resumes" ON resumes FOR SELECT
  USING (
    get_user_role() = 'recruiter' AND
    candidate_id IN (
      SELECT a.candidate_id FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE j.recruiter_id = get_recruiter_profile_id()
    )
  );

-- Jobs policies
CREATE POLICY "Anyone authenticated can view published jobs" ON jobs FOR SELECT
  USING (status = 'published' OR recruiter_id = get_recruiter_profile_id());
CREATE POLICY "Recruiters can manage own jobs" ON jobs FOR ALL
  USING (recruiter_id = get_recruiter_profile_id());

-- Job skills policies
CREATE POLICY "View job skills for accessible jobs" ON job_skills FOR SELECT
  USING (job_id IN (SELECT id FROM jobs));
CREATE POLICY "Recruiters manage job skills" ON job_skills FOR ALL
  USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id()));

-- Candidate skills policies
CREATE POLICY "Candidates manage own skills" ON candidate_skills FOR ALL
  USING (candidate_id = get_candidate_profile_id());
CREATE POLICY "Recruiters view applicant skills" ON candidate_skills FOR SELECT
  USING (
    get_user_role() = 'recruiter' AND
    candidate_id IN (
      SELECT a.candidate_id FROM applications a
      JOIN jobs j ON a.job_id = j.id
      WHERE j.recruiter_id = get_recruiter_profile_id()
    )
  );

-- Applications policies
CREATE POLICY "Candidates manage own applications" ON applications FOR ALL
  USING (candidate_id = get_candidate_profile_id());
CREATE POLICY "Recruiters view job applications" ON applications FOR SELECT
  USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id()));
CREATE POLICY "Recruiters update application status" ON applications FOR UPDATE
  USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id()));

-- Application status history policies
CREATE POLICY "View status history for accessible applications" ON application_status_history FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM applications WHERE
        candidate_id = get_candidate_profile_id() OR
        job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id())
    )
  );

-- Role fit scores policies
CREATE POLICY "Candidates view own fit scores" ON role_fit_scores FOR SELECT
  USING (candidate_id = get_candidate_profile_id());
CREATE POLICY "Recruiters view job fit scores" ON role_fit_scores FOR SELECT
  USING (job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id()));
CREATE POLICY "System insert fit scores" ON role_fit_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "System update fit scores" ON role_fit_scores FOR UPDATE USING (true);

-- Role fit explanations policies
CREATE POLICY "View explanations for accessible scores" ON role_fit_explanations FOR SELECT
  USING (
    role_fit_score_id IN (
      SELECT rfs.id FROM role_fit_scores rfs WHERE
        rfs.candidate_id = get_candidate_profile_id() OR
        rfs.job_id IN (SELECT id FROM jobs WHERE recruiter_id = get_recruiter_profile_id())
    )
  );
CREATE POLICY "System insert explanations" ON role_fit_explanations FOR INSERT WITH CHECK (true);

-- Skill gaps policies
CREATE POLICY "Candidates manage own skill gaps" ON skill_gaps FOR ALL
  USING (candidate_id = get_candidate_profile_id());

-- Interview sessions policies
CREATE POLICY "Candidates manage own interviews" ON interview_sessions FOR ALL
  USING (candidate_id = get_candidate_profile_id());

-- Interview messages policies
CREATE POLICY "View messages for own sessions" ON interview_messages FOR ALL
  USING (session_id IN (SELECT id FROM interview_sessions WHERE candidate_id = get_candidate_profile_id()));

-- Resume optimizations policies
CREATE POLICY "Candidates manage own optimizations" ON resume_optimizations FOR ALL
  USING (candidate_id = get_candidate_profile_id());

-- Career recommendations policies
CREATE POLICY "Candidates view own recommendations" ON career_recommendations FOR ALL
  USING (candidate_id = get_candidate_profile_id());

-- Telegram accounts policies
CREATE POLICY "Users manage own telegram" ON telegram_accounts FOR ALL
  USING (user_id = auth.uid());

-- Notifications policies
CREATE POLICY "Users view own notifications" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Fairness audits policies
CREATE POLICY "Recruiters view own audits" ON fairness_audits FOR SELECT
  USING (recruiter_id = get_recruiter_profile_id());
CREATE POLICY "Recruiters manage own audits" ON fairness_audits FOR ALL
  USING (recruiter_id = get_recruiter_profile_id());

-- Storage buckets (run separately in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('optimized-resumes', 'optimized-resumes', false);
