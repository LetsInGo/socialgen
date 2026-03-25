import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Wand2, History, Sparkles, Image } from "lucide-react";

const navItems = [
  {
    title: "Generate",
    url: "/",
    icon: Wand2,
    description: "Create new backgrounds",
  },
  {
    title: "History",
    url: "/history",
    icon: History,
    description: "Your generated images",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Image className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">InGo Studio</p>
            <p className="text-xs text-muted-foreground truncate">Social Image Generator</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Models</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2 space-y-1.5">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">InGo Flash</p>
                  <p className="text-xs text-muted-foreground truncate">Fast generation</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">InGo Pro</p>
                  <p className="text-xs text-muted-foreground truncate">High fidelity</p>
                </div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t">
        <p className="text-xs text-muted-foreground text-center">
          Powered by Gemini Image API
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
