CREATE INDEX "KnowledgeBase_tenantId_ownerId_createdAt_idx"
ON "KnowledgeBase" ("tenantId", "ownerId", "createdAt" DESC);

CREATE INDEX "Document_kbId_updatedAt_idx"
ON "Document" ("kbId", "updatedAt" DESC);

CREATE INDEX "Assistant_tenantId_createdAt_idx"
ON "Assistant" ("tenantId", "createdAt" DESC);

CREATE INDEX "Conversation_tenantId_userId_updatedAt_idx"
ON "Conversation" ("tenantId", "userId", "updatedAt" DESC);

CREATE INDEX "Message_conversationId_createdAt_idx"
ON "Message" ("conversationId", "createdAt" ASC);

CREATE INDEX "AnswerTrace_conversationId_createdAt_idx"
ON "AnswerTrace" ("conversationId", "createdAt" DESC);
