export const DEFAULT_TICKETING_ROLES = [
  "student",
  "faculty",
  "staff",
] as const;

export const TICKETING_ROLE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "faculty", label: "Faculty" },
  { value: "staff", label: "Staff" },
  { value: "affiliate", label: "Affiliate" },
  { value: "member", label: "Member" },
] as const;

export type TicketingRole = (typeof TICKETING_ROLE_OPTIONS)[number]["value"];
