import { describe, expect, it } from "vitest";
import { codeFromHash, openPath } from "../../lib/lti";

describe("LTI launch code", () => {
  const code = "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWo";

  it("reads the code from after #", () => {
    expect(codeFromHash("#" + code)).toBe(code);
    expect(codeFromHash(code)).toBe(code);
  });

  it("refuses anything that isn't a code", () => {
    for (const bad of ["", "#", "#short", "#" + code + "&next=/x", "#" + code + "/../x", "#<script>"]) {
      expect(codeFromHash(bad)).toBeNull();
    }
  });

  it("keeps the code after # on the way to the new tab", () => {
    expect(openPath(code)).toBe("/lti/open#" + code);
  });
});
