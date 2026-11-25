import EventView from '@/components/EventView';

export function generateStaticParams() {
  return [{ id: '7kd2qf9xm' }];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return <EventView />;
}
