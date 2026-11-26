'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { asset, type MapEvent } from '@/lib/data';

type Props = {
  events: MapEvent[];
  activeId: string;
  onPick: (id: string) => void;
};

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const CENTER: [number, number] = [37.628, 55.7505];

export default function LiveMap({ events, activeId, onPick }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<import('maplibre-gl').Map | null>(null);
  const pins = useRef<Map<string, import('maplibre-gl').Marker>>(new Map());
  const pick = useRef(onPick);
  const ready = useRef(false);
  const initial = useRef(events);
  const observer = useRef<ResizeObserver | null>(null);
  pick.current = onPick;

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

      /* карточка вечера разворачивается — полотно должно за ней следовать */
      const ro = new ResizeObserver(() => m.resize());
      ro.observe(box.current);
      observer.current = ro;

      m.on('load', () => {
        ready.current = true;

        /* подписи по-русски, где они есть в данных */
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
          m.fitBounds(b, { padding: { top: 168, bottom: 132, left: 36, right: 36 }, maxZoom: 14, duration: 0 });
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

  /* точки пересобираются, когда меняется фильтр или выбор */
  useEffect(() => {
    let dead = false;

    const sync = async () => {
      const maplibregl = await import('maplibre-gl');
      const m = map.current;
      if (dead || !m || !ready.current) return;

      const alive = new Set(events.map((e) => e.id));
      pins.current.forEach((marker, id) => {
        if (!alive.has(id)) {
          marker.remove();
          pins.current.delete(id);
        }
      });

      events.forEach((e) => {
        const existing = pins.current.get(e.id);
        let marker: import('maplibre-gl').Marker;
        if (existing) {
          marker = existing;
        } else {
          const time = e.when.split(', ')[1]?.split('–')[0] ?? '';
          const el = document.createElement('button');
          el.className = `lpin ${e.soon ? 'soon' : ''} ${e.locked ? 'lock' : ''}`;
          el.type = 'button';
          el.innerHTML =
            `<span class="pc" ${e.locked ? '' : `style="background-image:url('${e.img}')"`}>` +
            `${e.locked ? '⌂' : ''}</span>` +
            (e.frames > 0 ? `<b>${e.frames}</b>` : e.soon ? `<b class="t">${time}</b>` : '') +
            `<span class="nm">${e.title}</span>`;
          el.addEventListener('click', () => pick.current(e.id));
          marker = new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([e.lng, e.lat])
            .addTo(m);
          pins.current.set(e.id, marker);
        }
        marker.getElement().classList.toggle('on', e.id === activeId);
      });
    };

    sync();
    if (!ready.current) {
      const onReady = () => sync();
      window.addEventListener('lmap-ready', onReady, { once: true });
      return () => {
        dead = true;
        window.removeEventListener('lmap-ready', onReady);
      };
    }
    return () => {
      dead = true;
    };
  }, [events, activeId]);

  /* выбранный вечер — в центр, если он уехал за край */
  useEffect(() => {
    const e = events.find((x) => x.id === activeId);
    const m = map.current;
    if (!m || !e || !ready.current) return;
    const p = m.project([e.lng, e.lat]);
    const pad = 70;
    const out =
      p.x < pad || p.y < pad || p.x > m.getCanvas().clientWidth - pad || p.y > 360;
    if (out) m.easeTo({ center: [e.lng, e.lat], duration: 450 });
  }, [activeId, events]);

  return <div ref={box} className="lmap" aria-label="Карта вечеров" />;
}
