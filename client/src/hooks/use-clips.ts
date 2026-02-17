import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

type ClipStatus = 'pending' | 'approved' | 'rejected' | 'watched';

export function useClips(filters?: { status?: ClipStatus; sort?: 'new' | 'top' }) {
  return useQuery({
    queryKey: [api.clips.list.path, filters],
    queryFn: async () => {
      const url = filters 
        ? `${api.clips.list.path}?${new URLSearchParams(filters as any).toString()}`
        : api.clips.list.path;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch clips");
      return await res.json();
    },
  });
}

export function useCreateClip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { url: string; title: string; thumbnailUrl: string; channelName: string; duration: string; tag: string }) => {
      const res = await fetch(api.clips.create.path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        let errMsg = "Failed to submit clip";
        try {
          const error = await res.json();
          errMsg = error?.message || JSON.stringify(error) || errMsg;
        } catch (e) {
          try {
            const text = await res.text();
            if (text) errMsg = text;
          } catch {
            /* ignore */
          }
        }
        throw new Error(errMsg);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clips.list.path] });
      toast({
        title: "Clip Submitted!",
        description: "Your clip is now pending review.",
        className: "border-primary text-primary-foreground bg-primary",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateClipStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: ClipStatus }) => {
      const url = buildUrl(api.clips.updateStatus.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.clips.list.path] });
      toast({
        title: "Status Updated",
        description: `Clip marked as ${variables.status}`,
      });
    },
  });
}

export function useVoteClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, value }: { id: number; value: number }) => {
      const url = buildUrl(api.clips.vote.path, { id });
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) throw new Error("Failed to vote");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clips.list.path] });
    },
  });
}

export function useClipMetadata() {
  return useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(api.clips.fetchMetadata.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        let errMsg = "Invalid Clip URL";
        try {
          const error = await res.json();
          errMsg = error?.message || JSON.stringify(error) || errMsg;
        } catch (e) {
          try {
            const text = await res.text();
            if (text) errMsg = text;
          } catch {
            /* ignore */
          }
        }
        throw new Error(errMsg);
      }
      return await res.json();
    },
  });
}

export function useDeleteClip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/clips/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete clip");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clips.list.path] });
      toast({
        title: "تم الحذف",
        description: "تم حذف المقطع بنجاح.",
        variant: "destructive",
      });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف المقطع.", variant: "destructive" });
    },
  });
}
