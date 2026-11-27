'use client';

import { useEffect, useRef, useState } from 'react';

/** Вечер, созданный в демо: живёт в localStorage, чтобы кабинет и карта его увидели. */
export type Created = {
  id: string;
  code: string;
  title: string;
  venue: string;
  when: string;
  cover?: string;
  /** вечер виден на карте города: выбор из формы, по умолчанию только по ссылке */
  onMap?: boolean;
  /** точка создания: вечер встаёт на карту ровно туда, где держали палец */
  lat?: number;
  lng?: number;
  /** окно вечера «19:00–02:00» — без него пину нечего показывать на ленте */
  window?: string;
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

/** Время гостя на вечере. Появляется, когда гость сам залил кадр: EXIF знает время съёмки.
 *  Без загрузки время брать неоткуда — «вы были в 21:40» иначе выдумка. */
const WAS = 'ep.wasThere';

export function markUploaded(eventId: string, time: string) {
  if (typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.localStorage.getItem(WAS) ?? '{}') as Record<string, string>;
    all[eventId] = time;
    window.localStorage.setItem(WAS, JSON.stringify(all));
  } catch {
    /* приватный режим — гость просто не увидит «найти себя» */
  }
}

export function readUploaded(eventId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(WAS) ?? '{}') as Record<string, string>;
    return all[eventId] ?? null;
  } catch {
    return null;
  }
}

async function write(text: string) {  try {
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
