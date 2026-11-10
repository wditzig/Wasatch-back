import { defineWorkflow } from "./engine";

export const SERVICE_REQUEST_STATUSES = [
  "new",
  "reviewed",
  "assigned",
  "in_progress",
  "resolved",
  "closed",
] as const;

export type ServiceRequestStatus = (typeof SERVICE_REQUEST_STATUSES)[number];

/** Permission names are plain strings here so this package does not depend on `permissions`. */
export type ServiceRequestWorkflowPermission =
  | "service_requests.update_status"
  | "service_requests.assign"
  | "service_requests.close"
  | "service_requests.reopen";

/**
 * New -> Reviewed -> Assigned -> In Progress -> Resolved -> Closed, with:
 *  - direct assignment from New (skipping a separate review step),
 *  - closing without resolution from any open state (duplicate, not a city issue...) with a note,
 *  - reopening resolved/closed requests with a note.
 */
export const serviceRequestWorkflow = defineWorkflow<
  ServiceRequestStatus,
  ServiceRequestWorkflowPermission
>({
  key: "service_request",
  initial: "new",
  states: {
    new: { label: "New", open: true },
    reviewed: { label: "Reviewed", open: true },
    assigned: { label: "Assigned", open: true },
    in_progress: { label: "In progress", open: true },
    resolved: { label: "Resolved", open: false },
    closed: { label: "Closed", open: false },
  },
  transitions: [
    {
      from: "new",
      to: "reviewed",
      label: "Mark reviewed",
      permission: "service_requests.update_status",
    },
    {
      from: "new",
      to: "assigned",
      label: "Assign",
      permission: "service_requests.assign",
      requiresAssignee: true,
    },
    {
      from: "reviewed",
      to: "assigned",
      label: "Assign",
      permission: "service_requests.assign",
      requiresAssignee: true,
    },
    {
      from: "assigned",
      to: "in_progress",
      label: "Start work",
      permission: "service_requests.update_status",
    },
    {
      from: "in_progress",
      to: "resolved",
      label: "Mark resolved",
      permission: "service_requests.update_status",
    },
    { from: "resolved", to: "closed", label: "Close", permission: "service_requests.close" },
    {
      from: "new",
      to: "closed",
      label: "Close without action",
      permission: "service_requests.close",
      requiresNote: true,
    },
    {
      from: "reviewed",
      to: "closed",
      label: "Close without action",
      permission: "service_requests.close",
      requiresNote: true,
    },
    {
      from: "assigned",
      to: "closed",
      label: "Close without action",
      permission: "service_requests.close",
      requiresNote: true,
    },
    {
      from: "in_progress",
      to: "closed",
      label: "Close without action",
      permission: "service_requests.close",
      requiresNote: true,
    },
    {
      from: "resolved",
      to: "in_progress",
      label: "Reopen",
      permission: "service_requests.reopen",
      requiresNote: true,
    },
    {
      from: "closed",
      to: "in_progress",
      label: "Reopen",
      permission: "service_requests.reopen",
      requiresNote: true,
    },
  ],
});

export const OPEN_SERVICE_REQUEST_STATUSES = SERVICE_REQUEST_STATUSES.filter(
  (s) => serviceRequestWorkflow.states[s].open,
);

export function serviceRequestStatusLabel(status: ServiceRequestStatus): string {
  return serviceRequestWorkflow.states[status].label;
}
