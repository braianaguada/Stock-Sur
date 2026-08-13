import type { DocStatus } from "@/features/documents/types";

export type BudgetPriority = "LOW" | "NORMAL" | "HIGH";
export type BudgetTrackingState = "OVERDUE" | "EXPIRED" | "UPCOMING" | "UNSCHEDULED" | "RESOLVED";

export interface BudgetFollowUp {
  id: string;
  company_id: string;
  document_id: string;
  priority: BudgetPriority;
  next_contact_on: string | null;
  last_contacted_at: string | null;
  contact_count: number;
  notes: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetDocument {
  id: string;
  status: DocStatus;
  point_of_sale: number;
  document_number: number | null;
  issue_date: string;
  valid_until: string | null;
  customer_name: string | null;
  total: number;
}

export interface TrackedBudget extends BudgetDocument {
  followUp: BudgetFollowUp | null;
  trackingState: BudgetTrackingState;
}
