import type { E2ESessionUser } from "../../e2e/helpers/session";

let currentUser: E2ESessionUser | null = null;

export function setCurrentTestUser(user: E2ESessionUser | null): void {
  currentUser = user;
}

export async function getCurrentTestUser(): Promise<E2ESessionUser | null> {
  return currentUser;
}
