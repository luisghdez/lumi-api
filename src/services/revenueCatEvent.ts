import { timingSafeEqual } from "crypto";

export function webhookAuthorized(received: unknown, expected: string): boolean {
  if (typeof received !== "string" || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function entitlementUpdate(
  type: string,
  environment: string | undefined,
  entitlementIds: string[] | undefined,
): boolean | null {
  if (environment !== "PRODUCTION" || !entitlementIds?.includes("Pro")) return null;
  if (["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "NON_RENEWING_PURCHASE",
    "TEMPORARY_ENTITLEMENT_GRANT", "PURCHASE_REDEEMED"].includes(type)) return true;
  if (type === "EXPIRATION") return false;
  return null;
}
