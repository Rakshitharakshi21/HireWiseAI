import { describe, it, expect } from "vitest";
import { runFairnessAudit } from "@/lib/services/fairness-audit";

describe("Fairness Audit Engine", () => {
  it("should return insufficient data when sample is too small", () => {
    const result = runFairnessAudit(
      [
        { candidate_id: "1", gender: "male", age_group: "25-34", application_status: "applied", role_fit_score: 75 },
        { candidate_id: "2", gender: "female", age_group: "25-34", application_status: "shortlisted", role_fit_score: 82 },
      ],
      "job-1"
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.sample_size).toBe(2);
    expect(result.alerts.some((a) => a.type === "insufficient_data")).toBe(true);
  });

  it("should calculate metrics with sufficient data", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      candidate_id: `c-${i}`,
      gender: i % 2 === 0 ? "male" : "female",
      age_group: i < 5 ? "25-34" : "35-44",
      application_status: (i < 3 ? "shortlisted" : "applied") as "applied" | "shortlisted",
      role_fit_score: 60 + i * 3,
    }));

    const result = runFairnessAudit(candidates, "job-1");

    expect(result.sample_size).toBe(10);
    expect(result.confidence_level).toBeDefined();
    expect(result.demographic_parity).toBeDefined();
  });

  it("should detect disparity when selection rates differ significantly", () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) => ({
        candidate_id: `m-${i}`,
        gender: "male" as string,
        age_group: "25-34" as string,
        application_status: "selected" as const,
        role_fit_score: 80,
      })),
      ...Array.from({ length: 8 }, (_, i) => ({
        candidate_id: `f-${i}`,
        gender: "female" as string,
        age_group: "25-34" as string,
        application_status: "rejected" as const,
        role_fit_score: 78,
      })),
    ];

    const result = runFairnessAudit(candidates, "job-1");
    expect(result.alerts.length).toBeGreaterThan(0);
  });

  it("should never modify role fit scores", () => {
    const candidates = [
      { candidate_id: "1", gender: "male", age_group: null, application_status: "applied" as const, role_fit_score: 90 },
      { candidate_id: "2", gender: "female", age_group: null, application_status: "applied" as const, role_fit_score: 45 },
    ];

    runFairnessAudit(candidates, "job-1");
    expect(candidates[0].role_fit_score).toBe(90);
    expect(candidates[1].role_fit_score).toBe(45);
  });
});
