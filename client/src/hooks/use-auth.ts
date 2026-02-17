import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
    retry: false,
    // ✅ الإصلاح الحاسم: لا نخزّن بيانات المستخدم إلى الأبد
    // staleTime: Infinity كان في queryClient يجعل الدور القديم يبقى محفوظاً حتى بعد تغييره في DB
    staleTime: 0,
    // ✅ إعادة جلب بيانات المستخدم عند العودة للتبويب — يضمن تحديث الدور فوراً
    refetchOnWindowFocus: true,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to logout");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      // ✅ مسح كل الـ cache بعد الخروج لضمان بيانات نظيفة عند الدخول مجدداً
      queryClient.clear();
      toast({
        title: "Logged out",
        description: "See you next time, legend!",
      });
    },
  });
}

// Discord OAuth login
export function useLogin() {
  const login = () => {
    window.location.href = "/api/auth/discord";
  };

  return { login };
}
