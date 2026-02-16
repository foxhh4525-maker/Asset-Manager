import { pgTable, text, serial, integer, boolean, timestamp, varchar, primaryKey, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["viewer", "user", "streamer", "moderator"]);
export const clipStatusEnum = pgEnum("clip_status", ["pending", "approved", "rejected", "watched"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clips = pgTable("clips", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
  channelName: text("channel_name").notNull(),
  duration: text("duration").notNull(), // e.g., "0:30"
  tag: text("tag").notNull(), // e.g., "Funny", "Fail"
  submittedBy: integer("submitted_by").references(() => users.id).notNull(),
  status: clipStatusEnum("status").default("pending").notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  clipId: integer("clip_id").references(() => clips.id).notNull(),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
}, (t) => ({
  unq: {
    columns: [t.userId, t.clipId],
  },
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clips: many(clips),
  votes: many(votes),
}));

export const clipsRelations = relations(clips, ({ one, many }) => ({
  submitter: one(users, {
    fields: [clips.submittedBy],
    references: [users.id],
  }),
  votes: many(votes),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  user: one(users, {
    fields: [votes.userId],
    references: [users.id],
  }),
  clip: one(clips, {
    fields: [votes.clipId],
    references: [clips.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertClipSchema = createInsertSchema(clips).omit({ 
  id: true, 
  createdAt: true 
});
export const insertVoteSchema = createInsertSchema(votes).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Clip = typeof clips.$inferSelect;
export type InsertClip = z.infer<typeof insertClipSchema>;
export type Vote = typeof votes.$inferSelect;
export type InsertVote = z.infer<typeof insertVoteSchema>;

// API Contract Types
export type ClipResponse = Clip & { submitter?: { username: string; avatarUrl: string | null } };
export type ClipVoteRequest = { value: number }; // 1 or -1
