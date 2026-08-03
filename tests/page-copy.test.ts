import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "../app/page";

it("labels the reference upload area as prior-submission materials", () => {
  const html = renderToStaticMarkup(createElement(Home));
  expect(html).toContain("기준자료(사전제출자료 등)");
});
