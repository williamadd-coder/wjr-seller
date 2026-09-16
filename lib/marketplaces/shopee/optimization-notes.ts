import type { ResearchAttempt } from "./public-research";

type OptimizationNotes = Record<string, unknown> & { publicResearchAttempt?: ResearchAttempt };

function isValidAttempt(value: unknown): value is ResearchAttempt {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && typeof (value as ResearchAttempt).status === "string"
    && typeof (value as ResearchAttempt).checkedAt === "string";
}

/** Never let a fresh generation erase evidence from a previous manual research attempt. */
export function preserveResearchAttempt(previous: unknown, next: OptimizationNotes): OptimizationNotes {
  const attempt = previous && typeof previous === "object" && !Array.isArray(previous)
    ? (previous as OptimizationNotes).publicResearchAttempt
    : undefined;
  return isValidAttempt(attempt) ? { ...next, publicResearchAttempt: attempt } : { ...next };
}
