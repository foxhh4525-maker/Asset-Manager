import { users, clips, votes, type User, type InsertUser, type Clip, type InsertClip, type Vote, type InsertVote } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByDiscordId(discordId: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clips
  getClips(filters?: { status?: string; sort?: string }): Promise<(Clip & { submitter: { username: string; avatarUrl: string | null } })[]>;
  getClip(id: number): Promise<Clip | undefined>;
  createClip(clip: InsertClip): Promise<Clip>;
  updateClipStatus(id: number, status: string): Promise<Clip | undefined>;
  
  // Votes
  getVote(userId: number, clipId: number): Promise<Vote | undefined>;
  submitVote(vote: InsertVote): Promise<void>;
  updateVote(id: number, value: number): Promise<void>;
  deleteVote(id: number): Promise<void>;
  updateClipVotes(clipId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByDiscordId(discordId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getClips(filters?: { status?: string; sort?: string }): Promise<(Clip & { submitter: { username: string; avatarUrl: string | null } })[]> {
    let query = db.select({
      ...clips,
      submitter: {
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(clips)
    .innerJoin(users, eq(clips.submittedBy, users.id));

    if (filters?.status) {
      // @ts-ignore
      query = query.where(eq(clips.status, filters.status));
    }

    if (filters?.sort === 'top') {
      // @ts-ignore
      query = query.orderBy(desc(clips.upvotes));
    } else {
      // @ts-ignore
      query = query.orderBy(desc(clips.createdAt));
    }

    // @ts-ignore
    return await query;
  }

  async getClip(id: number): Promise<Clip | undefined> {
    const [clip] = await db.select().from(clips).where(eq(clips.id, id));
    return clip;
  }

  async createClip(clip: InsertClip): Promise<Clip> {
    const [newClip] = await db.insert(clips).values(clip).returning();
    return newClip;
  }

  async updateClipStatus(id: number, status: string): Promise<Clip | undefined> {
    // @ts-ignore
    const [updatedClip] = await db.update(clips).set({ status }).where(eq(clips.id, id)).returning();
    return updatedClip;
  }

  async getVote(userId: number, clipId: number): Promise<Vote | undefined> {
    const [vote] = await db.select().from(votes).where(and(eq(votes.userId, userId), eq(votes.clipId, clipId)));
    return vote;
  }

  async submitVote(vote: InsertVote): Promise<void> {
    await db.insert(votes).values(vote);
  }

  async updateVote(id: number, value: number): Promise<void> {
    await db.update(votes).set({ value }).where(eq(votes.id, id));
  }

  async deleteVote(id: number): Promise<void> {
    await db.delete(votes).where(eq(votes.id, id));
  }

  async updateClipVotes(clipId: number): Promise<void> {
    const [result] = await db
      .select({
        upvotes: sql<number>`count(case when value = 1 then 1 end)`,
        downvotes: sql<number>`count(case when value = -1 then 1 end)`,
      })
      .from(votes)
      .where(eq(votes.clipId, clipId));

    await db.update(clips).set({
      upvotes: result?.upvotes || 0,
      downvotes: result?.downvotes || 0,
    }).where(eq(clips.id, clipId));
  }
}

export const storage = new DatabaseStorage();
