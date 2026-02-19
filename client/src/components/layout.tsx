import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useIdentity, buildAvatarUrl } from "@/hooks/use-identity";
import { IdentityModal } from "@/components/identity-modal";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Gamepad2, LogOut, Plus, MonitorPlay, Menu, Lock, Pencil, Palette } from "lucide-react";
import { useState } from "react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useUser();
  const logout  = useLogout();
  const { identity } = useIdentity();
  const [location] = useLocation();
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const isAdmin   = user?.role === "admin";
  const isVisitor = !user;

  // أفاتار الزائر: استخدم الصورة المخصصة (base64) إذا وُجدت، وإلا حاول توليدها
  const visitorAvatar = identity?.customAvatar ?? (
    identity ? buildAvatarUrl(identity.avatarStyle, identity.avatarSeed) : null
  );

  const NavLink = ({ href, icon: Icon, children, onClick }: {
    href: string; icon: any; children: React.ReactNode; onClick?: () => void;
  }) => {
    const isActive = location === href;
    return (
      <Link href={href} onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 font-medium
          ${isActive
            ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(168,85,247,0.15)]"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
      >
        <Icon className="w-5 h-5" />{children}
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
            <NavLink href="/" icon={Gamepad2}>الكليبات</NavLink>
            <NavLink href="/dream-artists" icon={Palette}>رسامين دريم</NavLink>
            {isAdmin && <NavLink href="/studio" icon={MonitorPlay}>الاستوديو</NavLink>}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              /* ── مسجّل (أدمن) ── */
              <>
                <Link href="/submit">
                  <Button className="neon-button bg-primary hover:bg-primary/90 text-white border-none">
                    <Plus className="w-4 h-4 ml-2" /> إرسال مقطع
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    <Avatar className="w-9 h-9 border-2 border-primary/20 hover:border-primary transition-colors cursor-pointer">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-muted text-xs">
                        {user.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-card border-border/50">
                    <div className="px-2 py-1.5 text-sm font-semibold">
                      {user.username}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {isAdmin ? "مشرف" : "مستخدم"}
                      </span>
                    </div>
                    <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => logout.mutate()}>
                      <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              /* ── زائر ── */
              <>
                <Link href="/submit">
                  <Button className="neon-button bg-primary hover:bg-primary/90 text-white border-none">
                    <Plus className="w-4 h-4 ml-2" /> إرسال مقطع
                  </Button>
                </Link>

                {/* بطاقة هوية الزائر */}
                <button
                  onClick={() => setIdentityOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/60 hover:border-primary/60 hover:bg-primary/5 transition-all group"
                  title="هويتي"
                >
                  {visitorAvatar ? (
                    <img src={visitorAvatar} className="w-7 h-7 rounded-full border border-primary/30" alt="avatar" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-muted-foreground">؟</span>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground group-hover:text-foreground max-w-[100px] truncate">
                    {identity?.name ?? "هويتي"}
                  </span>
                  <Pencil className="w-3 h-3 text-muted-foreground/60" />
                </button>

                <Link href="/admin-login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary gap-1">
                    <Lock className="w-3.5 h-3.5" /> إدارة
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon"><Menu className="w-6 h-6" /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-card border-l border-border/50">
              <div className="flex flex-col gap-4 mt-8">
                <NavLink href="/" icon={Gamepad2} onClick={() => setMobileOpen(false)}>الكليبات</NavLink>
                <NavLink href="/dream-artists" icon={Palette} onClick={() => setMobileOpen(false)}>رسامين دريم 🎨</NavLink>
                {isAdmin && (
                  <NavLink href="/studio" icon={MonitorPlay} onClick={() => setMobileOpen(false)}>الاستوديو</NavLink>
                )}
                <div className="h-px bg-border/50" />

                {/* هوية الزائر في الموبايل */}
                {isVisitor && (
                  <button
                    onClick={() => { setIdentityOpen(true); setMobileOpen(false); }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-right"
                  >
                    {visitorAvatar ? (
                      <img src={visitorAvatar} className="w-10 h-10 rounded-full border-2 border-primary/30 flex-shrink-0" alt="avatar" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <span className="text-muted-foreground text-lg">؟</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {identity?.name ?? "أنت زائر"}
                      </p>
                      <p className="text-xs text-primary flex items-center gap-1">
                        <Pencil className="w-3 h-3" />
                        {identity ? "تعديل هويتك" : "إنشاء هويتك الآن"}
                      </p>
                    </div>
                  </button>
                )}

                <Link href="/submit" onClick={() => setMobileOpen(false)}>
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold">
                    <Plus className="w-4 h-4 ml-2" /> إرسال مقطع
                  </Button>
                </Link>

                {user ? (
                  <Button variant="destructive" className="w-full"
                    onClick={() => { logout.mutate(); setMobileOpen(false); }}>
                    <LogOut className="w-4 h-4 ml-2" /> تسجيل الخروج
                  </Button>
                ) : (
                  <Link href="/admin-login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" className="w-full gap-2 text-muted-foreground border-border/50">
                      <Lock className="w-4 h-4" /> دخول الإدارة
                    </Button>
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-border/40 py-8 mt-auto bg-black/20">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 StreamerClipHub. تم بناؤه للاعبين والمحتوى الإبداعي.</p>
        </div>
      </footer>

      {/* مودال الهوية */}
      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
    </div>
  );
}
