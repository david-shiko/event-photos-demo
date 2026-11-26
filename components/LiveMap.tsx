'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import Supercluster from 'supercluster';
import { useEffect, useRef, useState } from 'react';
import { asset, plural, type MapEvent } from '@/lib/data';

type Props = {
  events: MapEvent[];
  dim?: string[];
  activeId: string | null;
  open: boolean;
  onPick: (id: string) => void;
  onCollapse: () => void;
  onCluster: (items: MapEvent[]) => void;
};

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const CENTER: [number, number] = [37.628, 55.7505];
/* пять и больше вечеров в одном адресе — стопка (design.md §3.5) */
const STACK_MIN = 5;
const CARD_W = 252;

type Group = { items: MapEvent[]; lat: number; lng: number };
type Card = { x: number; y: number; below: boolean };

const spread = (items: MapEvent[]): Group => ({
  items,
  lat: items.reduce((s, e) => s + e.lat, 0) / items.length,
  lng: items.reduce((s, e) => s + e.lng, 0) / items.length,
});

export default function LiveMap({ events, dim = [], activeId, open, onPick, onCollapse, onCluster }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('maplibre-gl').Map | null>(null);
  const pins = useRef<Map<string, import('maplibre-gl').Marker>>(new Map());
  const groups = useRef<Group[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const pick = useRef(onPick);
  const cluster = useRef(onCluster);
  const ready = useRef(false);
  const initial = useRef(events);
  const observer = useRef<ResizeObserver | null>(null);
  const raf = useRef(0);
  const startZoom = useRef(13);
  pick.current = onPick;
  cluster.current = onCluster;

  useEffect(() => {
    let dead = false;

    (async () => {
      const maplibregl = await import('maplibre-gl');
      if (dead || !box.current) return;

      maplibregl.setWorkerUrl(asset('/maplibre-gl-worker.mjs'));

      const m = new maplibregl.Map({
        container: box.current,
        style: STYLE,
        center: CENTER,
        zoom: 12.6,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
      map.current = m;
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      const ro = new ResizeObserver(() => m.resize());
      ro.observe(box.current);
      observer.current = ro;

      m.on('load', () => {
        ready.current = true;
        setLoaded(true);

        m.setPadding({ top: 124, bottom: 208, left: 14, right: 14 });

        m.getStyle()?.layers?.forEach((l) => {
          if (l.type !== 'symbol') return;
          const field = (l.layout as Record<string, unknown> | undefined)?.['text-field'];
          if (!field) return;
          try {
            m.setLayoutProperty(l.id, 'text-field', ['coalesce', ['get', 'name:ru'], ['get', 'name']]);
          } catch {
            /* слой не поддерживает — оставляем как есть */
          }
        });

        const pts = initial.current.map((e) => [e.lng, e.lat] as [number, number]);
        if (pts.length > 1) {
          const b = new maplibregl.LngLatBounds(pts[0], pts[0]);
          pts.slice(1).forEach((pt) => b.extend(pt));
          /* охват считаем по размеру полотна: fitBounds до первого resize врёт */
          const cam = m.cameraForBounds(b, { padding: 0 });
          if (cam?.center) {
            startZoom.current = Math.min((cam.zoom ?? 13) + 0.85, 13.4);
            m.jumpTo({ center: cam.center, zoom: startZoom.current });
          }
        }

        m.resize();
        window.dispatchEvent(new Event('lmap-ready'));
      });

    })();

    return () => {
      dead = true;
      observer.current?.disconnect();
      ready.current = false;
      pins.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  /* пины: одна группа — один маркер. Пять и больше в пятне — стопка со счётчиком. */
  useEffect(() => {
    let dead = false;

    const sync = async () => {
      const maplibregl = await import('maplibre-gl');
      const m = map.current;
      if (dead || !m || !ready.current) return;

      /* один адрес — одна группа */
      const byVenue = new Map<string, MapEvent[]>();
      for (const e of events) {
        const key = e.venue;
        const bucket = byVenue.get(key);
        if (bucket) bucket.push(e);
        else byVenue.set(key, [e]);
      }
      const merged = [...byVenue.values()].map(spread);

      /* группировку считает supercluster — тот движок, что MapLibre держит внутри.
         Свой обход пикселей умел залипать: стопка не раскрывалась при зуме. */
      const index = new Supercluster<{ ids: string[] }, { ids: string[] }>({
        radius: 26,
        maxZoom: 15,
        /* копия обязательна: reduce мутирует аккумулятор, а он же — массив точки */
        map: (p) => ({ ids: [...p.ids] }),
        reduce: (acc, p) => {
          acc.ids = acc.ids.concat(p.ids);
        },
      });
      index.load(
        merged.map((g) => ({
          type: 'Feature' as const,
          properties: { ids: g.items.map((i) => i.id) },
          geometry: { type: 'Point' as const, coordinates: [g.lng, g.lat] },
        })),
      );

      const byId = new Map(events.map((e) => [e.id, e]));
      const shown = index.getClusters([-180, -85, 180, 85], Math.round(m.getZoom()));
      const next: Group[] = shown.map((f) => {
        const ids = f.properties.ids ?? [];
        const items = ids.map((id) => byId.get(id)).filter((e): e is MapEvent => !!e);
        const [lng, lat] = f.geometry.coordinates;
        return { items, lng, lat };
      });
      groups.current = next;

      const keys = new Set(next.map((g) => g.items.map((i) => i.id).sort().join('+')));
      pins.current.forEach((marker, key) => {
        if (!keys.has(key)) {
          marker.remove();
          pins.current.delete(key);
        }
      });

      next.forEach((g) => {
        const key = g.items.map((i) => i.id).sort().join('+');
        const stack = g.items.length >= STACK_MIN;
        const lead = g.items.find((i) => i.id === activeId) ?? g.items[0];
        let marker = pins.current.get(key);
        if (!marker) {
          const el = document.createElement('button');
          el.type = 'button';
          el.className = stack ? 'lstack' : `lpin ${lead.soon ? 'soon' : ''} ${lead.locked ? 'lock' : ''}`;
          if (stack) {
            const venues = new Set(g.items.map((i) => i.venue));
            const label = venues.size > 1 ? 'Москва' : lead.venue;
            el.dataset.venue = lead.venue;
            el.innerHTML = `<b>${g.items.length}</b><span class="nm">${label}</span>`;
            el.addEventListener('click', () => cluster.current(g.items));
          } else {
            const time = lead.when.split(', ')[1]?.split('–')[0] ?? '';
            el.innerHTML =
              `<span class="pc" ${lead.locked ? '' : `style="background-image:url('${lead.img}')"`}>` +
              `${lead.locked ? '⌂' : ''}</span>` +
              (lead.frames > 0 ? `<b>${lead.frames}</b>` : lead.soon ? `<b class="t">${time}</b>` : '') +
              `<span class="nm">${lead.title}</span>`;
            el.addEventListener('click', () => pick.current(lead.id));
          }
          marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([g.lng, g.lat]).addTo(m);
          pins.current.set(key, marker);
        }
        const el = marker.getElement();
        el.classList.toggle('on', g.items.some((i) => i.id === activeId));
        el.classList.toggle('dim', g.items.every((i) => dim.includes(i.id)));
      });
    };

    sync();
    /* плотность стопок зависит от зума: без пересчёта стопка не раскрывается.
       Карта создаётся в другом эффекте, поэтому вешаем обработчик и сразу,
       и по её готовности — сработает первый. */
    const onZoom = () => sync();
    let hooked = false;
    const attach = () => {
      const mm = map.current;
      if (!mm || hooked) return;
      mm.on('zoomend', onZoom);
      hooked = true;
    };
    const onReady = () => {
      attach();
      sync();
    };
    attach();
    window.addEventListener('lmap-ready', onReady);
    return () => {
      dead = true;
      window.removeEventListener('lmap-ready', onReady);
      if (hooked) map.current?.off('zoomend', onZoom);
    };
  }, [events, activeId, dim]);


  /* карточка висит над выбранным пином и едет вместе с картой */
  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const place = () => {
      const e = events.find((x) => x.id === activeId);
      if (!e || !open) {
        setCard(null);
        return;
      }
      const p = m.project([e.lng, e.lat]);
      const w = m.getCanvas().clientWidth;
      const half = CARD_W / 2 + 12;
      const x = Math.min(Math.max(p.x, half), w - half);
      const below = p.y < 210;
      setCard({ x, y: below ? p.y + 34 : p.y - 34, below });
    };

    const onMove = () => {
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(place);
    };

    place();
    m.on('move', onMove);
    m.on('zoom', onMove);
    m.on('resize', onMove);
    return () => {
      cancelAnimationFrame(raf.current);
      m.off('move', onMove);
      m.off('zoom', onMove);
      m.off('resize', onMove);
    };
  }, [activeId, open, events, loaded]);

  /* выбранный вечер — в центр, если уехал за край */
  useEffect(() => {
    const e = events.find((x) => x.id === activeId);
    const m = map.current;
    if (!m || !e || !ready.current) return;
    const p = m.project([e.lng, e.lat]);
    const pad = 80;
    const out = p.x < pad || p.y < pad || p.x > m.getCanvas().clientWidth - pad || p.y > 420;
    if (out) m.easeTo({ center: [e.lng, e.lat], duration: 450 });
  }, [activeId, events]);

  const active = open ? events.find((e) => e.id === activeId) ?? null : null;
  const stat = active
    ? active.frames > 0
      ? `${active.frames} фото · ${active.sources} ${plural(active.sources, 'источник', 'источника', 'источников')} · фото готовы`
      : 'кадров пока нет — вечер впереди'
    : '';
  const byline = active
    ? active.by
      ? `снимали: ${active.by}${active.sources > 1 ? ` и ещё ${active.sources - 1}` : ''}`
      : 'снимали: пока никто'
    : '';

  return (
    <>
      <div ref={box} className="lmap" aria-label="Карта вечеров" />
      {!loaded && <span className="lmap-load">карта загружается…</span>}

      {active && card && (
        <div
          className={`pincard ${card.below ? 'below' : ''}`}
          style={{ left: card.x, top: card.y }}
          role="dialog"
          aria-label={active.title}
        >
          <button className="x" onClick={onCollapse} aria-label="Свернуть карточку">
            ×
          </button>
          <div className="pt">{active.title}</div>
          <div className="pl">
            {active.venue} · {active.when.split(', ')[1]}
          </div>
          <div className="ps">{stat}</div>
          <div className="pa">{byline}</div>
          <Link className="go" href={`/e/${active.id}/`}>
            открыть
          </Link>
          <i className="tail" />
        </div>
      )}
    </>
  );
}
