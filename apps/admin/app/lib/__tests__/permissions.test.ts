import { describe, expect, test } from "bun:test";
import {
  canUseActionForEvent,
  grantSatisfies,
  hasAnyPermission,
  permittedEventIds,
  permittedEventIdsForAction,
  type EffectivePermissions,
  type PermissionAction,
} from "../permissions";

function perms(input: {
  isAdmin?: boolean;
  actions?: PermissionAction[];
  eventScopes?: Partial<Record<PermissionAction, string[]>>;
  allEventActions?: PermissionAction[];
}): EffectivePermissions {
  const eventScopes = new Map<PermissionAction, Set<string>>();
  for (const [action, eventIds] of Object.entries(input.eventScopes ?? {})) {
    eventScopes.set(action as PermissionAction, new Set(eventIds));
  }

  return {
    isAdmin: input.isAdmin ?? false,
    actions: new Set(input.actions ?? []),
    eventScopes,
    allEventActions: new Set(input.allEventActions ?? []),
  };
}

function sortedIds(ids: Set<string> | null): string[] | null {
  return ids ? Array.from(ids).sort() : null;
}

describe("grantSatisfies", () => {
  test("lets ticket edit and delete grants satisfy ticket view checks", () => {
    expect(grantSatisfies("tickets.edit", "tickets.view")).toBe(true);
    expect(grantSatisfies("tickets.delete", "tickets.view")).toBe(true);
  });

  test("does not let lower privileges satisfy mutating checks", () => {
    expect(grantSatisfies("tickets.view", "tickets.edit")).toBe(false);
    expect(grantSatisfies("tickets.scan", "tickets.edit")).toBe(false);
  });
});

describe("effective permission helpers", () => {
  test("admin can use every action for every event", () => {
    const effective = perms({ isAdmin: true });

    expect(canUseActionForEvent(effective, "tickets.delete", "event-1")).toBe(
      true,
    );
    expect(permittedEventIds(effective)).toBeNull();
    expect(permittedEventIdsForAction(effective, "tickets.delete")).toBeNull();
    expect(hasAnyPermission(effective)).toBe(true);
  });

  test("all-event action grants work for any event and remove event filtering", () => {
    const effective = perms({
      actions: ["tickets.view"],
      allEventActions: ["tickets.view"],
    });

    expect(canUseActionForEvent(effective, "tickets.view", "event-1")).toBe(
      true,
    );
    expect(canUseActionForEvent(effective, "tickets.view", "event-2")).toBe(
      true,
    );
    expect(permittedEventIds(effective)).toBeNull();
    expect(permittedEventIdsForAction(effective, "tickets.view")).toBeNull();
  });

  test("event-scoped actions only work on their granted event ids", () => {
    const effective = perms({
      actions: ["tickets.view", "events.edit"],
      eventScopes: {
        "tickets.view": ["event-1", "event-2"],
        "events.edit": ["event-2"],
      },
    });

    expect(canUseActionForEvent(effective, "tickets.view", "event-1")).toBe(
      true,
    );
    expect(canUseActionForEvent(effective, "tickets.view", "event-3")).toBe(
      false,
    );
    expect(canUseActionForEvent(effective, "tickets.view", null)).toBe(false);
    expect(sortedIds(permittedEventIds(effective))).toEqual([
      "event-1",
      "event-2",
    ]);
    expect(
      sortedIds(permittedEventIdsForAction(effective, "events.edit")),
    ).toEqual(["event-2"]);
  });

  test("global-only permissions do not grant all event visibility", () => {
    const effective = perms({
      actions: ["suggestions.manage"],
      allEventActions: ["suggestions.manage"],
    });

    expect(canUseActionForEvent(effective, "suggestions.manage", null)).toBe(
      true,
    );
    expect(sortedIds(permittedEventIds(effective))).toEqual([]);
    expect(hasAnyPermission(effective)).toBe(true);
  });

  test("empty permissions deny event actions", () => {
    const effective = perms({});

    expect(hasAnyPermission(effective)).toBe(false);
    expect(canUseActionForEvent(effective, "tickets.view", "event-1")).toBe(
      false,
    );
    expect(sortedIds(permittedEventIds(effective))).toEqual([]);
    expect(
      sortedIds(permittedEventIdsForAction(effective, "tickets.view")),
    ).toEqual([]);
  });
});
