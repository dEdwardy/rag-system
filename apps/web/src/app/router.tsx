import { createBrowserRouter } from "react-router-dom";
import { AuthenticatedAppShell } from "./AuthenticatedAppShell";

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => {
      const { LoginPage } = await import("../pages/auth/LoginPage");

      return { Component: LoginPage };
    }
  },
  {
    path: "/",
    element: <AuthenticatedAppShell />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { ChatPage } = await import("../pages/chat/ChatPage");

          return { Component: ChatPage };
        }
      },
      {
        path: "documents",
        lazy: async () => {
          const { DocumentsPage } = await import("../pages/documents/DocumentsPage");

          return { Component: DocumentsPage };
        }
      },
      {
        path: "documents/:documentId",
        lazy: async () => {
          const { DocumentDetailPage } = await import("../pages/documents/DocumentDetailPage");

          return { Component: DocumentDetailPage };
        }
      },
      {
        path: "knowledge-base",
        lazy: async () => {
          const { KnowledgeBasePage } = await import("../pages/knowledge-base/KnowledgeBasePage");

          return { Component: KnowledgeBasePage };
        }
      },
      {
        path: "usage",
        lazy: async () => {
          const { UsagePage } = await import("../pages/usage/UsagePage");

          return { Component: UsagePage };
        }
      },
      {
        path: "reports",
        lazy: async () => {
          const { ReportCenterPage } = await import("../pages/reports/ReportCenterPage");

          return { Component: ReportCenterPage };
        }
      },
      {
        path: "assistant",
        lazy: async () => {
          const { AssistantPage } = await import("../pages/assistant/AssistantPage");

          return { Component: AssistantPage };
        }
      },
      {
        path: "traces",
        lazy: async () => {
          const { TraceListPage } = await import("../pages/traces/TraceListPage");

          return { Component: TraceListPage };
        }
      },
      {
        path: "traces/:traceId",
        lazy: async () => {
          const { TraceDetailPage } = await import("../pages/traces/TraceDetailPage");

          return { Component: TraceDetailPage };
        }
      }
    ]
  }
]);
