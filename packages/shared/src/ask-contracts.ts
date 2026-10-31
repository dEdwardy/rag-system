export type AgentStepStatus = 'running' | 'completed' | 'skipped';

export type AgentStep = {
  name: string;
  toolName: string | null;
  status: AgentStepStatus;
  summary: string;
  diagnostics?: unknown;
};

export type MessageFeedbackRating = 'up' | 'down';

export type MessageFeedbackInput = {
  rating: MessageFeedbackRating;
  reason?: string;
  comment?: string;
};
