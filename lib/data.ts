export const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const asset = (path: string) => `${BASE}${path}`;

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export const frames = (n: number) => `${n} ${plural(n, 'кадр', 'кадра', 'кадров')}`;
export const sources = (n: number) => `${n} ${plural(n, 'источник', 'источника', 'источников')}`;

export type Period = { id: string; label: string; count: number; from: number; to: number };
export type Photo = {
  id: number;
  img: string;
  time: string;
  hour: number;
  source: 'photo' | 'guest';
  likes: number;
  pos: string;
  period: string;
};

const IMGS = [
  'p1', 'p3', 'vp2', 'p5', 'vl1', 'p2', 'vp5', 'p7',
  'vl3', 'p4', 'vp1', 'p6', 'vl5', 'p8', 'vp7', 'vl2',
  'p3', 'vp4', 'vl7', 'p1', 'vp8', 'vl4', 'p5', 'vl8',
];

const START = 19 * 60;
const END = 26 * 60;

export const periods: Period[] = [
  { id: 'a', label: '19–21', count: 34, from: START, to: 21 * 60 },
  { id: 'b', label: '21–23', count: 60, from: 21 * 60, to: 23 * 60 },
  { id: 'c', label: '23–01', count: 54, from: 23 * 60, to: 25 * 60 },
  { id: 'd', label: '01–02', count: 20, from: 25 * 60, to: END },
];

const fmt = (minutes: number) => {
  const m = Math.round(minutes) % (24 * 60);
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const total = 168;

export const photos: Photo[] = Array.from({ length: total }, (_, i) => {
  const minute = START + (i * (END - START)) / total;
  const isGuest = i % 7 === 2 || i % 7 === 4 || i % 7 === 6;
  return {
    id: i,
    img: asset(`/img/${IMGS[i % IMGS.length]}.png`),
    time: fmt(minute),
    hour: Math.floor(minute / 60),
    source: isGuest ? 'guest' : 'photo',
    likes: (i * 37) % 47,
    pos: `${20 + ((i * 13) % 60)}% ${25 + ((i * 17) % 50)}%`,
    period: periods.find((p) => minute >= p.from && minute < p.to)?.id ?? 'a',
  };
});

export const event = {
  id: '7kd2qf9xm',
  title: 'Свадьба Ани',
  venue: 'Лофт «Красный Октябрь»',
  date: '11 июля, суббота',
  window: '19:00–02:00',
  counts: { all: 168, photographer: 96, guests: 72 },
  sources: 24,
  cover: asset('/img/big.png'),
  city: 'Москва',
  wasThere: '21:40',
};

export type MapEvent = {
  id: string;
  title: string;
  venue: string;
  when: string;
  frames: number;
  sources: number;
  img: string;
  x: number;
  y: number;
  locked?: boolean;
  featured?: boolean;
};

export const mapEvents: MapEvent[] = [
  {
    id: '7kd2qf9xm',
    title: 'Свадьба Ани',
    venue: 'Лофт «Красный Октябрь»',
    when: '11 июля, 19:00–02:00',
    frames: 168,
    sources: 24,
    img: asset('/img/vp2.png'),
    x: 50,
    y: 40,
    featured: true,
  },
  {
    id: 'jazz-sol',
    title: 'Джаз в «Соли»',
    venue: 'Бар «Соль»',
    when: '11 июля, 20:00–01:00',
    frames: 84,
    sources: 11,
    img: asset('/img/vl3.png'),
    x: 26,
    y: 24,
  },
  {
    id: 'vinzavod',
    title: 'Открытие «Винзавода»',
    venue: 'ЦСИ Винзавод',
    when: '11 июля, 18:00–23:00',
    frames: 240,
    sources: 38,
    img: asset('/img/p5.png'),
    x: 70,
    y: 28,
  },
  {
    id: 'mark-bday',
    title: 'День рождения Марка',
    venue: 'Крыша на Солянке',
    when: '11 июля, 21:00–03:00',
    frames: 56,
    sources: 9,
    img: asset('/img/vp6.png'),
    x: 33,
    y: 56,
  },
  {
    id: 'kassety',
    title: '«Кассеты»: концерт',
    venue: 'Клуб «Кассеты»',
    when: '11 июля, 22:00–02:00',
    frames: 132,
    sources: 17,
    img: asset('/img/vl5.png'),
    x: 62,
    y: 58,
  },
  {
    id: 'tochki',
    title: 'Корпоратив «Точки»',
    venue: 'Офис на Ленинском',
    when: '11 июля, 19:00–23:00',
    frames: 0,
    sources: 0,
    img: asset('/img/p7.png'),
    x: 18,
    y: 42,
    locked: true,
  },
];

export const cabinet = {
  name: 'Аня Смирнова',
  month: 'ноябрь',
  paid: 1380,
  shot: 252,
  downloaded: 88,
  events: [
    {
      id: '7kd2qf9xm',
      title: 'Свадьба Ани',
      date: '11 июля',
      state: 'опубликован',
      frames: 168,
      sources: 24,
      views: 214,
      downloads: 61,
      money: '690 ₽ оплачено',
      img: asset('/img/vp2.png'),
    },
    {
      id: 'jazz-sol',
      title: 'Джаз в «Соли»',
      date: '3 ноября',
      state: 'опубликован',
      frames: 84,
      sources: 11,
      views: 95,
      downloads: 27,
      money: '690 ₽ оплачено',
      img: asset('/img/vl3.png'),
    },
    {
      id: 'ny-tochki',
      title: 'Новогодний корпоратив',
      date: '20 декабря',
      state: 'черновик',
      frames: 0,
      sources: 0,
      views: 0,
      downloads: 0,
      money: 'ссылка ещё не создана',
      img: asset('/img/p4.png'),
    },
  ],
};
