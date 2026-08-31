import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import Home from "../app/page";

it("offers the server-ready release package for download", () => {
  const html = renderToStaticMarkup(createElement(Home));
  expect(html).toContain('href="./독립성대사.zip"');
  expect(html).toContain("독립성대사.zip");
});
