import { createBrowserRouter } from "react-router-dom";
import { ChatPage } from "../pages/chat/ChatPage";
import { DocumentsPage } from "../pages/documents/DocumentsPage";
import { DocumentDetailPage } from "../pages/documents/DocumentDetailPage";
import { KnowledgeBasePage } from "../pages/knowledge-base/KnowledgeBasePage";
import { AssistantPage } from "../pages/assistant/AssistantPage";
import { TraceDetailPage } from "../pages/traces/TraceDetailPage";
import { AppShell } from "./AppShell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <ChatPage />
      },
      {
        path: "documents",
        element: <DocumentsPage />
      },
      {
        path: "documents/:documentId",
        element: <DocumentDetailPage />
      },
      {
        path: "knowledge-base",
        element: <KnowledgeBasePage />
      },
      {
        path: "assistant",
        element: <AssistantPage />
      },
      {
        path: "traces/:traceId",
        element: <TraceDetailPage />
      }
    ]
  }
]);
