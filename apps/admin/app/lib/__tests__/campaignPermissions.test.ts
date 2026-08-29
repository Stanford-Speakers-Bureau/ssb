import { describe, expect, test } from "bun:test";
import {
  canManageCampaignScope,
  canManageStoredCampaignScope,
} from "../campaignPermissions";
import type { AudienceSegment } from "../campaignAudience";
import type { EffectivePermissions, PermissionAction } from "../permissions";

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

const eventAudience = (eventIds: string[]): AudienceSegment => ({
  type: "event_ticketholders",
  eventIds,
});

const globalAudience: AudienceSegment = {
  type: "newsletter",
  eventIds: [],
};

describe("canManageCampaignScope", () => {
  test("allows admins and all-event campaign senders", () => {
    expect(
      canManageCampaignScope(perms({ isAdmin: true }), {
        audiences: [globalAudience],
      }),
    ).toBe(true);

    expect(
      canManageCampaignScope(perms({ allEventActions: ["campaigns.send"] }), {
        audiences: [globalAudience],
      }),
    ).toBe(true);
  });

  test("requires campaigns.send for every event-scoped audience", () => {
    const effective = perms({
      actions: ["campaigns.send"],
      eventScopes: { "campaigns.send": ["event-1", "event-2"] },
    });

    expect(
      canManageCampaignScope(effective, {
        audiences: [eventAudience(["event-1", "event-2"])],
      }),
    ).toBe(true);

    expect(
      canManageCampaignScope(effective, {
        audiences: [eventAudience(["event-1", "event-3"])],
      }),
    ).toBe(false);
  });

  test("requires scoped permission for hero, feedback, and cancel callout events", () => {
    const effective = perms({
      actions: ["campaigns.send"],
      eventScopes: {
        "campaigns.send": ["audience-event", "hero-event", "feedback-event"],
      },
    });

    expect(
      canManageCampaignScope(effective, {
        audiences: [eventAudience(["audience-event"])],
        eventId: "hero-event",
        includeHeroCard: true,
        feedbackEventId: "feedback-event",
        includeFeedbackPrompt: true,
        cancelCalloutEventId: "cancel-event",
        includeCancelCallout: true,
      }),
    ).toBe(false);

    expect(
      canManageCampaignScope(
        perms({
          actions: ["campaigns.send"],
          eventScopes: {
            "campaigns.send": [
              "audience-event",
              "hero-event",
              "feedback-event",
              "cancel-event",
            ],
          },
        }),
        {
          audiences: [eventAudience(["audience-event"])],
          eventId: "hero-event",
          includeHeroCard: true,
          feedbackEventId: "feedback-event",
          includeFeedbackPrompt: true,
          cancelCalloutEventId: "cancel-event",
          includeCancelCallout: true,
        },
      ),
    ).toBe(true);
  });

  test("denies global audiences for non-admin event-scoped senders", () => {
    const effective = perms({
      actions: ["campaigns.send"],
      eventScopes: { "campaigns.send": ["event-1"] },
    });

    expect(
      canManageCampaignScope(effective, {
        audiences: [globalAudience],
      }),
    ).toBe(false);
  });

  test("parses stored campaign audiences before checking scope", () => {
    const effective = perms({
      actions: ["campaigns.send"],
      eventScopes: { "campaigns.send": ["event-1"] },
    });

    expect(
      canManageStoredCampaignScope(effective, {
        audiences: JSON.stringify([eventAudience(["event-1"])]),
      }),
    ).toBe(true);

    expect(
      canManageStoredCampaignScope(effective, {
        audiences: JSON.stringify([globalAudience]),
      }),
    ).toBe(false);
  });
});
