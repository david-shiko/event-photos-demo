import Shell from '@/components/Shell';
import Missing from '@/components/Missing';

export const metadata = { title: 'Страница не найдена — Вечер' };

export default function NotFound() {
  return (
    <Shell
      active="Карта"
      title="Страница не найдена"
      caption="Ссылка не открывается — значит, вечера нет. Выход есть: карта и кабинет."
      note={
        <>
          <b>Битая ссылка — не повод закрывать вкладку.</b> Гость приходит по ссылке из чата,
          спустя недели; если вечер не найден, страница говорит это по-русски и ведёт дальше.
        </>
      }
    >
      <Missing />
    </Shell>
  );
}
