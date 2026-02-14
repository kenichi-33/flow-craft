import { createBrowserRouter } from "react-router-dom";
import { lazy } from "react";
import AppLayout from "@/components/common/AppLayout";
import { Loadable } from "@/utils/lazyLoad";

// Lazy Imports
const AppStudioLayout = Loadable(lazy(() => import("@/layouts/AppStudioLayout")));
const ReadOnlyDesignerLayout = Loadable(lazy(() => import("@/features/designer/layouts/ReadOnlyDesignerLayout")));

const HomePage = Loadable(lazy(() => import("@/features/dashboard/HomePage")));
const NewApplicationPage = Loadable(lazy(() => import("@/features/applications/pages/NewApplicationPage")));
const ApplicationFormPage = Loadable(lazy(() => import("@/features/applications/pages/ApplicationFormPage")));
const ApplicationListPage = Loadable(lazy(() => import("@/features/applications/pages/ApplicationListPage")));
const ApplicationDetailPage = Loadable(lazy(() => import("@/features/applications/pages/ApplicationDetailPage")));
const TaskListPage = Loadable(lazy(() => import("@/features/tasks/pages/TaskListPage")));
const TaskDetailPage = Loadable(lazy(() => import("@/features/tasks/pages/TaskDetailPage")));
const ChatPage = Loadable(lazy(() => import("@/pages/ChatPage")));

// Designer (App Studio) - Outside Layout (list, new)
const DesignerAppsPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerAppsPage")));
const DesignerNewAppPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerNewAppPage")));

// Designer (App Studio) - Inside AppStudioLayout
const DesignerOverviewPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerOverviewPage")));
const DesignerVersionsPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerVersionsPage")));
const DesignerSearchPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerSearchPage")));
const DesignerRagPage = Loadable(lazy(() => import("@/features/designer/pages/DesignerRagPage")));
const FormEditorPage = Loadable(lazy(() => import("@/features/designer/pages/FormEditorPage")));
const FlowEditorPage = Loadable(lazy(() => import("@/features/designer/pages/FlowEditorPage")));
const VersionPreviewPage = Loadable(lazy(() => import("@/features/designer/pages/VersionPreviewPage")));

// Admin
const AdminDashboardPage = Loadable(lazy(() => import("@/features/admin/AdminDashboardPage")));
const AdminWorkflowsPage = Loadable(lazy(() => import("@/features/admin/AdminWorkflowsPage")));
const AdminTasksPage = Loadable(lazy(() => import("@/features/admin/AdminTasksPage")));
const AdminServiceTaskRecoveryPage = Loadable(lazy(() => import("@/features/admin/AdminServiceTaskRecoveryPage")));
const AdminUsersPage = Loadable(lazy(() => import("@/features/admin/AdminUsersPage")));
const AdminTeamsPage = Loadable(lazy(() => import("@/features/admin/AdminTeamsPage")));
const AdminStatsListPage = Loadable(lazy(() => import("@/features/admin/stats/AdminStatsListPage")));
const AdminStatsDetailPage = Loadable(lazy(() => import("@/features/admin/stats/AdminStatsDetailPage")));
const MasterConnectorsListPage = Loadable(lazy(() => import("@/features/admin/connectors/MasterConnectorsListPage")));
const MasterConnectorEditorPage = Loadable(lazy(() => import("@/features/admin/connectors/MasterConnectorEditorPage")));

export const router = createBrowserRouter([
    {
        path: "/",
        element: <AppLayout />,
        children: [
            { path: "/", element: <HomePage /> },
            { path: "/login", element: <div>Login Page</div> },
            // Applications
            { path: "/applications", element: <ApplicationListPage /> },
            { path: "/applications/new", element: <NewApplicationPage /> },
            { path: "/applications/new/:id", element: <ApplicationFormPage /> },
            { path: "/applications/:id/edit", element: <ApplicationFormPage /> },
            { path: "/applications/:id", element: <ApplicationDetailPage /> },
            // Tasks
            { path: "/tasks", element: <TaskListPage /> },
            { path: "/tasks/:id", element: <TaskDetailPage /> },
            // Chat
            { path: "/chat/:flowId", element: <ChatPage /> },
            { path: "/chat/:flowId/:sessionId", element: <ChatPage /> },
            // Designer List & New (AppLayout)
            { path: "/designer/apps", element: <DesignerAppsPage /> },
            { path: "/designer/apps/new", element: <DesignerNewAppPage /> },
            // Admin
            { path: "/admin", element: <AdminDashboardPage /> },
            { path: "/admin/workflows", element: <AdminWorkflowsPage /> },
            { path: "/admin/workflows/:id", element: <div className="text-center py-8">Workflow Detail - Coming Soon</div> },
            { path: "/admin/tasks", element: <AdminTasksPage /> },
            { path: "/admin/tasks/recovery", element: <AdminServiceTaskRecoveryPage /> },
            { path: "/admin/users", element: <AdminUsersPage /> },
            { path: "/admin/teams", element: <AdminTeamsPage /> },
            { path: "/admin/stats", element: <AdminStatsListPage /> },
            { path: "/admin/stats/:id", element: <AdminStatsDetailPage /> },
            { path: "/admin/connectors", element: <MasterConnectorsListPage /> },
            { path: "/admin/connectors/new", element: <MasterConnectorEditorPage /> },
            { path: "/admin/connectors/:id", element: <MasterConnectorEditorPage /> },
        ]
    },
    // App Studio (Separate Layout)
    {
        path: "/designer/apps/:id",
        element: <AppStudioLayout />,
        children: [
            { index: true, element: <DesignerOverviewPage /> },
            { path: "form", element: <FormEditorPage /> },
            { path: "flow", element: <FlowEditorPage /> },
            { path: "versions", element: <DesignerVersionsPage /> },
            { path: "search", element: <DesignerSearchPage /> },
            { path: "rag", element: <DesignerRagPage /> },
        ]
    },
    // App Studio (Read Only)
    {
        path: "/designer/apps/:id",
        element: <ReadOnlyDesignerLayout />,
        children: [
            { path: "versions/:versionId", element: <VersionPreviewPage /> },
            { path: "versions/:versionId/flow", element: <FlowEditorPage /> },
            { path: "versions/:versionId/form", element: <FormEditorPage /> },
        ]
    }
]);
