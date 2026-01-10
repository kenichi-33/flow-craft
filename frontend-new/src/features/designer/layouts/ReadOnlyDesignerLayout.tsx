import { Outlet, useParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  FileText, 
  GitGraph,
  ArrowLeft,
  History
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ReadOnlyDesignerLayout() {
  const { id, versionId } = useParams();
  const location = useLocation();


  const menuItems = [
    {
      title: '概観',
      icon: LayoutDashboard,
      href: `/designer/apps/${id}/versions/${versionId}`,
      activeMatch: `/designer/apps/${id}/versions/${versionId}$` // exact match for overview
    },
    {
      title: 'フォーム',
      icon: FileText,
      href: `/designer/apps/${id}/versions/${versionId}/form`,
      activeMatch: '/form'
    },
    {
      title: 'フロー',
      icon: GitGraph,
      href: `/designer/apps/${id}/versions/${versionId}/flow`,
      activeMatch: '/flow'
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b h-14 flex items-center gap-2">
            <div className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                 <History className="h-4 w-4" />
                 読み取り専用モード
            </div>
        </div>

      <div className="flex-1 py-4 overflow-y-auto">
          <nav className="space-y-1 px-2">
            {menuItems.map((item) => {
              const active = item.activeMatch.endsWith('$') 
                ? location.pathname === item.href 
                : location.pathname.includes(item.activeMatch);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
      </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
         <header className="h-14 border-b flex items-center justify-between px-6 bg-background">
             <div className="flex items-center gap-4">
                  {/* Read-only header content if needed */}
             </div>
             <Button variant="ghost" size="sm" asChild>
                 {/* Close logic usually handled by just closing the tab, but a link back doesn't hurt */}
                 <Link to={`/designer/apps/${id}/versions`}>
                     <ArrowLeft className="h-4 w-4 mr-2" />
                     バージョン一覧に戻る
                 </Link>
             </Button>
         </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-muted/10 p-6">
           <Outlet />
        </main>
      </div>
    </div>
  );
}
