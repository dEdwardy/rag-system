import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const messagesPath = resolve(__dirname, "../src/i18n/messages.ts");

test("Chinese i18n copy includes readable core navigation and page labels", () => {
  const source = readFileSync(messagesPath, "utf8");

  assert.match(source, /subtitle:\s*"基于可复用 RAG 内核构建的个人知识库"/);
  assert.match(source, /noDescription:\s*"暂无描述"/);
  assert.match(source, /documents:\s*"文档数"/);
  assert.match(source, /title:\s*"运行摘要"/);
  assert.match(source, /emptyDescription:\s*"上传文档后，这个知识库才会成为可用的检索来源。"/);
  assert.doesNotMatch(source, /鏂囨。|鐭ヨ瘑搴|鍔╂墜|鍩轰簬/);
});
