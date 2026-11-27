'use client';

import Link from 'next/link';

/** Тупик наоборот: страницы нет, но выход есть — в карту и в кабинет. */
export default function Missing({
  title = 'Вечер не найден',
  text = 'Ссылка ведёт в пустоту: такого вечера нет или его закрыли.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="miss">
      <div className="mt">{title}</div>
      <div className="md">{text}</div>
      <div className="ma">
        <Link className="p" href="/">
          На карту вечеров
        </Link>
        <Link className="ghost2" href="/photographer/">
          В кабинет
        </Link>
      </div>
      <div className="why">
        <div className="w">
          <b>Вечер ещё не опубликован</b>
          <span>фотограф не отдал пул — ссылка оживёт, когда отдаст</span>
        </div>
        <div className="w">
          <b>Прошло больше 90 дней</b>
          <span>столько живёт ссылка после съёмки</span>
        </div>
        <div className="w">
          <b>Ссылку скопировали с ошибкой</b>
          <span>попросите у организатора свежую — она приходит в чат вечера</span>
        </div>
      </div>
    </div>
  );
}
