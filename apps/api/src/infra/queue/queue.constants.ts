import { resolveQueueRuntimeConfig } from "./queue-runtime-config";

const DEFAULT_DOCUMENT_INGESTION_QUEUE = "document-ingestion";

export function getDocumentIngestionQueueName() {
  const prefix = resolveQueueRuntimeConfig().queuePrefix;

  if (!prefix) {
    return DEFAULT_DOCUMENT_INGESTION_QUEUE;
  }

  return `${prefix}-${DEFAULT_DOCUMENT_INGESTION_QUEUE}`;
}
