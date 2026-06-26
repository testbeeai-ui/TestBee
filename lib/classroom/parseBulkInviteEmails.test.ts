import { describe, expect, it } from "vitest";
import { parseBulkInviteEmails } from "./parseBulkInviteEmails";

describe("parseBulkInviteEmails", () => {
  it("parses comma and newline separated emails", () => {
    const raw = "a@school.com, b@school.com\nc@school.com";
    expect(parseBulkInviteEmails(raw)).toEqual([
      "a@school.com",
      "b@school.com",
      "c@school.com",
    ]);
  });

  it("dedupes and skips invalid tokens", () => {
    const raw = "dup@test.com dup@test.com not-an-email dup@test.com";
    expect(parseBulkInviteEmails(raw)).toEqual(["dup@test.com"]);
  });
});
