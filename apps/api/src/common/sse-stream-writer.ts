import type { EventEmitter } from 'node:events';

export type SseWritableResponse = {
  status: (code: number) => unknown;
  setHeader: (name: string, value: string) => unknown;
  write: (chunk: string) => boolean;
  end: () => unknown;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  once?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  off?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void
  ) => unknown;
  writableEnded?: boolean;
  destroyed?: boolean;
};

export type SseStreamCloseReason =
  | 'completed'
  | 'aborted'
  | 'slow_client'
  | 'error';

export type SseStreamWriterOptions = {
  heartbeatIntervalMs?: number;
  deltaFlushIntervalMs?: number;
  maxPendingBytes?: number;
  writeTimeoutMs?: number;
  now?: () => number;
};

export type SseStreamStats = {
  startedAt: number;
  firstEventAt: number | null;
  firstAnswerDeltaAt: number | null;
  lastEventAt: number | null;
  maxEventGapMs: number;
  framesWritten: number;
  pingCount: number;
  bytesWritten: number;
  backpressureWaits: number;
  maxPendingBytes: number;
  closeReason: SseStreamCloseReason | null;
};

export class SseStreamClosedError extends Error {
  constructor(message = 'SSE stream is closed.') {
    super(message);
    this.name = 'SseStreamClosedError';
  }
}

export class SseSlowClientError extends Error {
  constructor(message = 'SSE client is too slow to consume the stream.') {
    super(message);
    this.name = 'SseSlowClientError';
  }
}

const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_DELTA_FLUSH_INTERVAL_MS = 30;
const DEFAULT_MAX_PENDING_BYTES = 4 * 1024;
const DEFAULT_WRITE_TIMEOUT_MS = 10_000;

export class SseStreamWriter {
  private readonly heartbeatIntervalMs: number;
  private readonly deltaFlushIntervalMs: number;
  private readonly maxPendingBytes: number;
  private readonly writeTimeoutMs: number;
  private readonly now: () => number;

  private started = false;
  private finished = false;
  private closePromise: Promise<void> | null = null;
  private nextEventId = 1;
  private pendingDeltas: string[] = [];
  private pendingBytes = 0;
  private hasWrittenAnswerDelta = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly stats: SseStreamStats;

  constructor(
    private readonly response: SseWritableResponse,
    options: SseStreamWriterOptions = {}
  ) {
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.deltaFlushIntervalMs =
      options.deltaFlushIntervalMs ?? DEFAULT_DELTA_FLUSH_INTERVAL_MS;
    this.maxPendingBytes = options.maxPendingBytes ?? DEFAULT_MAX_PENDING_BYTES;
    this.writeTimeoutMs = options.writeTimeoutMs ?? DEFAULT_WRITE_TIMEOUT_MS;
    this.now = options.now ?? Date.now;
    this.stats = {
      startedAt: this.now(),
      firstEventAt: null,
      firstAnswerDeltaAt: null,
      lastEventAt: null,
      maxEventGapMs: 0,
      framesWritten: 0,
      pingCount: 0,
      bytesWritten: 0,
      backpressureWaits: 0,
      maxPendingBytes: 0,
      closeReason: null
    };
  }

  get isStarted() {
    return this.started;
  }

  get isFinished() {
    return this.finished;
  }

  get streamStats(): Readonly<SseStreamStats> {
    return this.stats;
  }

  async writeEvent(
    event: Record<string, unknown>,
    options: { flush?: boolean } = {}
  ) {
    if (this.finished) {
      return;
    }

    if (
      event.type === 'answer_delta' &&
      typeof event.delta === 'string' &&
      options.flush !== true
    ) {
      this.bufferDelta(event.delta);

      if (
        !this.hasWrittenAnswerDelta ||
        this.pendingBytes >= this.maxPendingBytes ||
        this.deltaFlushIntervalMs <= 0
      ) {
        await this.flushPendingDeltas();
      }

      return;
    }

    await this.flushPendingDeltas();
    await this.enqueue(() => this.writeFrame(event));
  }

  async writeComment(text: string) {
    if (this.finished) {
      return;
    }

    this.ensureStarted();
    await this.enqueue(() => this.writeRaw(`: ${text}\n\n`));

    if (text === 'ping') {
      this.stats.pingCount += 1;
    }
  }

  async close(reason: SseStreamCloseReason = 'completed') {
    if (this.closePromise != null) {
      return this.closePromise;
    }

    this.closePromise = this.finalizeClose(reason);
    return this.closePromise;
  }

  private async finalizeClose(reason: SseStreamCloseReason) {
    this.stopHeartbeat();
    this.clearFlushTimer();

    if (this.started && reason !== 'slow_client' && reason !== 'aborted') {
      try {
        await this.flushPendingDeltas();
      } catch {
        // The client is already gone; the close path must stay idempotent.
      }
    }

    if (this.started) {
      try {
        await this.writeQueue;
      } catch {
        // Queued writes can reject after a disconnect; close still proceeds.
      }
    }

    this.finished = true;
    this.stats.closeReason = reason;

    if (
      this.started &&
      this.response.writableEnded !== true &&
      this.response.destroyed !== true
    ) {
      try {
        this.response.end();
      } catch {
        // Ending an already-destroyed response is not actionable here.
      }
    }
  }

  private bufferDelta(delta: string) {
    if (this.stats.firstAnswerDeltaAt == null) {
      this.stats.firstAnswerDeltaAt = this.now();
    }

    this.pendingDeltas.push(delta);
    this.pendingBytes += Buffer.byteLength(delta, 'utf8');
    this.stats.maxPendingBytes = Math.max(
      this.stats.maxPendingBytes,
      this.pendingBytes
    );

    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (
      this.flushTimer != null ||
      this.finished ||
      this.deltaFlushIntervalMs <= 0
    ) {
      return;
    }

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushPendingDeltas().catch(() => undefined);
    }, this.deltaFlushIntervalMs);
    this.flushTimer.unref?.();
  }

  private async flushPendingDeltas() {
    this.clearFlushTimer();

    if (this.pendingDeltas.length === 0) {
      return;
    }

    const delta = this.pendingDeltas.join('');
    this.pendingDeltas = [];
    this.pendingBytes = 0;

    await this.enqueue(() =>
      this.writeFrame({
        type: 'answer_delta',
        delta
      })
    );

    this.hasWrittenAnswerDelta = true;
  }

  private clearFlushTimer() {
    if (this.flushTimer == null) {
      return;
    }

    clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private enqueue(task: () => Promise<void>) {
    const next = this.writeQueue.then(task, task);
    this.writeQueue = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private ensureStarted() {
    if (this.started) {
      return;
    }

    this.started = true;
    this.response.status(200);
    this.response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    this.response.setHeader('Cache-Control', 'no-cache, no-transform');
    this.response.setHeader('Connection', 'keep-alive');
    this.response.setHeader('X-Accel-Buffering', 'no');
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatIntervalMs <= 0 || this.heartbeatTimer != null) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      void this.writeComment('ping').catch(() => undefined);
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref?.();
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer == null) {
      return;
    }

    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private async writeFrame(event: Record<string, unknown>) {
    if (this.finished) {
      return;
    }

    this.ensureStarted();

    const eventId = this.nextEventId;
    this.nextEventId += 1;
    const eventType =
      typeof event.type === 'string' && event.type.length > 0
        ? event.type
        : 'message';

    const frame = `id: ${eventId}\nevent: ${eventType}\ndata: ${JSON.stringify(event)}\n\n`;
    await this.writeRaw(frame);

    this.stats.framesWritten += 1;
    this.stats.firstEventAt ??= this.now();
    if (this.stats.lastEventAt != null) {
      this.stats.maxEventGapMs = Math.max(
        this.stats.maxEventGapMs,
        this.now() - this.stats.lastEventAt
      );
    }
    this.stats.lastEventAt = this.now();
  }

  private async writeRaw(chunk: string) {
    if (
      this.finished ||
      this.response.writableEnded === true ||
      this.response.destroyed === true
    ) {
      throw new SseStreamClosedError();
    }

    const accepted = this.response.write(chunk);
    this.stats.bytesWritten += Buffer.byteLength(chunk, 'utf8');

    if (accepted) {
      return;
    }

    this.stats.backpressureWaits += 1;
    await this.waitForDrain();
  }

  private waitForDrain() {
    return new Promise<void>((resolve, reject) => {
      const response = this.response;
      if (
        typeof response.once !== 'function' ||
        (typeof response.off !== 'function' &&
          typeof response.removeListener !== 'function')
      ) {
        resolve();
        return;
      }

      const emitter = response as unknown as EventEmitter;
      let settled = false;

      const cleanup = () => {
        emitter.removeListener('drain', onDrain);
        emitter.removeListener('close', onClose);
        clearTimeout(timer);
      };

      const settle = (action: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        action();
      };

      const onDrain = () => settle(resolve);
      const onClose = () =>
        settle(() =>
          reject(
            new SseStreamClosedError(
              'SSE stream closed while waiting for backpressure to clear.'
            )
          )
        );

      const timer = setTimeout(() => {
        settle(() => reject(new SseSlowClientError()));
      }, this.writeTimeoutMs);
      timer.unref?.();

      emitter.once('drain', onDrain);
      emitter.once('close', onClose);
    });
  }
}
