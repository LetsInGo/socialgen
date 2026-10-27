import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import BackgroundPage from "@/pages/background";
import GeneratorPage from "@/pages/generator";
import HistoryPage from "@/pages/history";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BackgroundPage} />
      <Route path="/editor" component={GeneratorPage} />
      <Route path="/history" component={HistoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

const style = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "3.5rem",
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur sticky top-0 z-50 h-12">
                  <div className="flex items-center gap-3">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-xs font-bold">I</span>
                      </div>
                      <span className="font-semibold text-sm hidden sm:block">InGo Studio</span>
                    </div>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

