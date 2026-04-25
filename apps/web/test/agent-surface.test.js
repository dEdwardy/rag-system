import { describe, expect, it } from 'vitest';
import { buildAgentSurfaceLabels } from '../src/pages/reports/AgentSurfaceEntry';

describe('AgentSurfaceEntry labels', () => {
  it('keeps the English inspection surface focused on existing trace, report, and chat affordances', () => {
    const labels = buildAgentSurfaceLabels('en');

    expect(labels.title).toBe('Agent inspection');
    expect(labels.description).toContain('trace, report, and chat');
    expect(labels.routeExamples).toBe(
      'knowledge base / policy reply / external source'
    );
    expect(labels.toolExamples).toBe(
      'knowledge base search / external source fetch / policy reply'
    );
  });

  it('keeps the Chinese inspection copy valid and agent-facing', () => {
    const labels = buildAgentSurfaceLabels('zh');

    expect(labels.title).toBe('Agent 检视入口');
    expect(labels.description).toContain('查看路由、执行模式和工具名');
    expect(labels.routeExamples).toBe('知识库 / 策略回复 / 外部来源');
    expect(labels.toolExamples).toBe('知识库搜索 / 外部来源抓取 / 策略回复');
  });
});
