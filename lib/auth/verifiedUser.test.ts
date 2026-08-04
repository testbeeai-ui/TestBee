import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authedUserFromUser, verifyAuthedUser, verifyClaims } from "./verifiedUser";
import type { User } from "@supabase/supabase-js";

type ClaimsResult = Awaited<ReturnType<SupabaseClient["auth"]["getClaims"]>>;

function clientReturning(result: unknown): SupabaseClient {
  return {
    auth: { getClaims: vi.fn().mockResolvedValue(result as ClaimsResult) },
  } as unknown as SupabaseClient;
}

function claimsOk(claims: Record<string, unknown>) {
  return { data: { claims, header: { alg: "ES256" }, signature: new Uint8Array() }, error: null };
}

describe("verifyClaims", () => {
  it("maps a full set of claims to the authed user", async () => {
    const client = clientReturning(
      claimsOk({
        sub: "user-1",
        email: "a@b.com",
        phone: "+911234567890",
        role: "authenticated",
        aud: "authenticated",
        is_anonymous: false,
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Asha" },
        exp: 1_800_000_000,
      })
    );

    expect(await verifyClaims(client)).toEqual({
      user: {
        id: "user-1",
        email: "a@b.com",
        phone: "+911234567890",
        role: "authenticated",
        aud: "authenticated",
        is_anonymous: false,
        app_metadata: { provider: "google" },
        user_metadata: { full_name: "Asha" },
      },
      expiresAtMs: 1_800_000_000_000,
    });
  });

  it("defaults optional claims rather than emitting undefined", async () => {
    const result = await verifyClaims(clientReturning(claimsOk({ sub: "user-2" })));

    expect(result?.user).toEqual({
      id: "user-2",
      email: null,
      phone: null,
      role: null,
      aud: null,
      is_anonymous: false,
      app_metadata: {},
      user_metadata: {},
    });
    expect(result?.expiresAtMs).toBeNull();
  });

  it("takes the first entry when aud is an array", async () => {
    const result = await verifyClaims(
      clientReturning(claimsOk({ sub: "user-3", aud: ["authenticated", "other"] }))
    );

    expect(result?.user.aud).toBe("authenticated");
  });

  it("rejects a token whose signature or expiry did not verify", async () => {
    const client = clientReturning({ data: null, error: new Error("Invalid JWT signature") });

    expect(await verifyClaims(client)).toBeNull();
    expect(await verifyAuthedUser(client)).toBeNull();
  });

  it("rejects rather than throws when getClaims throws on an undecodable token", async () => {
    const client = {
      auth: { getClaims: vi.fn().mockRejectedValue(new Error("Missing exp claim")) },
    } as unknown as SupabaseClient;

    await expect(verifyClaims(client, "malformed")).resolves.toBeNull();
  });

  it("rejects verified claims that carry no subject", async () => {
    expect(await verifyClaims(clientReturning(claimsOk({ email: "a@b.com" })))).toBeNull();
    expect(await verifyClaims(clientReturning(claimsOk({ sub: "" })))).toBeNull();
  });

  it("passes an explicit bearer token through to verification", async () => {
    const client = clientReturning(claimsOk({ sub: "user-4" }));

    await verifyClaims(client, "bearer-token");

    expect(client.auth.getClaims).toHaveBeenCalledWith("bearer-token");
  });
});

describe("authedUserFromUser", () => {
  it("narrows a full Supabase user to the same shape", () => {
    const user = {
      id: "user-5",
      email: "c@d.com",
      phone: "",
      role: "authenticated",
      aud: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Ravi" },
      created_at: "2026-01-01T00:00:00Z",
      last_sign_in_at: "2026-07-01T00:00:00Z",
    } as unknown as User;

    expect(authedUserFromUser(user)).toEqual({
      id: "user-5",
      email: "c@d.com",
      phone: null,
      role: "authenticated",
      aud: "authenticated",
      is_anonymous: false,
      app_metadata: { provider: "email" },
      user_metadata: { full_name: "Ravi" },
    });
  });
});
