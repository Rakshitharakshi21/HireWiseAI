import type { FairnessAudit, FairnessAlert, ApplicationStatus } from "@/types";

interface CandidateDemographic {
  candidate_id: string;
  gender: string | null;
  age_group: string | null;
  application_status: ApplicationStatus;
  role_fit_score: number | null;
}

interface GroupMetrics {
  group: string;
  count: number;
  selection_rate: number;
  avg_fit_score: number;
  shortlisted_rate: number;
}

const MIN_SAMPLE_SIZE = 5;
const DISPARITY_THRESHOLD = 0.8;

export function runFairnessAudit(
  candidates: CandidateDemographic[],
  jobId: string
): Omit<FairnessAudit, "id" | "recruiter_id" | "created_at" | "updated_at"> {
  const consentedCandidates = candidates.filter((c) => c.gender || c.age_group);

  if (consentedCandidates.length < MIN_SAMPLE_SIZE) {
    return {
      job_id: jobId,
      audit_data: { message: "Insufficient consented demographic data" },
      demographic_parity: {},
      selection_rate_ratio: {},
      equal_opportunity: {},
      sample_size: consentedCandidates.length,
      confidence_level: "insufficient",
      alerts: [{
        type: "insufficient_data",
        message: `Only ${consentedCandidates.length} candidates with demographic consent. Minimum ${MIN_SAMPLE_SIZE} required for reliable analysis.`,
        severity: "low",
      }],
      status: "insufficient_data",
    };
  }

  const genderGroups = groupByAttribute(consentedCandidates, "gender");
  const ageGroups = groupByAttribute(consentedCandidates, "age_group");

  const demographicParity = calculateDemographicParity(genderGroups, ageGroups);
  const selectionRateRatio = calculateSelectionRateRatio(genderGroups, ageGroups);
  const equalOpportunity = calculateEqualOpportunity(genderGroups, ageGroups);
  const alerts = generateAlerts(demographicParity, selectionRateRatio, equalOpportunity, consentedCandidates.length);

  const confidenceLevel =
    consentedCandidates.length >= 30 ? "high" :
    consentedCandidates.length >= 15 ? "medium" : "low";

  return {
    job_id: jobId,
    audit_data: {
      gender_groups: genderGroups,
      age_groups: ageGroups,
      total_applicants: candidates.length,
      consented_applicants: consentedCandidates.length,
      audit_timestamp: new Date().toISOString(),
      note: "This audit is independent from role-fit scoring. Demographic data does not influence candidate scores.",
    },
    demographic_parity: demographicParity,
    selection_rate_ratio: selectionRateRatio,
    equal_opportunity: equalOpportunity,
    sample_size: consentedCandidates.length,
    confidence_level: confidenceLevel,
    alerts,
    status: alerts.some((a) => a.severity === "high") ? "attention_required" : "normal",
  };
}

function groupByAttribute(
  candidates: CandidateDemographic[],
  attribute: "gender" | "age_group"
): GroupMetrics[] {
  const groups = new Map<string, CandidateDemographic[]>();

  for (const c of candidates) {
    const value = c[attribute] || "Not specified";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value)!.push(c);
  }

  return Array.from(groups.entries()).map(([group, members]) => {
    const selected = members.filter((m) =>
      ["shortlisted", "interview", "selected"].includes(m.application_status)
    );
    const shortlisted = members.filter((m) =>
      ["shortlisted", "interview", "selected"].includes(m.application_status)
    );

    return {
      group,
      count: members.length,
      selection_rate: members.length > 0 ? selected.length / members.length : 0,
      avg_fit_score: members.length > 0
        ? members.reduce((sum, m) => sum + (m.role_fit_score || 0), 0) / members.length
        : 0,
      shortlisted_rate: members.length > 0 ? shortlisted.length / members.length : 0,
    };
  });
}

function calculateDemographicParity(
  genderGroups: GroupMetrics[],
  ageGroups: GroupMetrics[]
): Record<string, number> {
  const result: Record<string, number> = {};

  if (genderGroups.length >= 2) {
    const maxRate = Math.max(...genderGroups.map((g) => g.selection_rate));
    for (const g of genderGroups) {
      result[`gender_${g.group}`] = maxRate > 0 ? g.selection_rate / maxRate : 0;
    }
  }

  if (ageGroups.length >= 2) {
    const maxRate = Math.max(...ageGroups.map((g) => g.selection_rate));
    for (const g of ageGroups) {
      result[`age_${g.group}`] = maxRate > 0 ? g.selection_rate / maxRate : 0;
    }
  }

  return result;
}

function calculateSelectionRateRatio(
  genderGroups: GroupMetrics[],
  ageGroups: GroupMetrics[]
): Record<string, number> {
  const result: Record<string, number> = {};

  if (genderGroups.length >= 2) {
    const reference = genderGroups.reduce((max, g) =>
      g.count > max.count ? g : max, genderGroups[0]);
    for (const g of genderGroups) {
      if (g.group !== reference.group) {
        result[`gender_${g.group}_vs_${reference.group}`] =
          reference.selection_rate > 0 ? g.selection_rate / reference.selection_rate : 0;
      }
    }
  }

  if (ageGroups.length >= 2) {
    const reference = ageGroups.reduce((max, g) =>
      g.count > max.count ? g : max, ageGroups[0]);
    for (const g of ageGroups) {
      if (g.group !== reference.group) {
        result[`age_${g.group}_vs_${reference.group}`] =
          reference.selection_rate > 0 ? g.selection_rate / reference.selection_rate : 0;
      }
    }
  }

  return result;
}

function calculateEqualOpportunity(
  genderGroups: GroupMetrics[],
  ageGroups: GroupMetrics[]
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const g of genderGroups) {
    result[`gender_${g.group}_tpr`] = g.shortlisted_rate;
  }
  for (const g of ageGroups) {
    result[`age_${g.group}_tpr`] = g.shortlisted_rate;
  }

  return result;
}

function generateAlerts(
  parity: Record<string, number>,
  ratio: Record<string, number>,
  _opportunity: Record<string, number>,
  sampleSize: number
): FairnessAlert[] {
  const alerts: FairnessAlert[] = [];

  if (sampleSize < MIN_SAMPLE_SIZE * 2) {
    alerts.push({
      type: "small_sample",
      message: `Sample size of ${sampleSize} may not be statistically reliable. Results should be interpreted with caution.`,
      severity: "medium",
    });
  }

  for (const [key, value] of Object.entries(ratio)) {
    if (value < DISPARITY_THRESHOLD) {
      alerts.push({
        type: "disparity_detected",
        message: `Selection rate ratio of ${value.toFixed(2)} detected for ${key.replace(/_/g, " ")}. This falls below the ${DISPARITY_THRESHOLD} threshold.`,
        severity: value < 0.6 ? "high" : "medium",
        group: key,
      });
    }
  }

  for (const [key, value] of Object.entries(parity)) {
    if (value < DISPARITY_THRESHOLD) {
      alerts.push({
        type: "demographic_parity",
        message: `Demographic parity ratio of ${value.toFixed(2)} for ${key.replace(/_/g, " ")}.`,
        severity: value < 0.6 ? "high" : "medium",
        group: key,
      });
    }
  }

  return alerts;
}
