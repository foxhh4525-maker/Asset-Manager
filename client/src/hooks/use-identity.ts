/**
 * use-identity.ts
 * هوية الزائر — تُخزَّن في localStorage وتبقى بين الجلسات
 */

import { useState, useCallback } from "react";

export interface VisitorIdentity {
  name: string;
  avatarStyle: string;
  avatarSeed: string;
  customAvatar?: string | null; // base64 صورة مخصصة
}

const STORAGE_KEY = "scHub_visitor_identity";

export const AVATAR_STYLES = [
  { id: "bottts",      label: "روبوت 🤖" },
  { id: "pixel-art",   label: "بيكسل 🎮" },
  { id: "adventurer",  label: "مغامر ⚔️" },
  { id: "avataaars",   label: "كلاسيك 🧑" },
  { id: "thumbs",      label: "ملصق 👍" },
];

export function buildAvatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=1a1a2e`;
}

/** يرجع الـ URL الفعلي للعرض (صورة مخصصة أو مولّدة) */
export function getDisplayAvatar(identity: VisitorIdentity | null): string | null {
  if (!identity) return null;
  if (identity.customAvatar) return identity.customAvatar;
  return buildAvatarUrl(identity.avatarStyle, identity.avatarSeed);
}

export function getStoredIdentity(): VisitorIdentity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveIdentity(identity: VisitorIdentity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function useIdentity() {
  const [identity, setIdentityState] = useState<VisitorIdentity | null>(() => getStoredIdentity());

  const setIdentity = useCallback((id: VisitorIdentity) => {
    saveIdentity(id);
    setIdentityState(id);
  }, []);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIdentityState(null);
  }, []);

  /** الـ URL الجاهز للعرض مباشرة */
  const avatarUrl = identity
    ? (identity.customAvatar || buildAvatarUrl(identity.avatarStyle, identity.avatarSeed))
    : null;

  return { identity, setIdentity, clearIdentity, avatarUrl };
}
