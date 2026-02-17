import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Gamepad2, 
  LogOut, 
  Plus, 
  User as UserIcon, 
  MonitorPlay,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, refetch } = useUser();
  const logout = useLogout();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Refetch user data when redirected from Discord auth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("auth")) {
      // User was just authenticated, refetch user data
      refetch();
      // Clean up the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refetch]);

  const NavLink = ({ href, icon: Icon, children }: { href: string; icon: any; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href} className={`
        flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium
        ${isActive 
          ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(168,85,247,0.15)]" 
          : "text-muted-foreground hover:text-foreground hover:bg-white/5"}
      `}>
        <Icon className="w-5 h-5" />
        {children}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      {/* Navbar */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <Gamepad2 className="w-8 h-8 text-primary relative z-10" />
            </div>
            <span className="text-xl font-bold font-display tracking-tight group-hover:text-glow transition-all">
              Streamer<span className="text-primary">Clip</span>Hub
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <NavLink href="/" icon={Gamepad2}>الرسوم</NavLink>
            {user?.role === "admin" && (
              <NavLink href="/studio" icon={MonitorPlay}>لوحة التحكم</NavLink>
            )}
          </div>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-4">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4">
                <Link href="/submit">
                  <Button className="neon-button bg-primary hover:bg-primary/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] border-none">
                    <Plus className="w-4 h-4 ml-2" />
                    إرسال مقطع
                  </Button>
                </Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    <Avatar className="w-9 h-9 border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-muted text-xs">{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border/50">
                    <div className="px-2 py-1.5 text-sm font-semibold text-foreground">
                      {user.username}
                      <span className="block text-xs font-normal text-muted-foreground capitalize">{user.role === "admin" ? "مشرف" : user.role === "streamer" ? "منِتِج محتوى" : "مستخدم"}</span>
                    </div>
                    <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer" onClick={() => logout.mutate()}>
                      <LogOut className="w-4 h-4 ml-2" />
                      تسجيل الخروج
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button 
                variant="ghost" 
                className="hover:bg-primary/10 hover:text-primary"
                onClick={() => window.location.href = "/api/auth/discord"}
              >
                تسجيل الدخول عبر ديسكورد
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-l border-border/50">
              <div className="flex flex-col gap-6 mt-8">
                <NavLink href="/" icon={Gamepad2}>الرسوم</NavLink>
                {user?.role === "admin" && (
                  <NavLink href="/studio" icon={MonitorPlay}>لوحة التحكم</NavLink>
                )}
                <div className="h-px bg-border/50" />
                {user ? (
                  <>
                    <Link href="/submit" onClick={() => setIsMobileOpen(false)}>
                      <Button className="w-full bg-primary hover:bg-primary/90">
                        <Plus className="w-4 h-4 ml-2" /> إرسال مقطع
                      </Button>
                    </Link>
                    <Button variant="destructive" className="w-full" onClick={() => logout.mutate()}>
                      <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
                    </Button>
                  </>
                ) : (
                  <Button className="w-full" onClick={() => window.location.href = "/api/auth/discord"}>
                    تسجيل الدخول عبر ديسكورد
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 mt-auto bg-black/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 StreamerClipHub. تم بناؤه للاعبين والمحتوى الإبداعي.</p>
        </div>
      </footer>
    </div>
  );
}
