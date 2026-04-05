import { createBrowserRouter } from "react-router-dom";

export const router = createBrowserRouter([
  {
    HydrateFallback: AppRouteHydrateFallback,
    path: "/invite",
    lazy: async () => {
      const { InviteGatePage } = await import("../pages/auth/InviteGatePage");

      return { Component: InviteGatePage };
    }
  },
  {
    HydrateFallback: AppRouteHydrateFallback,
    path: "/login",
    lazy: async () => {
      const { LoginPage } = await import("../pages/auth/LoginPage");

      return { Component: LoginPage };
    }
  },
  {
    HydrateFallback: AppRouteHydrateFallback,
    path: "/",
    lazy: async () => {
      const { AuthenticatedAppShell } = await import("./AuthenticatedAppShell");

      return { Component: AuthenticatedAppShell };
    },
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
        path: "workbench",
        lazy: async () => {
          const { WorkbenchPage } = await import("../pages/workbench/WorkbenchPage");

          return { Component: WorkbenchPage };
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

function AppRouteHydrateFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--app-bg)] px-6 text-center">
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--app-border)] border-t-[var(--app-accent)]" />
        <div>
          <p className="text-sm font-medium text-[var(--app-text)]">Loading workspace</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Preparing the application router and shell.</p>
        </div>
      </div>
    </div>
  );
}
