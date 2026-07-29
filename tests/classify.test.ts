import { describe, expect, it } from "vitest";
import { classifyService } from "../lib/classify";

describe("classifyService", () => {
  it("classifies tax adjustment and filings as allowed tax work", () => {
    expect(classifyService("2025년 법인세 세무조정 신고대리")).toMatchObject({
      serviceClass: "허용 세무조정·세금신고",
      reviewRequired: false,
    });
  });

  it("classifies bookkeeping before generic tax wording", () => {
    expect(classifyService("세무기장 및 전표처리")).toMatchObject({
      serviceClass: "기장·전표처리",
      risk: "상",
      reviewRequired: true,
    });
  });

  it.each([
    ["결산분개 및 현금흐름표 작성", "재무제표 작성·회계처리 지원"],
    ["주식가치 valuation 용역", "가치평가·자산양수도"],
    ["회계처리자문 및 재무 컨설팅", "회계자문·컨설팅"],
    ["기업진단수수료", "기업진단·인증"],
  ])("classifies %s", (memo, expected) => {
    expect(classifyService(memo).serviceClass).toBe(expected);
  });

  it("marks generic service fees for evidence review", () => {
    expect(classifyService("용역수수료")).toMatchObject({
      serviceClass: "업무성격 확인 필요",
      risk: "중",
      reviewRequired: true,
    });
  });
});
