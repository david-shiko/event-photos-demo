'use client';

import { useEffect, useRef, useState } from 'react';

/** Вечер, созданный в демо: живёт в localStorage, чтобы кабинет его увидел. */
export type Created = {
  id: string;
  code: string;
  title: string;
  venue: string;
  when: string;
};

const KEY = 'ep.created';

export function readCreated(): Created[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as Created[]) : [];
  } catch {
    return [];
  }
}

export function saveCreated(ev: Created) {
  if (typeof window === 'undefined') return;
  try {
    const all = [ev, ...readCreated().filter((e) => e.id !== ev.id)].slice(0, 4);
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* приватный режим — демо переживёт */
  }
}

async function write(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** Копирование ссылки с подтверждением на 1,6 с. */
export function useCopy(ms = 1600) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (text: string) => {
    const ok = await write(text);
    if (!ok) return false;
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), ms);
    return true;
  };

  return { done, copy };
}
