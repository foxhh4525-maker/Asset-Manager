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
    // ✅ الإصلاح الحاسم: staleTime: 0 يجعل React تجلب بيانات المستخدم من السيرفر
    // في كل مرة بدلاً من الاعتماد على الكاش — يضمن تحديث الدور فوراً بعد تغييره في DB
    staleTime: 0,
    // ✅ إعادة الجلب عند العودة للتبويب
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
      // ✅ مسح كل الكاش عند تسجيل الخروج
      queryClient.clear();
      toast({
        title: "تم تسجيل الخروج",
        description: "إلى اللقاء!",
      });
    },
  });
}

export function useLogin() {
  const login = () => {
    window.location.href = "/admin-login";
  };
  return { login };
}
