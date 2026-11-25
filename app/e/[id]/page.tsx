import EventView from '@/components/EventView';
import { mapEvents } from '@/lib/data';

export function generateStaticParams() {
  return mapEvents.map((e) => ({ id: e.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EventView id={id} />;
}
