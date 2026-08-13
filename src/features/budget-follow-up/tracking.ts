import type { BudgetDocument, BudgetFollowUp, BudgetTrackingState, TrackedBudget } from "./types";

const RESOLVED_STATUSES = new Set(["APROBADO", "RECHAZADO", "ANULADO"]);

export function resolveBudgetTrackingState(
  budget: BudgetDocument,
  followUp: BudgetFollowUp | null,
  today: string,
): BudgetTrackingState {
  if (RESOLVED_STATUSES.has(budget.status)) return "RESOLVED";
  if (followUp?.next_contact_on && followUp.next_contact_on < today) return "OVERDUE";
  if (budget.valid_until && budget.valid_until < today) return "EXPIRED";
  if (followUp?.next_contact_on) return "UPCOMING";
  return "UNSCHEDULED";
}

const STATE_ORDER: Record<BudgetTrackingState, number> = {
  OVERDUE: 0,
  EXPIRED: 1,
  UPCOMING: 2,
  UNSCHEDULED: 3,
  RESOLVED: 4,
};

const PRIORITY_ORDER = { HIGH: 0, NORMAL: 1, LOW: 2 } as const;

export function buildTrackedBudgets(
  budgets: BudgetDocument[],
  followUps: BudgetFollowUp[],
  today: string,
): TrackedBudget[] {
  const followUpsByDocument = new Map(followUps.map((followUp) => [followUp.document_id, followUp]));
  return budgets
    .map((budget) => {
      const followUp = followUpsByDocument.get(budget.id) ?? null;
      return { ...budget, followUp, trackingState: resolveBudgetTrackingState(budget, followUp, today) };
    })
    .sort((left, right) => {
      const stateDifference = STATE_ORDER[left.trackingState] - STATE_ORDER[right.trackingState];
      if (stateDifference !== 0) return stateDifference;
      const priorityDifference = PRIORITY_ORDER[left.followUp?.priority ?? "NORMAL"] - PRIORITY_ORDER[right.followUp?.priority ?? "NORMAL"];
      if (priorityDifference !== 0) return priorityDifference;
      return (left.followUp?.next_contact_on ?? "9999-12-31").localeCompare(right.followUp?.next_contact_on ?? "9999-12-31");
    });
}
