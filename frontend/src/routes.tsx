import { createBrowserRouter } from "react-router-dom";
import AppLayout from "@/components/common/AppLayout";
import AppStudioLayout from "@/layouts/AppStudioLayout";
import ReadOnlyDesignerLayout from "@/features/designer/layouts/ReadOnlyDesignerLayout";

import HomePage from "@/features/dashboard/HomePage";
import NewApplicationPage from "@/features/applications/pages/NewApplicationPage";
import ApplicationFormPage from "@/features/applications/pages/ApplicationFormPage";
import ApplicationListPage from "@/features/applications/pages/ApplicationListPage";
import ApplicationDetailPage from "@/features/applications/pages/ApplicationDetailPage";
import TaskListPage from "@/features/tasks/pages/TaskListPage";
import TaskDetailPage from "@/features/tasks/pages/TaskDetailPage";

// Designer (App Studio) - Outside Layout (list, new)
import DesignerAppsPage from "@/features/designer/pages/DesignerAppsPage";
import DesignerNewAppPage from "@/features/designer/pages/DesignerNewAppPage";
// Designer (App Studio) - Inside AppStudioLayout
import DesignerOverviewPage from "@/features/designer/pages/DesignerOverviewPage";
import DesignerVersionsPage from "@/features/designer/pages/DesignerVersionsPage";
import DesignerSearchPage from "@/features/designer/pages/DesignerSearchPage";
import FormEditorPage from "@/features/designer/pages/FormEditorPage";
import FlowEditorPage from "@/features/designer/pages/FlowEditorPage";
import VersionPreviewPage from "@/features/designer/pages/VersionPreviewPage";

// Admin
import AdminDashboardPage from "@/features/admin/AdminDashboardPage";
import AdminWorkflowsPage from "@/features/admin/AdminWorkflowsPage";
import AdminTasksPage from "@/features/admin/AdminTasksPage";
import AdminUsersPage from "@/features/admin/AdminUsersPage";
import AdminTeamsPage from "@/features/admin/AdminTeamsPage";
import AdminStatsListPage from "@/features/admin/stats/AdminStatsListPage";
import AdminStatsDetailPage from "@/features/admin/stats/AdminStatsDetailPage";

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
            // Designer List & New (AppLayout)
            { path: "/designer/apps", element: <DesignerAppsPage /> },
            { path: "/designer/apps/new", element: <DesignerNewAppPage /> },
            // Admin
            { path: "/admin", element: <AdminDashboardPage /> },
            { path: "/admin/workflows", element: <AdminWorkflowsPage /> },
            { path: "/admin/workflows/:id", element: <div className="text-center py-8">Workflow Detail - Coming Soon</div> },
            { path: "/admin/tasks", element: <AdminTasksPage /> },
            { path: "/admin/users", element: <AdminUsersPage /> },
            { path: "/admin/teams", element: <AdminTeamsPage /> },
            { path: "/admin/stats", element: <AdminStatsListPage /> },
            { path: "/admin/stats/:id", element: <AdminStatsDetailPage /> },
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
