'use client';

import Link from 'next/link';
import { useState } from 'react';

const NAV = [
  { href: '/', label: 'Карта', icon: '1' },
  { href: '/e/7kd2qf9xm/', label: 'Вечер', icon: '2' },
  { href: '/u/', label: 'Загрузка', icon: '3' },
  { href: '/photographer/', label: 'Кабинет', icon: '4' },
  { href: '/new/', label: 'Новый вечер', icon: '5' },
];

export default function Shell({
  children,
  active,
  title,
  caption,
  note,
}: {
  children: React.ReactNode;
  active: string;
  title: string;
  caption: string;
  note: React.ReactNode;
}) {
  const [menu, setMenu] = useState(false);

  return (
    <>
      <div className="demo">
        <aside className="side">
          <div className="dt">Свадьба Ани — демо</div>
          <div className="dd">{caption}</div>
          <nav className="nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={item.label === active ? 'on' : ''}>
                <i>{item.icon}</i>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="note">{note}</div>
        </aside>

        <div className="phone">
          <div className="screen">{children}</div>
        </div>
      </div>

      <button className="fab" onClick={() => setMenu(true)} aria-label="Экраны демо">
        ☰
      </button>
      {menu && (
        <div className="menu" onClick={() => setMenu(false)}>
          <div className="in" onClick={(e) => e.stopPropagation()}>
            <div className="t">{title}</div>
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMenu(false)}>
                {item.label}
              </Link>
            ))}
            <div className="sub">Демо на мок-данных. Фотографии — заглушки.</div>
          </div>
        </div>
      )}
    </>
  );
}
