import { test } from 'vitest';
import assert from 'node:assert/strict';

import {
  resolveAgentStatusLabel,
  resolveAgentStepLabel,
  resolveAgentStepSummary,
  resolveAgentToolLabel
} from '../src/pages/chat/agent-step-copy.ts';

const dictionary = {
  'chat.agentSteps.routeQuestion': '路由判断',
  'chat.agentSteps.routeQuestionRunning': '正在判断问题类型',
  'chat.agentSteps.primaryRetrieval': '主检索',
  'chat.agentSteps.retrievedChunks': '检索到 {count} 个片段',
  'chat.agentSteps.routeSelected': '已选择{route}',
  'chat.agentSteps.noSecondPassNeeded': '无需补充检索',
  'chat.agentSteps.secondPassNeeded': '需要补充检索',
  'chat.agentSteps.secondPassSkipped': '已跳过：无需补充检索',
  'chat.agentSteps.finalizeAnswerCompleted': '回答已生成',
  'chat.agentRoutes.knowledge_base': '知识库问答',
  'chat.agentTools.ragSearch': '知识库检索',
  'chat.agentStatus.running': '执行中',
  'chat.agentStatus.completed': '已完成',
  'chat.agentStatus.skipped': '已跳过'
};

function t(key, values = {}) {
  return (dictionary[key] ?? key).replace(/\{(\w+)\}/g, (_, name) =>
    String(values[name] ?? `{${name}}`)
  );
}

test('agent step copy localizes step, tool, and status labels', () => {
  const step = {
    name: 'run_primary_retrieval',
    toolName: 'rag_search',
    status: 'completed',
    summary: 'retrieved 3 chunks'
  };

  assert.equal(resolveAgentStepLabel(step, t), '主检索');
  assert.equal(resolveAgentToolLabel(step.toolName, t), '知识库检索');
  assert.equal(resolveAgentStatusLabel(step.status, t), '已完成');
});

test('agent step copy localizes running and diagnostic summaries', () => {
  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'route_question',
        toolName: null,
        status: 'running',
        summary: 'classifying question'
      },
      t
    ),
    '正在判断问题类型'
  );

  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'route_question',
        toolName: null,
        status: 'completed',
        summary: 'selected knowledge_base',
        diagnostics: { routeType: 'knowledge_base' }
      },
      t
    ),
    '已选择知识库问答'
  );

  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'run_primary_retrieval',
        toolName: 'rag_search',
        status: 'completed',
        summary: 'retrieved 3 chunks',
        diagnostics: { chunkCount: 3 }
      },
      t
    ),
    '检索到 3 个片段'
  );

  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'judge_missing_information',
        toolName: null,
        status: 'completed',
        summary: 'second pass not needed',
        diagnostics: { secondPassQuery: null }
      },
      t
    ),
    '无需补充检索'
  );

  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'run_second_pass',
        toolName: 'rag_search',
        status: 'skipped',
        summary: 'second pass skipped'
      },
      t
    ),
    '已跳过：无需补充检索'
  );

  assert.equal(
    resolveAgentStepSummary(
      {
        name: 'finalize_answer',
        toolName: 'rag_answer',
        status: 'completed',
        summary: 'answer finalized'
      },
      t
    ),
    '回答已生成'
  );
});
