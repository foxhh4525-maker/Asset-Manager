import { db, pool } from "./db";
import { users, clips } from "@shared/schema";
import { storage } from "./storage";

async function seed() {
  console.log("Seeding database...");

  // Ensure the Postgres enum `user_role` contains the 'user' value
  // This is safe to run repeatedly.
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'user_role' AND e.enumlabel = 'user'
        ) THEN
          EXECUTE 'ALTER TYPE user_role ADD VALUE ''user''';
        END IF;
      END
      $$;
    `);
  } finally {
    client.release();
  }

  // Check if users exist
  const existingUser = await storage.getUserByUsername("StreamerDemo");
  let userId: number;

  if (!existingUser) {
    console.log("Creating demo streamer...");
    const user = await storage.createUser({
      discordId: "demo-streamer-id",
      username: "StreamerDemo",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Streamer",
      role: "streamer",
    } as any);
    userId = user.id;
  } else {
    userId = existingUser.id;
  }

  // Check if clips exist
  const existingClips = await storage.getClips();
  if (existingClips.length === 0) {
    console.log("Creating demo clips...");
    
    const demoClips = [
      {
        url: "https://www.youtube.com/clip/Ugkx-1234567890abcdef",
        title: "INSANE 1v5 Clutch!",
        thumbnailUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80",
        channelName: "ProGamer123",
        duration: "0:45",
        tag: "Skill",
        status: "pending",
        upvotes: 42,
        downvotes: 2,
        submittedBy: userId,
      },
      {
        url: "https://www.youtube.com/clip/Ugkx-0987654321fedcba",
        title: "Funniest Fail of the Week",
        thumbnailUrl: "https://images.unsplash.com/photo-1531297461136-82lw9z2",
        channelName: "FailArmy",
        duration: "0:30",
        tag: "Fail",
        status: "pending",
        upvotes: 15,
        downvotes: 0,
        submittedBy: userId,
      },
      {
        url: "https://www.youtube.com/clip/Ugkx-abcdef1234567890",
        title: "Game Breaking Glitch??",
        thumbnailUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&q=80",
        channelName: "GlitchHunter",
        duration: "0:15",
        tag: "Glitch",
        status: "approved",
        upvotes: 120,
        downvotes: 5,
        submittedBy: userId,
      }
    ];

    for (const clip of demoClips) {
      await storage.createClip(clip as any);
    }
    console.log("Seeded 3 clips.");
  } else {
    console.log("Clips already exist, skipping seed.");
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
