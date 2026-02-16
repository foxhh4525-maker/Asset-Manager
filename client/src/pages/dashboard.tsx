import { useState, useRef, useEffect } from "react";
import { useClips, useUpdateClipStatus } from "@/hooks/use-clips";
import { Layout } from "@/components/layout";
import ReactPlayer from "react-player";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Check, X, SkipForward, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Clip } from "@shared/schema";

export default function Dashboard() {
  // Fetch pending clips for review queue
  const { data: clips, isLoading } = useClips({ status: 'pending', sort: 'new' });
  const updateStatus = useUpdateClipStatus();
  
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const currentClip = clips?.[currentClipIndex];

  const handleNext = () => {
    if (clips && currentClipIndex < clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // Loop or stop
      setCurrentClipIndex(0);
    }
  };

  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!currentClip) return;
    
    await updateStatus.mutateAsync({ id: currentClip.id, status });
    // Optimistically move next
    handleNext();
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)]">
        
        {/* Main Player Area - Cinema Mode */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          <div className="relative flex-1 bg-black rounded-xl overflow-hidden shadow-2xl border border-white/5 group">
            {currentClip ? (
              <ReactPlayer
                url={currentClip.url}
                width="100%"
                height="100%"
                playing={isPlaying}
                controls
                onEnded={() => setIsPlaying(false)}
                config={{
                  youtube: {
                    playerVars: { showinfo: 1 }
                  }
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Play className="w-16 h-16 mb-4 opacity-20" />
                <p>No clips in queue</p>
              </div>
            )}
            
            {/* Overlay Controls */}
            {currentClip && (
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">{currentClip.title}</h2>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                        {currentClip.tag}
                      </Badge>
                      <span className="text-sm text-gray-300">
                        Submitted by <span className="text-white font-medium">{currentClip.submitter?.username}</span>
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button 
                      size="lg" 
                      variant="destructive" 
                      onClick={() => handleDecision('rejected')}
                      className="bg-red-500/20 hover:bg-red-500/40 text-red-500 border border-red-500/50"
                    >
                      <X className="w-5 h-5 mr-2" /> Reject
                    </Button>
                    <Button 
                      size="lg" 
                      onClick={() => handleDecision('approved')}
                      className="bg-green-500/20 hover:bg-green-500/40 text-green-500 border border-green-500/50"
                    >
                      <Check className="w-5 h-5 mr-2" /> Approve
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Queue */}
        <div className="lg:col-span-1 bg-card border border-border/50 rounded-xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-background/50 backdrop-blur">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Review Queue
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                {clips?.length || 0}
              </span>
            </h3>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              <AnimatePresence>
                {clips?.map((clip: any, index: number) => (
                  <motion.div
                    key={clip.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => {
                      setCurrentClipIndex(index);
                      setIsPlaying(true);
                    }}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all border border-transparent
                      flex gap-3 items-center group
                      ${index === currentClipIndex 
                        ? "bg-primary/10 border-primary/30 shadow-[inset_0_0_10px_rgba(168,85,247,0.1)]" 
                        : "hover:bg-white/5 hover:border-white/10"}
                    `}
                  >
                    <div className="relative w-16 aspect-video rounded overflow-hidden bg-black flex-shrink-0">
                      <img src={clip.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      {index === currentClipIndex && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium truncate ${index === currentClipIndex ? "text-primary" : "text-foreground"}`}>
                        {clip.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {clip.submitter?.username}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {clips?.length === 0 && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  Queue is empty! 🎉
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t border-border/50 bg-background/50">
            <Button variant="outline" className="w-full" onClick={handleNext}>
              <SkipForward className="w-4 h-4 mr-2" /> Skip Clip
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
