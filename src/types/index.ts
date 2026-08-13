export type UserRole = "candidate" | "recruiter";

export type JobStatus = "draft" | "published" | "closed" | "archived";
export type EmploymentType = "full_time" | "part_time" | "contract" | "internship" | "remote";
export type ApplicationStatus = "applied" | "under_review" | "shortlisted" | "interview" | "rejected" | "selected";
export type InterviewType = "technical" | "behavioral" | "hr" | "mixed";
export type InterviewStatus = "active" | "completed" | "abandoned";
export type SkillLevel = "strong" | "moderate" | "missing";
export type TelegramLinkStatus = "pending" | "linked" | "revoked";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CandidateProfile {
  id: string;
  user_id: string;
  phone: string | null;
  location: string | null;
  headline: string | null;
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  years_of_experience: number | null;
  current_title: string | null;
  current_company: string | null;
  education: EducationEntry[];
  gender: string | null;
  age_group: string | null;
  demographic_consent: boolean;
  profile_completeness: number;
  created_at: string;
  updated_at: string;
}

export interface RecruiterProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_website: string | null;
  company_description: string | null;
  job_title: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  field: string;
  start_year?: number;
  end_year?: number;
}

export interface ExperienceEntry {
  company: string;
  title: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  achievements?: string[];
}

export interface ProjectEntry {
  name: string;
  description?: string;
  technologies?: string[];
  url?: string;
}

export interface ParsedResumeData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  summary?: string | null;
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  skills?: string[];
  projects?: ProjectEntry[];
  certifications?: string[];
  links?: { type: string; url: string }[];
}

export interface Resume {
  id: string;
  candidate_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  is_primary: boolean;
  parsed_data: ParsedResumeData;
  raw_text: string | null;
  health_score: number | null;
  health_analysis: ResumeHealthAnalysis | null;
  created_at: string;
  updated_at: string;
}

export interface ResumeHealthAnalysis {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  completeness_score: number;
  skills_score: number;
  experience_score: number;
  formatting_score: number;
  ats_readiness_score: number;
}

export interface Job {
  id: string;
  recruiter_id: string;
  title: string;
  company: string;
  description: string;
  required_skills: string[];
  preferred_skills: string[];
  experience_min: number;
  experience_max: number | null;
  education_requirement: string | null;
  location: string | null;
  employment_type: EmploymentType;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  deadline: string | null;
  status: JobStatus;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  candidate_id: string;
  job_id: string;
  resume_id: string | null;
  cover_letter: string | null;
  status: ApplicationStatus;
  applied_at: string;
  updated_at: string;
  job?: Job;
  role_fit_score?: RoleFitScore;
}

export interface RoleFitScore {
  id: string;
  candidate_id: string;
  job_id: string;
  application_id: string | null;
  overall_score: number;
  semantic_match: number | null;
  skills_match: number | null;
  experience_match: number | null;
  project_relevance: number | null;
  education_match: number | null;
  scoring_metadata: Record<string, unknown>;
  calculated_at: string;
  explanation?: RoleFitExplanation;
}

export interface RoleFitExplanation {
  id: string;
  role_fit_score_id: string;
  strong_matches: string[];
  missing_skills: string[];
  weak_areas: string[];
  experience_gaps: string[];
  recommendations: string[];
  feature_importance: FeatureImportance[];
  summary: string | null;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  direction: "positive" | "negative";
}

export interface SkillGap {
  id: string;
  candidate_id: string;
  job_id: string | null;
  skill_name: string;
  level: SkillLevel;
  priority: number;
  recommendation: string | null;
}

export interface InterviewSession {
  id: string;
  candidate_id: string;
  job_id: string | null;
  resume_id: string | null;
  interview_type: InterviewType;
  status: InterviewStatus;
  overall_score: number | null;
  technical_score: number | null;
  communication_score: number | null;
  answer_quality_score: number | null;
  relevance_score: number | null;
  evaluation: InterviewEvaluation | null;
  started_at: string;
  completed_at: string | null;
  messages?: InterviewMessage[];
}

export interface InterviewMessage {
  id: string;
  session_id: string;
  role: "interviewer" | "candidate" | "system";
  content: string;
  evaluation: Record<string, unknown>;
  created_at: string;
}

export interface InterviewEvaluation {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  summary: string;
}

export interface ResumeOptimization {
  id: string;
  candidate_id: string;
  resume_id: string;
  job_id: string | null;
  optimized_content: ParsedResumeData;
  changes_summary: string[];
  pdf_path: string | null;
  docx_path: string | null;
  created_at: string;
}

export interface CareerRecommendation {
  id: string;
  candidate_id: string;
  job_id: string | null;
  recommendation_type: string;
  title: string;
  content: string;
  roadmap: CareerRoadmap | null;
  is_read: boolean;
  created_at: string;
}

export interface CareerRoadmap {
  "30_day": string[];
  "60_day": string[];
  "90_day": string[];
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface FairnessAudit {
  id: string;
  job_id: string;
  recruiter_id: string;
  audit_data: Record<string, unknown>;
  demographic_parity: Record<string, number>;
  selection_rate_ratio: Record<string, number>;
  equal_opportunity: Record<string, number>;
  sample_size: number;
  confidence_level: string | null;
  alerts: FairnessAlert[];
  status: string;
  created_at: string;
}

export interface FairnessAlert {
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
  group?: string;
}

export interface TelegramAccount {
  id: string;
  user_id: string;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  link_token: string | null;
  link_token_expires_at: string | null;
  status: TelegramLinkStatus;
  linked_at: string | null;
}

export interface DashboardStats {
  profileCompleteness: number;
  resumeHealth: number | null;
  applicationsCount: number;
  interviewsCount: number;
  skillGapsCount: number;
  unreadNotifications: number;
}
