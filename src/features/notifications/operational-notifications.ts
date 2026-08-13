import type { DashboardAction } from "@/features/index/dashboard-insights";
import type { AppRole } from "@/lib/permissions";

type NotificationAccess = {
  roles: AppRole[];
  companyRoleCodes: string[];
  companyPermissionCodes: string[];
};

const ACTION_PERMISSIONS: Record<string, string> = {
  "pending-receipts": "cash.view",
  "open-jobs": "customers.view",
  "sent-quotes": "documents.view",
  "pending-billing": "billing.view",
  "draft-documents": "documents.view",
};

const TONE_PRIORITY: Record<DashboardAction["tone"], number> = {
  danger: 4,
  warning: 3,
  info: 2,
  default: 1,
};

function hasPermission(access: NotificationAccess, permission: string) {
  return access.roles.includes("superadmin")
    || access.roles.includes("admin")
    || access.companyRoleCodes.includes("admin")
    || access.companyPermissionCodes.includes(permission);
}

export function buildOperationalNotifications(actions: DashboardAction[], access: NotificationAccess) {
  return actions
    .filter((action) => {
      const permission = ACTION_PERMISSIONS[action.key];
      return Boolean(permission) && action.count > 0 && hasPermission(access, permission);
    })
    .sort((left, right) => {
      const toneDifference = TONE_PRIORITY[right.tone] - TONE_PRIORITY[left.tone];
      return toneDifference || right.count - left.count || left.label.localeCompare(right.label);
    });
}

export function countOperationalPendings(actions: DashboardAction[]) {
  return actions.reduce((total, action) => total + action.count, 0);
}
