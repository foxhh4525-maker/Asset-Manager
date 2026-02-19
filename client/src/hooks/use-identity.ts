/**
 * use-identity.ts
 * هوية الزائر — اسم + صورة مخصصة فقط
 * تُخزَّن في localStorage وتبقى بين الجلسات
 */

import { useState, useCallback } from "react";

export interface VisitorIdentity {
  name: string;
  customAvatar?: string | null; // base64 صورة مخصصة
  avatarStyle?: string | null;
  avatarSeed?: string | null;
}

const STORAGE_KEY = "scHub_visitor_identity_v2";

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
  const [identity, setIdentityState] = useState<VisitorIdentity | null>(
    () => getStoredIdentity()
  );

  const setIdentity = useCallback((id: VisitorIdentity) => {
    saveIdentity(id);
    setIdentityState(id);
  }, []);

  const clearIdentity = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIdentityState(null);
  }, []);

  /** الـ URL / base64 الجاهز للعرض — أو null إذا لا توجد صورة */
  const avatarUrl = identity?.customAvatar ?? null;

  return { identity, setIdentity, clearIdentity, avatarUrl };


export function buildAvatarUrl(style?: string | null, seed?: string | null): string | null {
  if (!style || !seed) return null;
  const s = encodeURIComponent(style);
  const sd = encodeURIComponent(seed);
  return `https://api.dicebear.com/10.x/${s}/svg?seed=${sd}`;
}
  return { identity, setIdentity, clearIdentity, avatarUrl };
}
