import { Link, useLocation } from "wouter";
import { useUser, useLogout } from "@/hooks/use-auth";
import { useIdentity, buildAvatarUrl } from "@/hooks/use-identity";
import { IdentityModal } from "@/components/identity-modal";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Gamepad2, LogOut, Plus, MonitorPlay, Menu, Lock, Pencil, Palette, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useUser();
  const logout = useLogout();
  const { identity } = useIdentity();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isVisitor = !user;

  const visitorAvatar = identity?.customAvatar ?? (
    identity ? buildAvatarUrl(identity.avatarStyle, identity.avatarSeed) : null
  );

  const navLinks = [
    { href: "/", icon: Gamepad2, label: "الكليبات", emoji: "🎮" },
    { href: "/dream-artists", icon: Palette, label: "رسامين دريم", emoji: "🎨" },
    ...(isAdmin ? [{ href: "/studio", icon: MonitorPlay, label: "الاستوديو", emoji: "🎬" }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#06060f] flex flex-col font-sans selection:bg-purple-500/20">
      {/* ─── Navbar ─── */}
      <nav className="border-b border-white/6 bg-[#08081a]/80 backdrop-blur-xl sticky top-0 z-50 shadow-[0_1px_0_rgba(255,255,255,0.05)]">
        <div className="container mx-auto px-4 h-[60px] flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500 blur-lg opacity-35 group-hover:opacity-55 transition-opacity rounded-lg" />
              <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Gamepad2 className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            <span className="text-lg font-black tracking-tight text-white group-hover:text-white/90 transition-colors">
              Streamer<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Clip</span>Hub
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, icon: Icon, label }) => {
              const isActive = location === href;
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? "bg-purple-500/15 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.12)]"
                      : "text-white/50 hover:text-white hover:bg-white/5"}`}>
                  <Icon className="w-4 h-4" />{label}
                </Link>
              );
            })}
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            {isLoading ? (
              <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse" />
            ) : user ? (
              <>
                <Link href="/submit">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all">
                    <Plus className="w-4 h-4" /> إرسال
                  </motion.button>
                </Link>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs text-white font-bold">
                    {user.username[0]?.toUpperCase()}
                  </div>
                  <span className="text-white/70 text-sm">{user.username}</span>
                  <button onClick={() => logout.mutate()} className="text-white/30 hover:text-red-400 transition-colors ml-1">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/submit">
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold shadow-[0_0_20px_rgba(168,85,247,0.25)] hover:shadow-[0_0_30px_rgba(168,85,247,0.4)] transition-all">
                    <Plus className="w-4 h-4" /> إرسال مقطع
                  </motion.button>
                </Link>
                <button onClick={() => setIdentityOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all group">
                  {visitorAvatar ? (
                    <img src={visitorAvatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-xs text-white/50">{identity?.name?.[0] || "؟"}</span>
                    </div>
                  )}
                  <span className="text-sm text-white/50 group-hover:text-white/80 max-w-[80px] truncate transition-colors">
                    {identity?.name ?? "هويتي"}
                  </span>
                  <Pencil className="w-3 h-3 text-white/25 group-hover:text-purple-400 transition-colors" />
                </button>
                <Link href="/admin-login">
                  <button className="text-white/30 hover:text-white/60 transition-colors p-2 rounded-lg hover:bg-white/5">
                    <Lock className="w-4 h-4" />
                  </button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(true)} className="md:hidden w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 w-72 z-[61] bg-[#0d0d1a] border-l border-white/8 shadow-2xl md:hidden flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-white/6">
                <span className="font-black text-white">القائمة</span>
                <button onClick={() => setMobileOpen(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navLinks.map(({ href, icon: Icon, label, emoji }) => {
                  const isActive = location === href;
                  return (
                    <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                        ${isActive ? "bg-purple-500/15 text-purple-300" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
                      <span className="text-lg">{emoji}</span>{label}
                    </Link>
                  );
                })}
                <div className="h-px bg-white/6 my-3" />
                {isVisitor && (
                  <button onClick={() => { setIdentityOpen(true); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/8 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-right">
                    {visitorAvatar ? (
                      <img src={visitorAvatar} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" alt="" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center text-white/40 flex-shrink-0 text-lg">
                        {identity?.name?.[0] || "؟"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <p className="font-bold text-sm text-white truncate">{identity?.name ?? "أنت زائر"}</p>
                      <p className="text-xs text-purple-400 flex items-center gap-1 justify-end"><Pencil className="w-3 h-3" /> {identity ? "تعديل هويتك" : "أنشئ هويتك"}</p>
                    </div>
                  </button>
                )}
                <Link href="/submit" onClick={() => setMobileOpen(false)}>
                  <button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm flex items-center justify-center gap-2 mt-2">
                    <Plus className="w-4 h-4" /> إرسال مقطع
                  </button>
                </Link>
                {user ? (
                  <button onClick={() => { logout.mutate(); setMobileOpen(false); }}
                    className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/10 transition-all">
                    <LogOut className="w-4 h-4" /> تسجيل الخروج
                  </button>
                ) : (
                  <Link href="/admin-login" onClick={() => setMobileOpen(false)}>
                    <button className="w-full py-3 rounded-xl border border-white/10 text-white/50 font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/5 transition-all">
                      <Lock className="w-4 h-4" /> دخول الإدارة
                    </button>
                  </Link>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>

      <footer className="border-t border-white/5 py-6 mt-auto bg-black/20">
        <div className="container mx-auto px-4 text-center text-sm text-white/20">
          © 2024 StreamerClipHub · منصة مجتمعية للإبداع
        </div>
      </footer>

      <IdentityModal open={identityOpen} onClose={() => setIdentityOpen(false)} />
    </div>
  );
}
