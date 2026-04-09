import {
  DEFAULT_TICKETING_ROLES,
  TICKETING_ROLE_OPTIONS,
  type TicketingRole,
} from "@ssb/db/ticketingRoles";

export {
  DEFAULT_TICKETING_ROLES,
  TICKETING_ROLE_OPTIONS,
  type TicketingRole,
};

export const ROLE_INELIGIBLE_CODE = "ticketing_role_ineligible";

const TICKETING_ROLE_SET = new Set<TicketingRole>(
  TICKETING_ROLE_OPTIONS.map(({ value }) => value),
);

export function normalizeTicketingRole(value: string): string {
  return value.trim().toLowerCase().split("@")[0];
}

function toTicketingRole(value: string): TicketingRole | null {
  const normalized = normalizeTicketingRole(value);
  return TICKETING_ROLE_SET.has(normalized as TicketingRole)
    ? (normalized as TicketingRole)
    : null;
}

export function isTicketingEligible(
  userAffiliations: readonly string[],
  allowedRoles: readonly string[] | null | undefined,
): boolean {
  const normalizedAffiliations = new Set(
    userAffiliations.map(normalizeTicketingRole).filter(Boolean),
  );

  return resolveTicketingRoles(allowedRoles).some((role) =>
    normalizedAffiliations.has(role),
  );
}

export function resolveTicketingRoles(
  values: readonly string[] | null | undefined,
): TicketingRole[] {
  const sanitized = sanitizeTicketingRoles(values ?? []);
  return sanitized.length > 0
    ? sanitized
    : [...DEFAULT_TICKETING_ROLES];
}

export function sanitizeTicketingRoles(
  values: readonly string[],
): TicketingRole[] {
  const normalized = new Set<TicketingRole>();

  for (const value of values) {
    const role = toTicketingRole(value);
    if (role) {
      normalized.add(role);
    }
  }

  return TICKETING_ROLE_OPTIONS
    .map(({ value }) => value)
    .filter((role) => normalized.has(role));
}

export function formatTicketingRoleList(
  roles: readonly string[] | null | undefined,
): string {
  const labels = resolveTicketingRoles(roles).map((role) =>
    TICKETING_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
  );

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} or ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export function getRoleIneligiblePayload(allowedRoles: readonly string[]) {
  const resolvedRoles = resolveTicketingRoles(allowedRoles);
  return {
    error: `Online ticketing for this event is limited to ${formatTicketingRoleList(resolvedRoles)}. We encourage you to show up to the venue early to join the standby line instead.`,
    code: ROLE_INELIGIBLE_CODE,
    allowedRoles: resolvedRoles,
  };
}
