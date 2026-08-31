import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { strToU8, zipSync } from "fflate";

const README = `독립성 대사 배포 안내

1. 압축을 해제한 전체 파일을 웹 서버의 같은 폴더에 올립니다.
2. 기본 주소로 사용할 때는 index.html에 접속합니다.
3. 기존 주소를 유지할 때는 index3.html에 접속해도 동일하게 작동합니다.
4. 두 HTML 파일은 동일한 최신 프로그램이며 JavaScript, CSS, PDF 처리 모듈을 내부에 포함합니다.
5. AI 모델이나 API key는 사용하지 않으며 업로드 파일은 브라우저 안에서 처리됩니다.

주의: file:// 방식으로 직접 열기보다 HTTP(S) 웹 서버에서 제공하십시오.
`;

export function buildReleaseArchive(standaloneHtml) {
  const html = strToU8(standaloneHtml);
  return zipSync({
    "index.html": html,
    "index3.html": html,
    "README.txt": strToU8(README),
  }, { level: 9 });
}

async function main() {
  const standaloneHtml = await readFile("pages-dist/index3.html", "utf8");
  await writeFile("pages-dist/index.html", standaloneHtml, "utf8");
  await writeFile("pages-dist/독립성대사.zip", buildReleaseArchive(standaloneHtml));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
