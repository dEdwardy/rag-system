import { test } from 'vitest';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const apiModuleUrl = pathToFileURL(
  resolve(__dirname, '../src/lib/api.ts')
).href;

async function loadApiModule() {
  return import(apiModuleUrl);
}

test('apiStreamRequest rejects when the SSE stream emits an error event', async () => {
  const { apiStreamRequest } = await loadApiModule();
  const originalFetch = global.fetch;
  const seenEvents = [];

  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(
              'id: 1\nevent: status\ndata: {"type":"status","phase":"started"}\n\n'
            )
          );
          controller.enqueue(
            encoder.encode(
              'id: 2\nevent: error\ndata: {"type":"error","message":"Ask pipeline failed.","code":"ASK_PIPELINE_FAILED","traceId":"trace-stream-1","details":{"stage":"answering"},"retryable":true}\n\n'
            )
          );
          controller.close();
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8'
        }
      }
    );

  try {
    await assert.rejects(
      () =>
        apiStreamRequest('/assistants/default-assistant/ask/stream', {
          method: 'POST',
          body: {
            question: 'Trigger stream failure.'
          },
          onEvent: (event) => {
            seenEvents.push(event);
          }
        }),
      (error) => {
        assert.equal(error instanceof Error, true);
        assert.equal(error.message, 'Ask pipeline failed.');
        assert.equal(error.code, 'ASK_PIPELINE_FAILED');
        assert.equal(error.traceId, 'trace-stream-1');
        assert.deepEqual(error.details, {
          stage: 'answering'
        });
        assert.equal(error.retryable, true);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenEvents, [
    {
      type: 'status',
      phase: 'started'
    },
    {
      type: 'error',
      message: 'Ask pipeline failed.',
      code: 'ASK_PIPELINE_FAILED',
      traceId: 'trace-stream-1',
      details: {
        stage: 'answering'
      },
      retryable: true
    }
  ]);
});

test('apiStreamRequest preserves structured diagnostics from pre-stream HTTP errors', async () => {
  const { apiStreamRequest } = await loadApiModule();
  const originalFetch = global.fetch;
  const seenEvents = [];

  global.fetch = async () =>
    new Response(
      JSON.stringify({
        statusCode: 502,
        error: 'Bad Gateway',
        message: 'Ask pipeline failed.',
        code: 'ASK_PIPELINE_FAILED',
        traceId: 'trace-http-1',
        details: {
          stage: 'retrieval',
          cause: 'Failed to fetch web page: Request timed out.'
        }
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      }
    );

  try {
    await assert.rejects(
      () =>
        apiStreamRequest('/assistants/default-assistant/ask/stream', {
          method: 'POST',
          body: {
            question: 'Trigger pre-stream failure.'
          },
          onEvent: (event) => {
            seenEvents.push(event);
          }
        }),
      (error) => {
        assert.equal(error instanceof Error, true);
        assert.equal(error.message, 'Ask pipeline failed.');
        assert.equal(error.code, 'ASK_PIPELINE_FAILED');
        assert.equal(error.traceId, 'trace-http-1');
        assert.deepEqual(error.details, {
          stage: 'retrieval',
          cause: 'Failed to fetch web page: Request timed out.'
        });
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenEvents, []);
});

test('apiStreamRequest parses split, CRLF, multi-line, comment and deduplicated SSE frames', async () => {
  const { apiStreamRequest } = await loadApiModule();
  const originalFetch = global.fetch;
  const seenEvents = [];
  const chunks = [
    'id: 1\r\nevent: status\r\ndata: {"type":"status",',
    '"phase":"started"}\r\n\r\n',
    ': ping\n\n',
    'id: 2\nevent: answer_delta\ndata: {"type":"answer_delta",\ndata: "delta":"Hel"}\n\n',
    'id: 2\nevent: answer_delta\ndata: {"type":"answer_delta","delta":"DUPLICATE"}\n\n',
    'data: not-json\n\n',
    'id: 3\nevent: answer_delta\ndata: {"type":"answer_delta","delta":"lo"}\n\n'
  ];

  global.fetch = async () =>
    new Response(
      new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8'
        }
      }
    );

  try {
    await apiStreamRequest('/assistants/default-assistant/ask/stream', {
      method: 'POST',
      body: {
        question: 'Parse SSE frames.'
      },
      onEvent: (event) => {
        seenEvents.push(event);
      }
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(seenEvents, [
    {
      type: 'status',
      phase: 'started'
    },
    {
      type: 'answer_delta',
      delta: 'Hel'
    },
    {
      type: 'answer_delta',
      delta: 'lo'
    }
  ]);
});
