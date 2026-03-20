# Ask Failure Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize `/assistants/:id/ask` failure responses so they remain traceable and diagnosable, and lock that behavior in with focused API tests.

**Architecture:** Keep the change backend-only. The ask pipeline should continue to persist failed traces in `AskAssistantService`, then throw a trace-aware HTTP exception instead of leaking raw provider/runtime errors. The global HTTP exception filter should preserve structured exception fields like `code`, `traceId`, and `details` rather than collapsing every `HttpException` into a flat message-only shape.

**Tech Stack:** NestJS 11, Prisma, Node test runner, `@nestjs/testing`, TypeScript

---

## File Structure

### Existing files to modify

- `apps/api/src/common/http-exception.filter.ts`
- `apps/api/src/modules/assistants/ask-assistant.service.ts`
- `apps/api/test/ask-failures.test.js`
- `docs/current-progress.md`

### New files to create

- `apps/api/src/modules/assistants/ask-assistant.error.ts`
- `apps/api/test/http-exception-filter.test.js`

### Existing files to reference

- `apps/api/src/modules/traces/traces.service.ts`
- `apps/api/src/modules/assistants/assistants.controller.ts`
- `apps/api/src/main.ts`

### Explicit non-goals

- No frontend changes
- No retrieval metadata filter work
- No DOCX/parser work
- No auth or multi-tenant implementation

---

### Task 1: Lock In The Desired Failure Contract With Tests

**Files:**
- Modify: `apps/api/test/ask-failures.test.js`
- Create: `apps/api/test/http-exception-filter.test.js`

- [ ] **Step 1: Extend the ask failure regression test to expect a trace-aware exception**

Update the existing unit test so the thrown error is no longer a raw `Error`. It should assert:

```js
await assert.rejects(
  service.askAssistant({
    assistantId: "assistant-1",
    question: "why did this fail?"
  }),
  error =>
    error &&
    typeof error.getStatus === "function" &&
    error.getStatus() === 502 &&
    error.getResponse().code === "ASK_PIPELINE_FAILED" &&
    error.getResponse().traceId === "trace-1"
);
```

- [ ] **Step 2: Run the ask failure test and verify it fails for the right reason**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ask-failures.test.js
```

Expected:
- FAIL because `AskAssistantService` still throws the original error instead of a structured HTTP exception

- [ ] **Step 3: Add a focused global filter regression test**

Create `apps/api/test/http-exception-filter.test.js` to exercise `GlobalHttpExceptionFilter` directly. Use a fake `ArgumentsHost` and assert that a structured `HttpException` response keeps custom fields:

```js
const exception = new HttpException(
  {
    statusCode: 502,
    error: "Bad Gateway",
    message: "Ask pipeline failed.",
    code: "ASK_PIPELINE_FAILED",
    traceId: "trace-1",
    details: { stage: "answering" }
  },
  502
);
```

Assert that the JSON payload still includes:
- `code`
- `traceId`
- `details`
- `path`
- `timestamp`

- [ ] **Step 4: Run the new filter test and verify it fails**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/http-exception-filter.test.js
```

Expected:
- FAIL because the current filter drops custom fields from `HttpException` payloads

---

### Task 2: Implement Trace-Aware Ask Failures

**Files:**
- Create: `apps/api/src/modules/assistants/ask-assistant.error.ts`
- Modify: `apps/api/src/modules/assistants/ask-assistant.service.ts`
- Modify: `apps/api/src/common/http-exception.filter.ts`

- [ ] **Step 1: Add a dedicated ask failure exception type**

Create `apps/api/src/modules/assistants/ask-assistant.error.ts`:

```ts
import { BadGatewayException } from "@nestjs/common";

export class AskAssistantError extends BadGatewayException {
  constructor(input: { message: string; traceId?: string; details?: Record<string, unknown> }) {
    super({
      statusCode: 502,
      error: "Bad Gateway",
      message: input.message,
      code: "ASK_PIPELINE_FAILED",
      traceId: input.traceId ?? null,
      details: input.details ?? null
    });
  }
}
```

- [ ] **Step 2: Update the ask pipeline to throw the new exception after trace persistence**

In `apps/api/src/modules/assistants/ask-assistant.service.ts`:
- keep the existing trace creation/update flow
- in the `catch` block, update the trace first
- then throw `new AskAssistantError(...)`

Include enough detail to be useful without exposing giant raw payloads. For the first version, pass:
- persisted `trace.id`
- a stable message such as `"Ask pipeline failed."`
- compact details like `{ stage: "answering", cause: message }`

- [ ] **Step 3: Preserve structured fields in the global HTTP exception filter**

Adjust `apps/api/src/common/http-exception.filter.ts` so `HttpException` responses:
- keep the existing default fields
- preserve additional object properties from `exception.getResponse()`
- still normalize string payloads safely

Recommended shape:

```ts
const responseBody =
  typeof payload === "string"
    ? { message: payload }
    : payload && typeof payload === "object"
      ? payload
      : { message: exception.message };

response.status(statusCode).json({
  statusCode,
  error: HttpStatus[statusCode] ?? "Error",
  path: request.url,
  timestamp: new Date().toISOString(),
  ...responseBody
});
```

Do not regress the Zod validation error branch.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run:

```bash
pnpm --filter @rag-system/api build
node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js
```

Expected:
- PASS

---

### Task 3: Document The New Failure Contract And Re-Run API Verification

**Files:**
- Modify: `docs/current-progress.md`

- [ ] **Step 1: Add an incremental progress note for ask failure diagnostics**

Append a short follow-up update that records:
- ask failures now return a structured API error payload
- the payload includes a stable error code and `traceId`
- the global exception filter preserves structured `HttpException` fields

- [ ] **Step 2: Keep docs focused**

Update only the incremental section. Do not rewrite the full progress document.

- [ ] **Step 3: Run repository-level API verification**

Run:

```bash
pnpm test:api
```

Expected:
- PASS

---

## Final Verification

- [ ] Run:

```bash
pnpm --filter @rag-system/api build
```

- [ ] Run:

```bash
node --test apps/api/test/ask-failures.test.js apps/api/test/http-exception-filter.test.js
```

- [ ] Run:

```bash
pnpm test:api
```

- [ ] Confirm scope boundaries remain intact:

- backend-only change
- no retrieval algorithm changes
- no frontend work
- no auth or tenant implementation
