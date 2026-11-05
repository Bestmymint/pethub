import Image from 'next/image';
import { ArrowLeft, PawPrint } from 'lucide-react';
import { UserAvatar } from '@/components/user-avatar';
import { notFound } from 'next/navigation';

import { requireUser } from '@/lib/auth-guards';
import { withLocale, type Locale } from '@/lib/i18n';
import { getMeetupMemberProfile } from './member-profile';

export async function MeetupMemberPage({
  id,
  memberId,
  locale,
}: {
  id: string;
  memberId: string;
  locale: Locale;
}) {
  const profilePath = withLocale(locale, `/meetups/${id}/members/${memberId}`);
  const session = await requireUser(locale, profilePath);
  const member = await getMeetupMemberProfile(
    id,
    memberId,
    session.user.id,
    session.user.role === 'ADMIN',
  );
  if (!member) notFound();
  const th = locale === 'th';
  const chatPath = withLocale(locale, `/meetups/${id}/chat`);
  return (
    <main className="container-shell max-w-5xl py-8 sm:py-10">
      <a
        href={chatPath}
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--forest)] underline underline-offset-4"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {th ? 'กลับไปแชตกลุ่ม' : 'Back to group chat'}
      </a>
      <section className="surface mt-6 flex flex-wrap items-center gap-5 p-6 sm:p-8">
        <UserAvatar src={member.image} name={member.name} className="size-16" />
        <div className="min-w-0 flex-1 basis-48">
          <p className="eyebrow">{th ? 'เพื่อนใน Meetup' : 'YOUR MEETUP COMPANION'}</p>
          <h1 className="mt-2 break-words text-3xl leading-snug">{member.name}</h1>
          <p className="mt-2 break-words text-sm text-[var(--text-muted)]">{member.meetupTitle}</p>
        </div>
        {member.id === session.user.id && (
          <a
            href={withLocale(locale, '/pets')}
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--forest)]"
          >
            <PawPrint size={17} aria-hidden="true" />
            {th ? 'จัดการสัตว์เลี้ยงของฉัน' : 'Manage my pets'}
          </a>
        )}
      </section>
      <section className="mt-8" aria-labelledby="member-pets-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="member-pets-heading" className="min-w-0 break-words text-xl font-semibold">
            {th ? `สัตว์เลี้ยงของ ${member.name}` : `${member.name}’s pets`}
          </h2>
          <span className="rounded-full bg-[var(--sage)] px-3 py-1 text-sm font-semibold text-[var(--forest)]">
            {member.pets.length} {th ? 'ตัว' : member.pets.length === 1 ? 'pet' : 'pets'}
          </span>
        </div>
        {member.pets.length ? (
          <>
            <div className="pet-card-grid">
              {member.pets.map((pet) => {
                const species =
                  pet.species === 'dog'
                    ? th
                      ? 'สุนัข'
                      : 'Dog'
                    : pet.species === 'cat'
                      ? th
                        ? 'แมว'
                        : 'Cat'
                      : th
                        ? 'สัตว์เลี้ยงอื่น ๆ'
                        : 'Other pet';
                const sex =
                  pet.sex === 'male'
                    ? th
                      ? 'เพศผู้'
                      : 'Male'
                    : pet.sex === 'female'
                      ? th
                        ? 'เพศเมีย'
                        : 'Female'
                      : th
                        ? 'ไม่ระบุเพศ'
                        : 'Sex not specified';
                const illustration =
                  pet.species === 'cat' ? 'cat' : pet.species === 'dog' ? 'golden' : 'dog';
                const color =
                  pet.color === 'sage' || pet.color === 'lavender' ? pet.color : 'peach';
                return (
                  <article key={pet.id} className={`pet-profile-card ${color}`}>
                    <span className="pet-card-species">{species}</span>
                    <div className="pet-avatar">
                      <Image
                        src={`/images/pawspace/${illustration}.jpg`}
                        alt=""
                        width={96}
                        height={96}
                      />
                    </div>
                    <h3 className="break-words">{pet.name}</h3>
                    <p className="pet-breed">
                      {pet.breed || (th ? 'ไม่ระบุสายพันธุ์' : 'Breed not specified')}
                    </p>
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{sex}</p>
                  </article>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              {th ? 'รูปสัตว์เลี้ยงเป็นภาพประกอบ' : 'Pet photos are illustrations.'}
            </p>
          </>
        ) : (
          <div className="surface grid justify-items-center gap-3 px-6 py-12 text-center">
            <PawPrint size={34} className="text-[var(--forest-bright)]" aria-hidden="true" />
            <p className="text-[var(--text-muted)]">
              {th
                ? 'สมาชิกคนนี้ยังไม่ได้เพิ่มสัตว์เลี้ยง'
                : 'This member has not added any pets yet.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
