export class ConcurrencyLimiter {
  private readonly maxConcurrency: number;
  private activeCount = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const { result } = await this.executeMeasured(fn);
    return result;
  }

  async executeMeasured<T>(fn: () => Promise<T>): Promise<{ result: T; waitMs: number; runMs: number }> {
    return new Promise<{ result: T; waitMs: number; runMs: number }>((resolve, reject) => {
      const queuedAt = Date.now();
      const task = () => {
        const startedAt = Date.now();
        this.activeCount++;
        fn()
          .then(result => resolve({
            result,
            waitMs: startedAt - queuedAt,
            runMs: Date.now() - startedAt
          }))
          .catch(reject)
          .finally(() => {
            this.activeCount--;
            this.next();
          });
      };

      if (this.activeCount < this.maxConcurrency) {
        task();
      } else {
        this.queue.push(task);
      }
    });
  }

  private next() {
    if (this.queue.length > 0 && this.activeCount < this.maxConcurrency) {
      const task = this.queue.shift();
      if (task) {
        task();
      }
    }
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getActiveCount(): number {
    return this.activeCount;
  }
}

export class PromisePool {
  private readonly limiter: ConcurrencyLimiter;

  constructor(maxConcurrency: number = 5) {
    this.limiter = new ConcurrencyLimiter(maxConcurrency);
  }

  async all<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const promises = tasks.map(task => this.limiter.execute(task));
    return Promise.all(promises);
  }

  async allSettled<T>(tasks: Array<() => Promise<T>>): Promise<PromiseSettledResult<T>[]> {
    const promises = tasks.map(task => this.limiter.execute(task));
    return Promise.allSettled(promises);
  }
}

export class ResultCache<K, V> {
  private readonly cache = new Map<K, { value: V; timestamp: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number = 1000, ttlMs: number = 60000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.cache.size >= this.maxSize) {
      this.evictOldEntries();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  async getOrSet(key: K, factory: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value);
    return value;
  }

  private evictOldEntries(): void {
    const entries = Array.from(this.cache.entries());
    const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    const entriesToRemove = sortedEntries.slice(0, Math.floor(this.maxSize * 0.2));

    entriesToRemove.forEach(([key]) => {
      this.cache.delete(key);
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
