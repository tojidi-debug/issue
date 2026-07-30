import { describe, expect, it } from "vitest";
import { getReasonTone } from "../lib/presentation";

describe("getReasonTone", () => {
  it.each([
    ["재무제표 작성지원", "수정분개 제시", "accounting"],
    ["회계처리 자문", "구체적 회계처리 제시", "accounting"],
    ["기장", "기업진단과 기장 동시수행", "bookkeeping"],
    ["가치평가", "주요 자산 양수도", "valuation"],
    ["재무영향 컨설팅", "추가 확인", "consulting"],
    ["기타", "단순 수수료", "neutral"],
  ] as const)("%s / %s → %s", (serviceClass, issue, expected) => {
    expect(getReasonTone({ serviceClass, issue })).toBe(expected);
  });
});
