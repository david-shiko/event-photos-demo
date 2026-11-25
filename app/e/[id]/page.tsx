import type { Metadata } from 'next';
import EventView from '@/components/EventView';
import { eventFor, frames, mapEvents } from '@/lib/data';

export function generateStaticParams() {
  return mapEvents.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const ev = eventFor(id);
  const title = `${ev.title} — ${frames(ev.counts.all)}`;
  const description = `${ev.venue} · ${ev.date}, ${ev.window}. Кадры фотографа и гостей на одной странице. Ссылка открывается без приложения и регистрации.`;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventView id={id} />;
}
