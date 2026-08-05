export type AccountType = "user" | "agent";
export type AgentVerificationStatus = "unsubmitted" | "pending" | "verified" | "rejected" | "expired";

export const STANDARD_LISTING_LIMIT = 3;
export const VERIFIED_AGENT_LISTING_LIMIT = 30;

const VERIFICATION_STATUSES = new Set<AgentVerificationStatus>(["unsubmitted", "pending", "verified", "rejected", "expired"]);

export function normalizeAccountType(value: unknown): AccountType {
  return value === "agent" ? "agent" : "user";
}

export function normalizeAgentVerificationStatus(value: unknown): AgentVerificationStatus {
  return typeof value === "string" && VERIFICATION_STATUSES.has(value as AgentVerificationStatus)
    ? value as AgentVerificationStatus
    : "unsubmitted";
}

export function isVerifiedAgent(accountType: AccountType, status: AgentVerificationStatus) {
  return accountType === "agent" && status === "verified";
}

export function listingLimitFor(accountType: AccountType, agentVerified: boolean) {
  return accountType === "agent" && agentVerified ? VERIFIED_AGENT_LISTING_LIMIT : STANDARD_LISTING_LIMIT;
}
