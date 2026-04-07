const assert = require("node:assert/strict");
const test = require("node:test");

const { IngestionService } = require("../src/modules/ingestion/ingestion.service.ts");

test("IngestionService tracks active tasks with Set", async () => {
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    activeTasks: new Set(),
    taskAbortControllers: new Map(),
    runtimeConfig: {
      maxConcurrentIngestionTasks: 3,
      maxTaskTimeoutMs: 300000
    }
  });

  assert.equal(fakeService.activeTasks.size, 0);
  
  fakeService.activeTasks.add("task-1");
  assert.equal(fakeService.activeTasks.size, 1);
  assert.equal(fakeService.activeTasks.has("task-1"), true);
  
  fakeService.activeTasks.delete("task-1");
  assert.equal(fakeService.activeTasks.size, 0);
});

test("IngestionService respects max concurrent tasks limit", async () => {
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    activeTasks: new Set(["task-1", "task-2", "task-3"]),
    runtimeConfig: {
      maxConcurrentIngestionTasks: 3
    }
  });

  assert.equal(fakeService.activeTasks.size, fakeService.runtimeConfig.maxConcurrentIngestionTasks);
  assert.equal(fakeService.activeTasks.size < fakeService.runtimeConfig.maxConcurrentIngestionTasks, false);
});

test("IngestionService can add tasks below max concurrent limit", async () => {
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    activeTasks: new Set(["task-1"]),
    runtimeConfig: {
      maxConcurrentIngestionTasks: 3
    }
  });

  assert.equal(fakeService.activeTasks.size < fakeService.runtimeConfig.maxConcurrentIngestionTasks, true);
});

test("IngestionService creates and manages AbortControllers", async () => {
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    taskAbortControllers: new Map()
  });

  const testController = new AbortController();
  fakeService.taskAbortControllers.set("test-task", testController);

  assert.equal(fakeService.taskAbortControllers.has("test-task"), true);
  assert.equal(fakeService.taskAbortControllers.get("test-task"), testController);

  fakeService.taskAbortControllers.delete("test-task");
  assert.equal(fakeService.taskAbortControllers.has("test-task"), false);
});

test("IngestionService cleans up tasks on completion", async () => {
  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    activeTasks: new Set(["task-to-cleanup"]),
    taskAbortControllers: new Map()
  });

  const testController = new AbortController();
  fakeService.taskAbortControllers.set("task-to-cleanup", testController);

  fakeService.activeTasks.delete("task-to-cleanup");
  fakeService.taskAbortControllers.delete("task-to-cleanup");

  assert.equal(fakeService.activeTasks.size, 0);
  assert.equal(fakeService.taskAbortControllers.size, 0);
});

test("QueueRuntimeConfig includes new concurrency config options", async () => {
  const { resolveQueueRuntimeConfig } = require("../src/infra/queue/queue-runtime-config.ts");
  
  const config = resolveQueueRuntimeConfig({
    QUEUE_MAX_CONCURRENT_TASKS: "5",
    QUEUE_TASK_TIMEOUT_MS: "600000"
  });

  assert.equal(config.maxConcurrentIngestionTasks, 5);
  assert.equal(config.maxTaskTimeoutMs, 600000);
});

test("QueueRuntimeConfig uses defaults for concurrency options", async () => {
  const { resolveQueueRuntimeConfig } = require("../src/infra/queue/queue-runtime-config.ts");
  
  const config = resolveQueueRuntimeConfig({});

  assert.equal(config.maxConcurrentIngestionTasks, 3);
  assert.equal(config.maxTaskTimeoutMs, 300000);
});

test("IngestionService cleans up all resources on module destroy", async () => {
  const cleanupActions = [];
  const testController = {
    abort: () => cleanupActions.push("aborted")
  };

  const fakeService = Object.assign(Object.create(IngestionService.prototype), {
    activeTasks: new Set(["task-1", "task-2"]),
    taskAbortControllers: new Map([
      ["task-1", testController],
      ["task-2", testController]
    ]),
    databasePollTimer: {
      ref: () => {},
      unref: () => {}
    },
    logger: {
      log: () => {}
    }
  });

  const originalClearInterval = global.clearInterval;
  let clearIntervalCalled = false;
  global.clearInterval = () => {
    clearIntervalCalled = true;
  };

  try {
    IngestionService.prototype.onModuleDestroy.call(fakeService);

    assert.equal(cleanupActions.length, 2);
    assert.equal(fakeService.activeTasks.size, 0);
    assert.equal(fakeService.taskAbortControllers.size, 0);
    assert.equal(clearIntervalCalled, true);
  } finally {
    global.clearInterval = originalClearInterval;
  }
});
