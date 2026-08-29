import { normalizeAffiliation } from "@/app/lib/affiliation";
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

const TICKETING_ROLE_SET = new Set<TicketingRole>(
  TICKETING_ROLE_OPTIONS.map(({ value }) => value),
);

export function normalizeTicketingRole(value: string): string {
  return normalizeAffiliation(value);
}

function toTicketingRole(value: string): TicketingRole | null {
  const normalized = normalizeTicketingRole(value);
  return TICKETING_ROLE_SET.has(normalized as TicketingRole)
    ? (normalized as TicketingRole)
    : null;
}

export function isTicketingRole(value: string): value is TicketingRole {
  return toTicketingRole(value) !== null;
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

export function resolveTicketingRoles(
  values: readonly string[] | null | undefined,
): TicketingRole[] {
  const sanitized = sanitizeTicketingRoles(values ?? []);
  return sanitized.length > 0
    ? sanitized
    : [...DEFAULT_TICKETING_ROLES];
}
