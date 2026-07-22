export type AuthActor = {
  userId: string;
  sessionId: string;
  organizationId: string | null;
  membershipId: string | null;
  tokenVersion: number;
  email: string;
};
