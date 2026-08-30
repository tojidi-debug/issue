import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "../app/page";

it("renders the unified independence reconciliation upload", () => {
  const html = renderToStaticMarkup(createElement(Home));
  expect(html).toContain("독립성 대사");
  expect(html).toContain("대사 파일 통합 업로드");
  expect(html).toContain("자료 성격을 자동 판별");
  expect(html.match(/type="file"/g)).toHaveLength(1);
});
