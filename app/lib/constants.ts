// Notification Messages
export const NOTIFY_MESSAGES = {
  SUCCESS: "You'll be notified when the speaker is announced!",
  ALREADY_SIGNED_UP: "You'll be notified when the speaker is announced!",
  SIGNING_UP: "Signing up...",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_MISSING_SPEAKER_ID: "Missing required field: speaker_id",
  ERROR_EVENT_NOT_FOUND: "Event not found",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Google.",
} as const;

// Suggest Speaker Messages
export const SUGGEST_MESSAGES = {
  SUCCESS: "Thank you! Your suggestion has been submitted.",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_MISSING_SPEAKER: "Please enter a speaker name.",
  ERROR_TOO_LONG: "Speaker name must be 500 characters or less.",
  ERROR_NOT_AUTHENTICATED: "Not authenticated. Please sign in with Google.",
} as const;

