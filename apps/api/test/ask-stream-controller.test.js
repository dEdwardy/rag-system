import assert from 'node:assert/strict';
import { NotFoundException } from '@nestjs/common';
import { test } from 'vitest';

import { AskAssistantError } from '../src/modules/assistants/ask-assistant.error.ts';
import { AssistantsController } from '../src/modules/assistants/assistants.controller.ts';

test('askAssistantStream appends structured error diagnostics after stream events have started', async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistantStream: async ({ onEvent }) => {
        await onEvent({
          type: 'status',
          phase: 'started'
        });
        throw new AskAssistantError({
          traceId: 'trace-stream-1',
          details: {
            stage: 'answering',
            cause: 'Synthetic failure'
          }
        });
      }
    }
  );

  const events = [];
  const frames = [];
  const response = createMockResponse(events, frames);

  await controller.askAssistantStream(
    'default-assistant',
    {
      question: 'Trigger stream failure.'
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.ended, true);
  assert.equal(
    response.headers['Content-Type'],
    'text/event-stream; charset=utf-8'
  );
  assert.equal(response.headers['X-Accel-Buffering'], 'no');
  assert.equal(events.length >= 2, true);
  assert.deepEqual(
    frames.map((frame) => frame.id),
    [1, 2]
  );
  assert.deepEqual(
    frames.map((frame) => frame.event),
    ['status', 'error']
  );
  assert.deepEqual(events[0], {
    type: 'status',
    phase: 'started'
  });
  assert.deepEqual(events.at(-1), {
    type: 'error',
    message: 'Ask pipeline failed.',
    code: 'ASK_PIPELINE_FAILED',
    traceId: 'trace-stream-1',
    details: {
      stage: 'answering',
      cause: 'Synthetic failure'
    },
    retryable: true
  });
});

test('askAssistantStream preserves HTTP error semantics before the stream starts', async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistantStream: async () => {
        throw new AskAssistantError({
          traceId: 'trace-stream-early',
          details: {
            stage: 'retrieval',
            cause: 'Early synthetic failure'
          }
        });
      }
    }
  );

  const events = [];
  const response = createMockResponse(events);

  await controller.askAssistantStream(
    'default-assistant',
    {
      question: 'Trigger early stream failure.'
    },
    response
  );

  assert.equal(response.statusCode, 502);
  assert.equal(response.ended, true);
  assert.deepEqual(events, []);
  assert.deepEqual(response.jsonBody, {
    statusCode: 502,
    error: 'Bad Gateway',
    message: 'Ask pipeline failed.',
    code: 'ASK_PIPELINE_FAILED',
    traceId: 'trace-stream-early',
    details: {
      stage: 'retrieval',
      cause: 'Early synthetic failure'
    },
    path: '/assistants/default-assistant/ask/stream',
    timestamp: response.jsonBody.timestamp
  });
});

test('askAssistantStream preserves HttpException status before the stream starts', async () => {
  const controller = new AssistantsController(
    {},
    {
      askAssistantStream: async () => {
        throw new NotFoundException('Assistant missing.');
      }
    }
  );

  const events = [];
  const response = createMockResponse(events);

  await controller.askAssistantStream(
    'missing-assistant',
    {
      question: 'Trigger missing assistant.'
    },
    response
  );

  assert.equal(response.statusCode, 404);
  assert.equal(response.ended, true);
  assert.deepEqual(events, []);
  assert.deepEqual(response.jsonBody, {
    statusCode: 404,
    error: 'Not Found',
    message: 'Assistant missing.',
    path: '/assistants/missing-assistant/ask/stream',
    timestamp: response.jsonBody.timestamp
  });
});

function createMockResponse(events, frames = []) {
  return {
    statusCode: null,
    ended: false,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    write(chunk) {
      for (const frame of String(chunk).split('\n\n')) {
        const lines = frame.split('\n');
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice('data:'.length).replace(/^ /, ''))
          .join('\n')
          .trim();

        if (!data) {
          continue;
        }

        const parsed = JSON.parse(data);
        const idLine = lines.find((line) => line.startsWith('id:'));
        const eventLine = lines.find((line) => line.startsWith('event:'));

        frames.push({
          id: idLine == null ? null : Number(idLine.slice('id:'.length).trim()),
          event:
            eventLine == null ? null : eventLine.slice('event:'.length).trim(),
          data: parsed
        });
        events.push(parsed);
      }

      return true;
    },
    json(payload) {
      this.jsonBody = payload;
      this.ended = true;
      return payload;
    },
    end() {
      this.ended = true;
    }
  };
}
