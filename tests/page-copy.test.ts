import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "../app/page";

it("renders the unified independence reconciliation upload", () => {
  const html = renderToStaticMarkup(createElement(Home));
  expect(html).toContain("독립성 대사");
  expect(html).toContain("파일 첨부");
  expect(html).toContain("사전제출자료와 매출장 대사 후 특이사항 추출");
  expect(html.match(/type="file"/g)).toHaveLength(1);
});
