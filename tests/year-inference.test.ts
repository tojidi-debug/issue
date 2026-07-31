import { expect, it } from "vitest";
import { inferYearFromRows } from "../lib/adaptive-sales";

it("infers the year from dates and ignores voucher and amount numbers", () => {
  expect(
    inferYearFromRows([
      ["번호", "일자", "적요", "공급가액", "부가가치세"],
      [50001, "2025/01/03", "기장료 가나다", 100000, 10000],
    ]),
  ).toBe(2025);
});
