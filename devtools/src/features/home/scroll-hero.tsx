'use client';

import Image from 'next/image';
import { ArrowDown, ArrowRight, ArrowUpRight, Heart, PawPrint } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { withLocale, type Locale } from '@/lib/i18n';

const chapters = [
  {
    word: 'PET CARE',
    label: ['ดูแลด้วยรัก', 'A LITTLE CARE'],
    title: ['ทุกที่ที่ไป\nทุกวันที่มีกัน', 'Everywhere you go.\nEvery little moment.'],
    description: [
      'เพราะเขาเป็นมากกว่าสัตว์เลี้ยง ทุกวันของเราเลยมีความหมาย',
      'More than a pet. Your everyday sunshine, your favourite little companion.',
    ],
  },
  {
    word: 'MORE LOVE',
    label: ['เรื่องเล็ก ๆ ที่สำคัญ', 'THE LITTLE THINGS'],
    title: ['รักเขาให้ดี\nในทุก ๆ วัน', 'Little acts of care.\nA whole lot of love.'],
    description: [
      'สมุดสุขภาพ กราฟน้ำหนัก และกิจวัตร เก็บทุกการดูแลไว้ด้วยกัน',
      'Health notes, weight milestones and everyday routines. All in their own little space.',
    ],
  },
  {
    word: 'GO PLACES',
    label: ['ความทรงจำบทต่อไป', 'OUR NEXT ADVENTURE'],
    title: ['โลกกว้างแค่ไหน\nก็ไปด้วยกันได้', 'New places.\nSame best friend.'],
    description: [
      'หาที่ใหม่ ๆ ที่ต้อนรับเพื่อนตัวโปรด แล้วออกไปสร้างความทรงจำด้วยกัน',
      'Find places that welcome both of you. Make room for more happy memories.',
    ],
  },
] as const;

export function ScrollHero({ locale, total }: { locale: Locale; total: number }) {
  const root = useRef<HTMLElement>(null);
  const [chapter, setChapter] = useState<0 | 1 | 2>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const language = locale === 'th' ? 0 : 1;

  useEffect(() => {
    const section = root.current;
    if (!section) return;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      const reduced = preference.matches;
      const stage = section.firstElementChild as HTMLElement;
      const distance = Math.max(1, section.offsetHeight - stage.offsetHeight);
      const progress = reduced
        ? 0
        : Math.min(1, Math.max(0, (80 - section.getBoundingClientRect().top) / distance));
      const mobile = innerWidth < 768;
      const x = Math.sin(progress * Math.PI * 1.7) * (mobile ? 28 : 105);
      section.style.setProperty('--story-progress', String(progress));
      section.style.setProperty('--puppy-x', `${x}px`);
      section.style.setProperty(
        '--puppy-y',
        `${Math.sin(progress * Math.PI) * (mobile ? -12 : -24)}px`,
      );
      section.style.setProperty(
        '--puppy-scale',
        String(1 + Math.sin(progress * Math.PI) * (mobile ? 0.08 : 0.12)),
      );
      section.style.setProperty('--puppy-turn', `${Math.sin(progress * Math.PI * 2) * 3}deg`);
      setChapter(progress < 0.33 ? 0 : progress < 0.67 ? 1 : 2);
      setReducedMotion(reduced);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    preference.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      preference.removeEventListener('change', schedule);
    };
  }, []);

  const active = chapters[chapter];
  return (
    <section
      ref={root}
      className="paw-scroll-hero"
      data-chapter={chapter}
      data-motion={reducedMotion ? 'reduced' : 'scroll'}
      aria-label={language === 0 ? 'ทุกวันดี ๆ ของเราและเพื่อนตัวโปรด' : 'Little moments, together'}
    >
      <div className="paw-story-stage">
        <div className="paw-story-wash" aria-hidden="true" />
        <div className="paw-story-topline">
          <span>
            <PawPrint size={15} /> YOUR LITTLE HAPPY SPACE
          </span>
          <span className="paw-story-counter" aria-hidden="true">
            0{chapter + 1} / 03
          </span>
        </div>
        <div className="paw-story-word" aria-hidden="true">
          {active.word}
        </div>
        <div className="paw-story-copy">
          <p className="paw-story-kicker">
            <span />
            {active.label[language]}
          </p>
          <h1>{active.title[language]}</h1>
          <p className="paw-story-description">{active.description[language]}</p>
          <a className="paw-story-skip" href="#home-features">
            {language === 0 ? 'รู้จัก PetHub' : 'Meet PetHub'} <ArrowRight size={16} />
          </a>
        </div>
        <div className="paw-story-puppy">
          <Image
            src="/images/home/golden-puppy-cutout.png"
            alt={
              language === 0
                ? 'ลูกสุนัขโกลเด้นรีทรีฟเวอร์ เพื่อนตัวโปรดของเรา'
                : 'Our little golden retriever companion'
            }
            width={1448}
            height={1086}
            sizes="(max-width: 767px) 100vw, 65vw"
            priority
          />
        </div>
        <div className="paw-story-badge">
          <Heart size={21} aria-hidden="true" />
          <span>
            HAPPY PETS.
            <br />
            HAPPY HUMANS.
          </span>
        </div>
        <div className="paw-story-note">
          <span>{language === 0 ? 'ความสุขอยู่ใกล้ ๆ ตัว' : 'A little world. A lot of love.'}</span>
          <small>
            {total.toLocaleString()}{' '}
            {language === 0 ? 'สถานที่ พร้อมไปด้วยกัน' : 'places to go together'}
          </small>
        </div>
        <div className="paw-story-footer">
          <a className="paw-story-scroll" href="#home-features">
            <ArrowDown size={17} />
            {language === 0 ? 'เลื่อนลง แล้วไปด้วยกัน' : 'SCROLL TO MAKE MEMORIES'}
          </a>
          <div className="paw-story-actions">
            <a className="paw-story-primary" href={withLocale(locale, '/pets')}>
              {language === 0 ? 'สร้างพื้นที่ให้น้อง' : 'Your pet’s little space'}{' '}
              <ArrowUpRight size={18} />
            </a>
            <a className="paw-story-secondary" href={withLocale(locale, '/explore')}>
              {language === 0 ? 'สำรวจแผนที่' : 'Explore the map'} <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
