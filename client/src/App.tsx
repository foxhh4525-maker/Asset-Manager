import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import SubmitPage from "@/pages/submit";
import Dashboard from "@/pages/dashboard";
import Studio from "@/pages/Studio";
import AdminLogin from "@/pages/admin-login";
import DrawPage from "@/pages/DrawPage";
import DreamArtists from "@/pages/DreamArtists";
import { useUser } from "@/hooks/use-auth";
import { IdentityModal } from "@/components/identity-modal";
import { useIdentity } from "@/hooks/use-identity";
import { useEffect, useState } from "react";

// ✅ حماية صفحة الاستديو — يُسمح فقط للأدمن
function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/submit" component={SubmitPage} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/admin-login" component={AdminLogin} />
      <Route path="/dream-artists" component={DreamArtists} />
      <Route path="/draw" component={DrawPage} />
      {/* ✅ /studio محمي — غير الأدمن يُعاد توجيهه للرئيسية */}
      <Route path="/studio">
        <AdminRoute component={Studio} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { identity } = useIdentity();
  const [showIdentity, setShowIdentity] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem("sc_seen_identity_modal_v1");
      if (!identity && !seen) setShowIdentity(true);
    } catch {}
  }, [identity]);

  const handleIdentitySave = () => {
    try { localStorage.setItem("sc_seen_identity_modal_v1", "1"); } catch {}
    setShowIdentity(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <IdentityModal open={showIdentity} onClose={() => setShowIdentity(false)} onSave={handleIdentitySave} />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
