import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useUser() {
  return useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path);
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
    retry: false,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, { method: "POST" });
      if (!res.ok) throw new Error("Failed to logout");
    },
    onSuccess: () => {
      queryClient.setQueryData([api.auth.me.path], null);
      toast({
        title: "Logged out",
        description: "See you next time, legend!",
      });
    },
  });
}

// Mock login for demo purposes (actual implementation uses backend OAuth redirect)
export function useLogin() {
  const { toast } = useToast();
  
  const login = () => {
    // In a real app, this redirects to Discord OAuth
    // window.location.href = "/api/auth/discord";
    
    // For demo visual feedback:
    toast({
      title: "Redirecting to Discord...",
      description: "Please check the backend console for the auth link if running locally.",
    });
    
    // Simulate redirect delay
    setTimeout(() => {
        window.location.href = "/login"; // Or wherever the backend auth starts
    }, 1000);
  };

  return { login };
}
