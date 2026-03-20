const DEFAULT_DOCUMENT_INGESTION_QUEUE = "document-ingestion";

export function getDocumentIngestionQueueName() {
  const prefix = process.env.QUEUE_PREFIX?.trim();

  if (!prefix) {
    return DEFAULT_DOCUMENT_INGESTION_QUEUE;
  }

  return `${prefix}-${DEFAULT_DOCUMENT_INGESTION_QUEUE}`;
}
