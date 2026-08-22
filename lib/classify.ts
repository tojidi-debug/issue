import type { ServiceClassification } from "./domain";

const RULES: Array<{
  pattern: RegExp;
  result: ServiceClassification;
}> = [
  {
    pattern: /기장|장부|전표\s*처리|회계처리\s*대행|세무기장/i,
    result: {
      serviceClass: "기장·전표처리",
      risk: "상",
      reviewRequired: true,
      reason: "기장 또는 전표처리 업무 가능성",
    },
  },
  {
    pattern:
      /재무제표.*(작성|대리|지원)|결산서.*(작성|대리|지원)|법인결산|결산분개|수정분개|현금흐름표.*작성|지분법.*계산|연결분개|이연법인세.*계산|파생상품.*평가|금융비용\s*자본화|채권채무\s*재조정|스탁옵션|전환사채.*회계처리/i,
    result: {
      serviceClass: "재무제표 작성·회계처리 지원",
      risk: "상",
      reviewRequired: true,
      reason: "재무제표 대리작성·작성지원 또는 수정분개 제시 가능성",
    },
  },
  {
    pattern:
      /가치평가|valuation|밸류에이션|주식가치|기업가치|자산\s*양수도|영업권|무형자산|공정가치|합병비율|평가수수료/i,
    result: {
      serviceClass: "가치평가·자산양수도",
      risk: "상",
      reviewRequired: true,
      reason: "가치평가 또는 주요 자산 양수도 자문 가능성",
    },
  },
  {
    pattern:
      /경영진?\s*(?:역할|의사결정|판단)|임원\s*(?:역할|의사결정)|거래\s*승인|업무\s*집행|회계\s*자문|회계처리\s*자문|재무\s*자문|컨설팅|재무\s*실사|due\s*diligence|m&a|인수\s*자문|매각\s*자문|양수도\s*자문/i,
    result: {
      serviceClass: "회계자문·컨설팅",
      risk: "상",
      reviewRequired: true,
      reason: "경영진 의사결정 또는 재무정보에 영향을 미치는 자문·컨설팅 가능성",
    },
  },
  {
    pattern: /급여\s*대행|4대보험|파견|인력\s*지원|인적\s*용역/i,
    result: {
      serviceClass: "인적용역·업무대행",
      risk: "상",
      reviewRequired: true,
      reason: "회계기록 또는 재무정보 작성 관여 가능성",
    },
  },
  {
    pattern:
      /세무\s*조정|법인세\s*조정|소득세\s*조정|조정\s*수수료|조정료|세무\s*신고|신고\s*수수료|신고\s*대행|신고\s*대리|원천징수|원천세\s*신고|부가\s*가치세|부가세|종합소득세|법인세\s*신고|양도세|상속세|증여세|연말정산/i,
    result: {
      serviceClass: "허용 세무조정·세금신고",
      risk: "낮음",
      reviewRequired: false,
      reason: "허용되는 세무조정·세금신고 업무",
    },
  },
  {
    pattern: /감사\s*수수료|회계\s*감사|외부\s*감사|외감|감사\s*보수|감사/i,
    result: {
      serviceClass: "외부감사",
      risk: "낮음",
      reviewRequired: false,
      reason: "감사업무 자체 보수",
    },
  },
  {
    pattern:
      /기업\s*진단|진단\s*수수료|진단\s*검토|재무\s*진단|검증\s*용역|검증\s*수수료|검증\s*보고서|정산\s*보고서|확인서|인증\s*업무|합의된\s*절차/i,
    result: {
      serviceClass: "기업진단·인증",
      risk: "중",
      reviewRequired: true,
      reason: "독립성 검토가 필요한 별도 인증업무",
    },
  },
  {
    pattern: /검토|검증|확인|보고서|용역|보수료|수수료|대행|자문|세무\s*컨설팅|세무\s*자문/i,
    result: {
      serviceClass: "업무성격 확인 필요",
      risk: "중",
      reviewRequired: true,
      reason: "적요만으로 업무 성격을 확정하기 어려움",
    },
  },
];

export function classifyService(...parts: unknown[]): ServiceClassification {
  const text = parts
    .map((part) => String(part ?? ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return { ...rule.result };
  }
  return {
    serviceClass: "기타",
    risk: "낮음",
    reviewRequired: false,
    reason: "독립성 검토 키워드가 확인되지 않음",
  };
}
