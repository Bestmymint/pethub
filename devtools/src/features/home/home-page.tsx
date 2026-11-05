import Image from 'next/image';
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  MapPinned,
  PawPrint,
  Sparkles,
  ClipboardCheck,
} from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { HomeCategoryBrowser } from '@/features/home/home-category-browser';
import { ScrollHero } from './scroll-hero';
import { categoryDefinitions } from '@/lib/domain';
import { withLocale, type Locale } from '@/lib/i18n';
import { publicPlaceStats } from '@/lib/place-repository';

export async function HomePage({ locale = 'th' }: { locale?: Locale }) {
  const stats = await publicPlaceStats();
  const th = locale === 'th';
  const categories = categoryDefinitions.map((category) => ({
    code: category.code,
    nameTh: category.nameTh,
    nameEn: category.nameEn,
    color: category.color,
    count: stats.facets[category.code] ?? 0,
  }));
  return (
    <PageShell locale={locale}>
      <div className="paw-home">
        <ScrollHero locale={locale} total={stats.total} />
        <section id="home-features" className="paw-home-features container-shell">
          <div className="paw-section-title">
            <div>
              <p className="eyebrow">MADE FOR YOUR KIND OF FAMILY</p>
              <h2>
                {th ? (
                  <>
                    ทุกเรื่องของน้อง
                    <br />
                    อยู่ในพื้นที่เดียวกัน<span>.</span>
                  </>
                ) : (
                  <>
                    Their little world.
                    <br />
                    All in one happy space<span>.</span>
                  </>
                )}
              </h2>
            </div>
            <p>
              {th
                ? 'ความรักมีรายละเอียด เราช่วยคุณเก็บทุกเรื่องสำคัญ ให้คุณมีเวลาดี ๆ กับน้องมากขึ้น'
                : 'Love is in the little details. Keep them together, and make more time for the moments that matter.'}
            </p>
          </div>
          <div className="paw-feature-grid">
            <a href={withLocale(locale, '/pets')} className="paw-feature-card peach">
              <span className="paw-feature-top">
                01 / THEIR OWN SPACE
                <ArrowUpRight size={19} />
              </span>
              <div className="paw-mini-pet">
                <Image src="/images/pawspace/dog.jpg" alt="" width={90} height={90} />
                <PawPrint size={28} />
              </div>
              <h3>{th ? 'เพื่อนตัวโปรดของคุณ' : 'A space of their own'}</h3>
              <p>
                {th
                  ? 'โปรไฟล์ วันเกิด น้ำหนัก และเรื่องเล็ก ๆ ที่ทำให้น้องเป็นน้อง'
                  : 'A profile, birthday, weight, and all the little things that make them, them.'}
              </p>
            </a>
            <a href={withLocale(locale, '/pets')} className="paw-feature-card sage">
              <span className="paw-feature-top">
                02 / MORE HEALTHY DAYS
                <ArrowUpRight size={19} />
              </span>
              <div className="paw-feature-illustration">
                <Heart size={43} />
                <span>✓</span>
                <Sparkles size={23} />
              </div>
              <h3>{th ? 'ดูแลดีในทุก ๆ วัน' : 'Little acts of everyday care'}</h3>
              <p>
                {th
                  ? 'สมุดสุขภาพ กราฟน้ำหนัก และเช็กลิสต์กิจวัตร เก็บทุกการดูแลไว้ด้วยกัน'
                  : 'Health notes, a weight chart, and daily checklists. Every little act of care, together.'}
              </p>
            </a>
            <a href={withLocale(locale, '/explore')} className="paw-feature-card lavender">
              <span className="paw-feature-top">
                03 / GO TOGETHER
                <ArrowUpRight size={19} />
              </span>
              <div className="paw-feature-illustration">
                <MapPinned size={46} />
                <PawPrint size={25} />
                <span>77</span>
              </div>
              <h3>{th ? 'โลกกว้างของเราสองคน' : 'A world to explore together'}</h3>
              <p>
                {th
                  ? `ค้นหา ${stats.total.toLocaleString()} สถานที่ใน 77 จังหวัด พร้อมแผนที่ 3D และรีวิวจากชุมชน`
                  : `Find ${stats.total.toLocaleString()} places across 77 provinces, with a 3D map and community reviews.`}
              </p>
            </a>
          </div>
        </section>
        <section className="paw-home-categories container-shell">
          <div className="paw-section-title">
            <div>
              <p className="eyebrow">LITTLE ADVENTURES START HERE</p>
              <h2>
                {th ? 'สถานที่ตามหมวดหมู่' : 'Find their next favourite place'}
                <span>.</span>
              </h2>
            </div>
            <a className="paw-text-link" href={withLocale(locale, '/explore')}>
              {th ? 'ดูแผนที่ทั้งหมด' : 'Open the map'}
              <ArrowRight size={17} />
            </a>
          </div>
          <HomeCategoryBrowser categories={categories} locale={locale} />
        </section>
        <section className="paw-home-cta container-shell">
          <div>
            <ClipboardCheck size={33} />
            <h2>
              {th ? 'เริ่มเก็บเรื่องราวของน้องไปด้วยกัน' : 'Their next chapter starts with you.'}
            </h2>
            <p>
              {th
                ? 'เพิ่มสมาชิกตัวโปรด ดูแลในทุกวัน แล้วออกไปสร้างความทรงจำใหม่ ๆ'
                : 'Add your little companion. Care for them every day. Make more memories.'}
            </p>
          </div>
          <a className="paw-primary-link" href={withLocale(locale, '/pets')}>
            {th ? 'เพิ่มเพื่อนตัวโปรด' : 'Add your little companion'}
            <ArrowUpRight size={18} />
          </a>
        </section>
      </div>
    </PageShell>
  );
}
