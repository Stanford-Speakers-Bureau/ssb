// Notification Messages
export const NOTIFY_MESSAGES = {
  SUCCESS: "You'll be notified when the speaker is announced!",
  ALREADY_SIGNED_UP: "You'll be notified when the speaker is announced!",
  SIGNING_UP: "Signing up...",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_MISSING_SPEAKER_ID: "Missing required field: speaker_id",
  ERROR_EVENT_NOT_FOUND: "Event not found",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Stanford.",
} as const;

// Suggest Speaker Messages
export const SUGGEST_MESSAGES = {
  SUCCESS: "Thank you! Your suggestion has been submitted.",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_MISSING_SPEAKER: "Please enter a speaker name.",
  ERROR_TOO_LONG: "Speaker name must be 500 characters or less.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Stanford.",
  ERROR_BANNED: "You have been banned from making suggestions.",
} as const;

export const BANNER_MESSAGES = {
  NOTIFY_MESSAGE: "GET EARLY ACCESS TO OUR NEXT SPEAKER!!",
  EVENT_MESSAGE: " is coming to Stanford!",
  EVENT_MESSAGE_PLURAL: " are coming to Stanford!",
  COUNTDOWN_REVEAL_MESSAGE: "Speaker Reveal in",
  COUNTDOWN_TICKETS_MESSAGE: "FREE Tickets Go Live in",
  COUNTDOWN_EVENT_MESSAGE: "Event starts in",
};

export const PACIFIC_TIMEZONE = "America/Los_Angeles";

// Reminder sends are intentionally throttled to keep long-running admin requests
// within a predictable throughput envelope.
export const REMINDER_EMAIL_BATCH_SIZE = 50;
export const REMINDER_EMAIL_MIN_BATCH_DURATION_MS = 1000;

export const IMPORTANT_NOTICE_ITEMS = [
  { emoji: "🎒", text: "No bags allowed" },
  { emoji: "📵", text: "No electronics larger than a cell phone" },
  { emoji: "❌", text: "Ticket is non-transferable" },
  { emoji: "🪪", text: "Bring a valid photo ID" },
] as const;

export const REFERRAL_MESSAGE = "Refer 10 people to earn a front row seat!";

// Referral leaderboard - threshold for highlighting high performers
export const HIGH_PERFORMER_CHECKIN_THRESHOLD = 10;
