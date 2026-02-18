import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useQueryClient } from "@tanstack/react-query";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: "admin", password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "كلمة المرور غير صحيحة");
        return;
      }
      // تحديث بيانات المستخدم ثم التوجيه
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation(data.redirectTo || "/studio");
    } catch {
      setError("حدث خطأ، حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-2">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">دخول الإدارة</h1>
          <p className="text-muted-foreground text-sm">للمشرفين فقط</p>
        </div>

        <Card className="glass-panel border-border/50">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-12 bg-background/50 border-border pr-10"
                    autoFocus
                    required
                  />
                  <Lock className="absolute right-3 top-3.5 w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              {error && (
                <p className="text-destructive text-sm text-center font-medium">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-primary text-white font-bold"
                disabled={loading || !password}
              >
                {loading ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> جاري الدخول...</>
                ) : (
                  "دخول الاستوديو"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
