import { strFromU8, unzipSync } from "fflate";
import { expect, it } from "vitest";
import { buildReleaseArchive } from "../scripts/package-release.mjs";

it("packages a server-ready index page and the named standalone page", () => {
  const archive = unzipSync(buildReleaseArchive("<html>latest</html>"));

  expect(strFromU8(archive["index.html"])).toBe("<html>latest</html>");
  expect(strFromU8(archive["index3.html"])).toBe("<html>latest</html>");
  expect(strFromU8(archive["README.txt"])).toContain("index.html");
});
