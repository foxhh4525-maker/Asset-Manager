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
  deleteClip(id: number): Promise<boolean>;
  updateClipUrl(id: number, url: string): Promise<void>;

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
      id: clips.id,
      url: clips.url,
      title: clips.title,
      thumbnailUrl: clips.thumbnailUrl,
      channelName: clips.channelName,
      duration: clips.duration,
      tag: clips.tag,
      submittedBy: clips.submittedBy,
      status: clips.status,
      upvotes: clips.upvotes,
      downvotes: clips.downvotes,
      createdAt: clips.createdAt,
      submitterName: clips.submitterName,
      videoId:       clips.videoId,
      startTime:     clips.startTime,
      endTime:       clips.endTime,
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

  async deleteClip(id: number): Promise<boolean> {
    // احذف الأصوات أولاً ثم المقطع
    await db.delete(votes).where(eq(votes.clipId, id));
    const result = await db.delete(clips).where(eq(clips.id, id)).returning();
    return result.length > 0;
  }

  async updateClipUrl(id: number, url: string): Promise<void> {
    await db.update(clips).set({ url }).where(eq(clips.id, id));
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

class InMemoryStorage implements IStorage {
  private users: any[] = [];
  private clips: any[] = [];
  private votes: any[] = [];
  private userId = 1;
  private clipId = 1;
  private voteId = 1;

  async getUser(id: number) {
    return this.users.find(u => u.id === id);
  }

  async getUserByDiscordId(discordId: string) {
    return this.users.find(u => u.discordId === discordId);
  }

  async getUserByUsername(username: string) {
    return this.users.find(u => u.username === username);
  }

  async createUser(user: InsertUser) {
    const newUser = { id: this.userId++, ...user } as any;
    this.users.push(newUser);
    return newUser as User;
  }

  async getClips(filters?: { status?: string; sort?: string }) {
    let list = this.clips.slice();
    if (filters?.status) {
      list = list.filter(c => c.status === filters.status);
    }
    if (filters?.sort === 'top') {
      list.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
    } else {
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return list.map(c => ({
      ...c,
      submitter: { username: c.submitter?.username || 'unknown', avatarUrl: c.submitter?.avatarUrl || null },
    }));
  }

  async getClip(id: number) {
    return this.clips.find(c => c.id === id);
  }

  async createClip(clip: InsertClip) {
    const newClip = { id: this.clipId++, createdAt: Date.now(), upvotes: 0, downvotes: 0, ...clip } as any;
    // attach submitter info if present
    if (newClip.submittedBy) {
      const user = this.users.find(u => u.id === newClip.submittedBy);
      newClip.submitter = { username: user?.username || 'unknown', avatarUrl: user?.avatarUrl || null };
    }
    this.clips.push(newClip);
    return newClip as Clip;
  }

  async deleteClip(id: number): Promise<boolean> {
    const idx = this.clips.findIndex(c => c.id === id);
    if (idx === -1) return false;
    this.clips.splice(idx, 1);
    this.votes = this.votes.filter(v => v.clipId !== id);
    return true;
  }

  async updateClipUrl(id: number, url: string): Promise<void> {
    const clip = this.clips.find(c => c.id === id);
    if (clip) clip.url = url;
  }

  async updateClipStatus(id: number, status: string) {
    const clip = this.clips.find(c => c.id === id);
    if (!clip) return undefined;
    clip.status = status;
    return clip as Clip;
  }

  async getVote(userId: number, clipId: number) {
    return this.votes.find(v => v.userId === userId && v.clipId === clipId);
  }

  async submitVote(vote: InsertVote) {
    const newVote = { id: this.voteId++, ...vote } as any;
    this.votes.push(newVote);
  }

  async updateVote(id: number, value: number) {
    const v = this.votes.find(x => x.id === id);
    if (v) v.value = value;
  }

  async deleteVote(id: number) {
    this.votes = this.votes.filter(v => v.id !== id);
  }

  async updateClipVotes(clipId: number) {
    const up = this.votes.filter(v => v.clipId === clipId && v.value === 1).length;
    const down = this.votes.filter(v => v.clipId === clipId && v.value === -1).length;
    const clip = this.clips.find(c => c.id === clipId);
    if (clip) {
      clip.upvotes = up;
      clip.downvotes = down;
    }
  }
}

export const storage = (db ? new DatabaseStorage() : new InMemoryStorage());
