import { getSessionUser, type AdminVerificationResult } from "./auth";
import {
  canUseActionForEvent,
  getEffectivePermissions,
  type EffectivePermissions,
} from "./permissions";
import { getSupabaseClient } from "./supabase";
import {
  isEventScoped,
  parseAudiences,
  type AudienceSegment,
} from "./campaignAudience";

type CampaignScopeInput = {
  audiences: AudienceSegment[];
  eventId?: string | null;
  includeHeroCard?: boolean | null;
  feedbackEventId?: string | null;
  includeFeedbackPrompt?: boolean | null;
  cancelCalloutEventId?: string | null;
  includeCancelCallout?: boolean | null;
};

type StoredCampaignScopeInput = Omit<CampaignScopeInput, "audiences"> & {
  audiences: string;
};

function campaignScope(input: CampaignScopeInput) {
  const eventIds = new Set<string>();
  let hasGlobalAudience = false;

  for (const segment of input.audiences) {
    if (isEventScoped(segment.type)) {
      for (const eventId of segment.eventIds) {
        eventIds.add(eventId);
      }
    } else {
      hasGlobalAudience = true;
    }
  }

  if (input.includeHeroCard && input.eventId) {
    eventIds.add(input.eventId);
  }
  if (input.includeFeedbackPrompt && input.feedbackEventId) {
    eventIds.add(input.feedbackEventId);
  }
  if (input.includeCancelCallout && input.cancelCalloutEventId) {
    eventIds.add(input.cancelCalloutEventId);
  }

  return { eventIds, hasGlobalAudience };
}

export function canManageCampaignScope(
  perms: EffectivePermissions,
  input: CampaignScopeInput,
): boolean {
  if (perms.isAdmin || perms.allEventActions.has("campaigns.send")) {
    return true;
  }

  const { eventIds, hasGlobalAudience } = campaignScope(input);
  if (hasGlobalAudience || eventIds.size === 0) {
    return false;
  }

  for (const eventId of eventIds) {
    if (!canUseActionForEvent(perms, "campaigns.send", eventId)) {
      return false;
    }
  }

  return true;
}

export function canManageStoredCampaignScope(
  perms: EffectivePermissions,
  input: StoredCampaignScopeInput,
): boolean {
  return canManageCampaignScope(perms, {
    ...input,
    audiences: parseAudiences(input.audiences),
  });
}

export async function requireCampaignSendPermission(
  input: CampaignScopeInput,
): Promise<AdminVerificationResult> {
  const user = await getSessionUser();
  if (!user?.email) {
    return { authorized: false, error: "Not authenticated" };
  }

  const perms = await getEffectivePermissions(user.email);
  if (!canManageCampaignScope(perms, input)) {
    return { authorized: false, error: "Not authorized" };
  }

  return {
    authorized: true,
    email: user.email,
    adminClient: getSupabaseClient(),
  };
}
