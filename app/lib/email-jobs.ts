import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  sendTicketEmail,
  sendWaitlistEmail,
  type TicketEmailData,
  type WaitlistEmailData,
} from "./email";

export type TicketEmailJob = {
  kind: "ticket_email";
  payload: TicketEmailData;
};

export type WaitlistEmailJob = {
  kind: "waitlist_email";
  payload: WaitlistEmailData;
};

export type EmailJob = TicketEmailJob | WaitlistEmailJob;

type QueueEnv = CloudflareEnv & {
  EMAIL_JOBS_QUEUE?: Queue<EmailJob>;
};

export function createTicketEmailJob(payload: TicketEmailData): TicketEmailJob {
  return {
    kind: "ticket_email",
    payload,
  };
}

export function createWaitlistEmailJob(
  payload: WaitlistEmailData,
): WaitlistEmailJob {
  return {
    kind: "waitlist_email",
    payload,
  };
}

export function getEmailJobsQueue(): Queue<EmailJob> | null {
  try {
    const { env } = getCloudflareContext();
    return (env as QueueEnv).EMAIL_JOBS_QUEUE ?? null;
  } catch {
    return null;
  }
}

export async function enqueueEmailJob(job: EmailJob): Promise<boolean> {
  const queue = getEmailJobsQueue();
  if (!queue) {
    return false;
  }

  try {
    await queue.send(job);
    return true;
  } catch (error) {
    console.error("Email queue enqueue error:", error);
    return false;
  }
}

export async function processEmailJob(job: EmailJob): Promise<void> {
  switch (job.kind) {
    case "ticket_email":
      await sendTicketEmail(job.payload);
      return;
    case "waitlist_email":
      await sendWaitlistEmail(job.payload);
      return;
    default: {
      const exhaustive: never = job;
      throw new Error(`Unsupported email job: ${JSON.stringify(exhaustive)}`);
    }
  }
}
