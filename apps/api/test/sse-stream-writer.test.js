import { test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

import {
  SseSlowClientError,
  SseStreamWriter
} from '../src/common/sse-stream-writer.ts';

class MockResponse extends EventEmitter {
  constructor(options = {}) {
    super();
    this.statusCode = null;
    this.headers = {};
    this.chunks = [];
    this.ended = false;
    this.endCalls = 0;
    this.writeResults = [...(options.writeResults ?? [])];
  }

  status(code) {
    this.statusCode = code;
    return this;
  }

  setHeader(name, value) {
    this.headers[name] = value;
  }

  write(chunk) {
    this.chunks.push(String(chunk));
    return this.writeResults.length > 0 ? this.writeResults.shift() : true;
  }

  end() {
    this.ended = true;
    this.endCalls += 1;
  }
}

test('SseStreamWriter lazily sends headers and writes id/event/data frames', async () => {
  const response = new MockResponse();
  const writer = new SseStreamWriter(response, { heartbeatIntervalMs: 0 });

  assert.deepEqual(response.headers, {});

  await writer.writeEvent({ type: 'status', phase: 'started' });

  assert.equal(response.statusCode, 200);
  assert.equal(
    response.headers['Content-Type'],
    'text/event-stream; charset=utf-8'
  );
  assert.equal(response.headers['Cache-Control'], 'no-cache, no-transform');
  assert.equal(response.headers['X-Accel-Buffering'], 'no');
  assert.equal(
    response.chunks[0],
    'id: 1\nevent: status\ndata: {"type":"status","phase":"started"}\n\n'
  );

  await writer.writeEvent({ type: 'final', data: { ok: true } });
  assert.equal(
    response.chunks[1],
    'id: 2\nevent: final\ndata: {"type":"final","data":{"ok":true}}\n\n'
  );
  assert.equal(writer.streamStats.framesWritten, 2);

  await writer.close();
  assert.equal(response.ended, true);
  assert.equal(writer.streamStats.closeReason, 'completed');
});

test('SseStreamWriter emits heartbeat comments after the stream starts', async () => {
  vi.useFakeTimers();

  try {
    const response = new MockResponse();
    const writer = new SseStreamWriter(response, { heartbeatIntervalMs: 100 });

    await writer.writeEvent({ type: 'status', phase: 'started' });
    await vi.advanceTimersByTimeAsync(100);

    assert.equal(
      response.chunks.some((chunk) => chunk === ': ping\n\n'),
      true
    );
    assert.equal(writer.streamStats.pingCount >= 1, true);

    await writer.close();
  } finally {
    vi.useRealTimers();
  }
});

test('SseStreamWriter flushes the first delta immediately and coalesces the rest', async () => {
  const response = new MockResponse();
  const writer = new SseStreamWriter(response, {
    heartbeatIntervalMs: 0,
    deltaFlushIntervalMs: 60_000
  });

  await writer.writeEvent({ type: 'answer_delta', delta: 'A' });
  assert.equal(response.chunks.length, 1);
  assert.match(response.chunks[0], /"delta":"A"/);

  await writer.writeEvent({ type: 'answer_delta', delta: 'B' });
  await writer.writeEvent({ type: 'answer_delta', delta: 'C' });
  assert.equal(response.chunks.length, 1);

  await writer.writeEvent({ type: 'status', phase: 'generating' });
  assert.equal(response.chunks.length, 3);
  assert.match(response.chunks[1], /"delta":"BC"/);
  assert.match(response.chunks[2], /event: status/);

  await writer.close();
});

test('SseStreamWriter waits for drain when the client backpressures', async () => {
  const response = new MockResponse({ writeResults: [false] });
  const writer = new SseStreamWriter(response, {
    heartbeatIntervalMs: 0,
    writeTimeoutMs: 1_000
  });

  const pending = writer.writeEvent({ type: 'status', phase: 'started' });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(response.listenerCount('drain'), 1);
  assert.equal(writer.streamStats.backpressureWaits, 1);

  response.emit('drain');
  await pending;
  assert.equal(response.chunks.length, 1);

  await writer.close();
});

test('SseStreamWriter fails fast when a slow client never drains', async () => {
  vi.useFakeTimers();

  try {
    const response = new MockResponse({ writeResults: [false] });
    const writer = new SseStreamWriter(response, {
      heartbeatIntervalMs: 0,
      writeTimeoutMs: 50
    });

    const pending = writer
      .writeEvent({ type: 'status', phase: 'started' })
      .catch((error) => error);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(50);

    const result = await pending;
    assert.equal(result instanceof SseSlowClientError, true);

    await writer.close();
  } finally {
    vi.useRealTimers();
  }
});

test('SseStreamWriter close is idempotent and ignores writes afterwards', async () => {
  const response = new MockResponse();
  const writer = new SseStreamWriter(response, { heartbeatIntervalMs: 0 });

  await writer.writeEvent({ type: 'status', phase: 'started' });
  await Promise.all([writer.close(), writer.close()]);

  assert.equal(response.endCalls, 1);

  await writer.writeEvent({ type: 'status', phase: 'generating' });
  assert.equal(response.chunks.length, 1);
  assert.equal(writer.isFinished, true);
});

test('SseStreamWriter replays buffered frames after Last-Event-ID', async () => {
  const response = new MockResponse();
  const writer = new SseStreamWriter(response, {
    heartbeatIntervalMs: 0,
    streamId: 'stream-replay-1'
  });

  await writer.writeEvent({ type: 'status', phase: 'started' });
  await writer.writeEvent({ type: 'answer_delta', delta: 'hello' });
  await writer.writeEvent({ type: 'final', data: { ok: true } });
  await writer.close();

  const resumedResponse = new MockResponse();
  const resumedWriter = new SseStreamWriter(resumedResponse, {
    heartbeatIntervalMs: 0,
    streamId: 'stream-replay-1',
    resumeFromEventId: 1,
    follow: true
  });

  await resumedWriter.waitForReplayToFinish();

  assert.equal(resumedResponse.chunks.length, 2);
  assert.match(resumedResponse.chunks[0], /"delta":"hello"/);
  assert.match(resumedResponse.chunks[1], /event: final/);
  assert.equal(resumedResponse.ended, true);
});
