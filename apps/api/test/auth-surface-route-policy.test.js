import assert from 'node:assert/strict';
import { test } from 'vitest';
import 'reflect-metadata';

import { AUTH_ROUTE_POLICY_KEY } from '../src/modules/auth/auth-route-policy.ts';
import { AssistantsController } from '../src/modules/assistants/assistants.controller.ts';
import { AuditController } from '../src/modules/audit/audit.controller.ts';
import { ConversationsController } from '../src/modules/conversations/conversations.controller.ts';
import { DocumentsController } from '../src/modules/documents/documents.controller.ts';
import { KnowledgeBasesController } from '../src/modules/knowledge-bases/knowledge-bases.controller.ts';
import { RetrievalProfilesController } from '../src/modules/retrieval-profiles/retrieval-profiles.controller.ts';
import { TracesController } from '../src/modules/traces/traces.controller.ts';

test('business controllers require authenticated routes', () => {
  const protectedControllers = [
    KnowledgeBasesController,
    DocumentsController,
    AssistantsController,
    AuditController,
    ConversationsController,
    TracesController,
    RetrievalProfilesController
  ];

  for (const controller of protectedControllers) {
    assert.equal(
      Reflect.getMetadata(AUTH_ROUTE_POLICY_KEY, controller),
      'authenticated'
    );
  }
});
