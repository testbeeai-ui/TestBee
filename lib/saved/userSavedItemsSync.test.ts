import { describe, expect, it } from "vitest";
import {
  diffRemovedContentIds,
  getSavedItemContentId,
} from "./userSavedItemsSync";

describe("userSavedItemsSync", () => {
  it("diffRemovedContentIds returns ids absent from next payload", () => {
    const removed = diffRemovedContentIds(
      ["a", "b", "c"],
      [{ id: "a" }, { id: "c" }],
      "saved_bit"
    );
    expect(removed).toEqual(["b"]);
  });

  it("uses postId for community posts", () => {
    expect(
      getSavedItemContentId({ postId: "post-1", id: "legacy" }, "saved_community_post")
    ).toBe("post-1");
  });
});
