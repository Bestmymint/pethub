import type { Metadata } from 'next';
import { MeetupMemberPage } from '@/features/meetups/member-page';

export const metadata: Metadata = { title: 'Member pets', robots: { index: false, follow: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; memberId: string }>;
}) {
  const { id, memberId } = await params;
  return <MeetupMemberPage id={id} memberId={memberId} locale="en" />;
}
