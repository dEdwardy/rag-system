# RAG Validation Doc

## Product Facts

The system stores uploaded source files on local disk.
The first vector store implementation is file-backed under storage/vectors.
Document ingestion uses Redis-backed background jobs.
The default knowledge base id is default-kb.

## Retrieval Fact

When Ollama is available, embeddings should be generated through the Ollama API.
