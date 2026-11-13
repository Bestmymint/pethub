import type { Prisma } from '@prisma/client';

import { MAX_PINNED_MESSAGES } from '@/features/meetups/chat-pins';
import { MEMBER_PETS, petRow } from './demo-pets';
import { DEMO_EMAIL_DOMAIN, bangkokTime, demoId, demoImageKey, hoursAgo } from './demo-config';

/** Everything the content depends on. The builder is pure, so tests can feed it small fixtures. */
export interface DemoRefs {
  now: Date;
  /** Visible, imported places to attach meetups, reviews and reports to (at least one). */
  places: Array<{ id: string; nameTh: string }>;
  provinceId: string;
  categoryId: string;
  /** The seeded demo user account, so the teacher sees content when logging in as that user. */
  demoUserId: string | null;
  /** The second seeded sign-in account. Null while it is not seeded yet; its rows are then left out. */
  demoUser2Id: string | null;
}

export interface DemoContent {
  users: Prisma.UserCreateManyInput[];
  pets: Prisma.PetCreateManyInput[];
  meetups: Prisma.MeetupCreateManyInput[];
  members: Prisma.MeetupMemberCreateManyInput[];
  messages: Prisma.MeetupMessageCreateManyInput[];
  reviews: Prisma.ReviewCreateManyInput[];
  submissions: Prisma.SubmissionCreateManyInput[];
  notifications: Prisma.NotificationCreateManyInput[];
  meetupReports: Prisma.MeetupReportCreateManyInput[];
  placeReports: Prisma.ReportCreateManyInput[];
  /** Chat photos to store, by object key. */
  images: Array<{ key: string; color: string }>;
}

const PERSONAS = [
  'สมชาย ใจดี',
  'พิมพ์ชนก รักสัตว์',
  'ธนากร แสงทอง',
  'วริศรา เพชรงาม',
  'กิตติพงษ์ ศรีสุข',
  'อรวรรณ มีสุข',
];

/** A made-up member (by index) or one of the two seeded sign-in users. */
type UserKey = number | 'demoUser' | 'demoUser2';
type Author = UserKey | 'system';

interface MessageSpec {
  author: Author;
  text: string | null;
  hours: number;
  pinned?: boolean;
  image?: 1 | 2;
  replyTo?: number;
}

interface MeetupSpec {
  title: string;
  description: string;
  rules: string;
  status: 'OPEN' | 'COMPLETED';
  startDays: number;
  startHour: number;
  durationHours: number;
  maxMembers: number;
  host: UserKey;
  members: UserKey[];
  demoUserJoins: boolean;
  messages: MessageSpec[];
}

const MEETUPS: MeetupSpec[] = [
  {
    title: 'เดินเล่นกับน้องหมายามเช้า',
    description:
      'ชวนเจ้าของน้องหมามาเดินเล่นสบาย ๆ ที่สวนสาธารณะ เจอเพื่อนใหม่ แลกเปลี่ยนเรื่องอาหารและสุขภาพน้อง ๆ เหมาะกับน้องหมาทุกขนาดที่เข้าสังคมได้',
    rules: 'จูงสายตลอดเวลา เก็บมูลน้องทุกครั้ง และดูแลไม่ให้น้องทะเลาะกัน',
    status: 'OPEN',
    startDays: 2,
    startHour: 8,
    durationHours: 2,
    maxMembers: 12,
    host: 0,
    members: [1, 2, 3],
    demoUserJoins: true,
    messages: [
      { author: 'system', text: 'สมชาย ใจดี สร้างกลุ่มนี้แล้ว', hours: 120 },
      {
        author: 0,
        text: 'ประกาศ: นัดเจอกันที่หน้าประตู 2 เวลา 08:00 น. นะครับ ใครมาเกินสิบนาทีโทรบอกได้เลย',
        hours: 96,
        pinned: true,
      },
      {
        author: 1,
        text: 'ยินดีที่ได้รู้จักทุกคนค่ะ น้องข้าวปั้นโกลเด้นอายุ 2 ขวบ ขี้เล่นมาก',
        hours: 90,
      },
      {
        author: 0,
        text: 'ข้อตกลงกลุ่ม: จูงสายตลอด เก็บมูลทุกครั้ง และถ้าน้องไม่คุ้นกับสุนัขตัวอื่นให้แจ้งก่อนนะครับ',
        hours: 88,
        pinned: true,
      },
      {
        author: 2,
        text: 'น้องถั่วดำชิสุห์ ตื่นเต้นง่ายนิดหน่อย ขอเดินท้ายกลุ่มได้ไหมครับ',
        hours: 70,
      },
      { author: 0, text: 'ได้เลยครับ เดินตามจังหวะน้อง ๆ ไม่ต้องรีบ', hours: 69, replyTo: 5 },
      {
        author: 'demoUser',
        text: 'ขอเข้าร่วมด้วยคนนะคะ มีน้องแมวแต่ไปเป็นเพื่อนน้องหมาของเพื่อนค่ะ',
        hours: 50,
      },
      { author: 3, text: 'บรรยากาศตอนซ้อมเมื่อวานสวยมากค่ะ แชร์รูปให้ดูนะคะ', hours: 30 },
      { author: 3, text: null, hours: 29.9, image: 1 },
      { author: 1, text: 'อันนี้คาเฟ่ข้างสวนที่เราจะแวะต่อหลังเดินเสร็จค่ะ', hours: 28 },
      { author: 1, text: null, hours: 27.9, image: 2 },
      { author: 1, text: 'น่ารักมากเลย! พรุ่งนี้เจอกันค่ะ', hours: 6 },
      { author: 4, text: 'ใกล้ถึงวันนัดแล้ว อย่าลืมพกน้ำให้น้องด้วยนะ อากาศร้อน', hours: 2 },
    ],
  },
  {
    title: 'คุยเรื่องแมวที่คาเฟ่เป็นมิตรกับสัตว์เลี้ยง',
    description:
      'นั่งจิบกาแฟและคุยเรื่องการเลี้ยงแมว ทั้งอาหาร การพาไปหาหมอ และการฝึกให้ชินกับกรงเดินทาง ใครไม่มีแมวก็มาฟังได้',
    rules: 'พาแมวมาในกระเป๋าหรือกรงเท่านั้น และแจ้งร้านก่อนหากแมวตื่นกลัวง่าย',
    status: 'OPEN',
    startDays: 4,
    startHour: 14,
    durationHours: 3,
    maxMembers: 10,
    host: 1,
    members: [0, 3, 5],
    demoUserJoins: true,
    messages: [
      { author: 'system', text: 'พิมพ์ชนก รักสัตว์ สร้างกลุ่มนี้แล้ว', hours: 100 },
      {
        author: 1,
        text: 'ร้านสงวนที่นั่งโซนในร่มไว้ให้เราแล้วนะคะ โต๊ะยาวติดหน้าต่าง',
        hours: 80,
        pinned: true,
      },
      { author: 5, text: 'แมวของฉันกลัวเสียงเครื่องบดกาแฟ ทำยังไงดีคะ', hours: 60 },
      { author: 3, text: 'ลองเอาผ้าคลุมกรงไว้ค่ะ ช่วยให้แมวสงบขึ้นเยอะเลย', hours: 58, replyTo: 3 },
      {
        author: 5,
        text: 'ลดราคาพิเศษ! ทักไลน์สั่งอาหารแมวราคาส่งได้เลยที่ลิงก์นี้ รีบก่อนหมด',
        hours: 40,
      },
      { author: 'demoUser', text: 'ขอบคุณสำหรับทริคเรื่องผ้าคลุมกรงนะคะ จะลองดู', hours: 20 },
      { author: 0, text: 'เจอกันวันนัดนะครับ ผมจะพาน้องส้มไปด้วย', hours: 4 },
    ],
  },
  {
    title: 'พาน้องหมาเล่นน้ำสุดสัปดาห์',
    description:
      'กิจกรรมเล่นน้ำสำหรับน้องหมาที่ชอบน้ำ มีเสื้อชูชีพสำรองให้ยืม และมุมพักร่มเงาสำหรับน้อง ๆ ที่ร้อนง่าย',
    rules: 'ฉีดวัคซีนครบ และห้ามพาตัวเมียที่อยู่ในช่วงเป็นสัด',
    status: 'OPEN',
    startDays: 6,
    startHour: 10,
    durationHours: 3,
    maxMembers: 8,
    host: 3,
    members: [2, 4, 5],
    demoUserJoins: false,
    messages: [
      { author: 'system', text: 'วริศรา เพชรงาม สร้างกลุ่มนี้แล้ว', hours: 72 },
      {
        author: 3,
        text: 'ยืนยันสถานที่แล้วนะคะ มีที่จอดรถหน้าสระ ค่าเข้าคนละ 50 บาท',
        hours: 60,
        pinned: true,
      },
      { author: 2, text: 'ขอเสื้อชูชีพไซซ์ L หนึ่งตัวได้ไหมครับ', hours: 36 },
      { author: 4, text: 'ทำไมต้องเสียเวลากับกลุ่มเล็ก ๆ แบบนี้ คนจัดไม่เป็นเลย', hours: 20 },
      { author: 3, text: 'มีไซซ์ L ค่ะ เตรียมไว้ให้แล้ว', hours: 18, replyTo: 3 },
      { author: 5, text: 'ขอบคุณค่ะ ตื่นเต้นมาก น้องบราวนี่ยังไม่เคยเล่นน้ำเลย', hours: 3 },
    ],
  },
  {
    title: 'เพื่อนสี่ขาพบกัน (จัดไปแล้ว)',
    description: 'กิจกรรมที่จบไปแล้ว เก็บไว้ดูตัวอย่างห้องแชตที่เปิดอ่านอย่างเดียว',
    rules: 'ดูแลน้องของตัวเองตลอดกิจกรรม',
    status: 'COMPLETED',
    startDays: -5,
    startHour: 9,
    durationHours: 2,
    maxMembers: 10,
    host: 4,
    members: [0, 1, 2],
    demoUserJoins: false,
    messages: [
      { author: 'system', text: 'กิตติพงษ์ ศรีสุข สร้างกลุ่มนี้แล้ว', hours: 240 },
      { author: 4, text: 'ขอบคุณทุกคนที่มาร่วมกิจกรรมนะครับ', hours: 112 },
      { author: 0, text: 'สนุกมากครับ ไว้เจอกันรอบหน้า', hours: 111 },
    ],
  },
  {
    title: 'ฝึกคำสั่งพื้นฐานน้องหมากลางสวน',
    description:
      'ชวนมาฝึกคำสั่งพื้นฐาน เช่น นั่ง รอ และมานี่ ในบรรยากาศสบาย ๆ ที่ลานหญ้า เหมาะกับน้องหมาที่เพิ่งเริ่มฝึกและเจ้าของมือใหม่',
    rules: 'พกขนมรางวัลของน้องมาเอง และห้ามให้ขนมน้องตัวอื่นโดยไม่ถามเจ้าของ',
    status: 'OPEN',
    startDays: 3,
    startHour: 16,
    durationHours: 2,
    maxMembers: 8,
    host: 'demoUser',
    members: [3, 5, 'demoUser2'],
    demoUserJoins: false,
    messages: [
      { author: 'system', text: 'สร้างกลุ่มนี้แล้ว', hours: 60 },
      {
        author: 'demoUser',
        text: 'ประกาศ: นัดเจอกันที่ลานหญ้าหน้าอาคารสโมสร 16:00 น. พกขนมรางวัลมาด้วยนะคะ',
        hours: 56,
        pinned: true,
      },
      { author: 'demoUser2', text: 'ขอไปด้วยนะคะ เจ้าทองยังไม่คุ้นกับคำสั่งนั่งรอเลย', hours: 40 },
      { author: 3, text: 'น้องบราวนี่ทำคำสั่งนั่งได้ แต่ยังไม่นิ่งตอนมีคนเดินผ่านค่ะ', hours: 30 },
      {
        author: 'demoUser',
        text: 'ได้เลยค่ะ เดี๋ยวเริ่มจากคำสั่งง่าย ๆ ก่อน',
        hours: 28,
        replyTo: 3,
      },
      { author: 5, text: 'ขอบคุณค่ะ ตื่นเต้นมาก', hours: 8 },
    ],
  },
  {
    title: 'เคล็ดลับดูแลแมวสูงวัย',
    description:
      'แลกเปลี่ยนวิธีดูแลแมวอายุมาก ทั้งอาหาร การตรวจสุขภาพ และการจัดบ้านให้ปลอดภัยสำหรับแมวที่เริ่มเดินช้าลง',
    rules: 'พาแมวมาในกระเป๋าหรือกรงเท่านั้น และงดขนมที่มีรสจัด',
    status: 'OPEN',
    startDays: 5,
    startHour: 13,
    durationHours: 2,
    maxMembers: 8,
    host: 'demoUser2',
    members: [1, 4, 'demoUser'],
    demoUserJoins: false,
    messages: [
      { author: 'system', text: 'สร้างกลุ่มนี้แล้ว', hours: 70 },
      {
        author: 'demoUser2',
        text: 'ร้านสงวนมุมเงียบติดหน้าต่างไว้ให้แล้วค่ะ ใครมีแมวสูงวัยพามาได้เลย',
        hours: 50,
        pinned: true,
      },
      { author: 1, text: 'แมวอายุ 12 ปีของฉันกินน้อยลง ควรปรึกษาหมอไหมคะ', hours: 36 },
      {
        author: 'demoUser',
        text: 'ลองตรวจเลือดดูค่ะ ของเราก็เคยเป็นแบบนี้',
        hours: 34,
        replyTo: 3,
      },
      { author: 'demoUser2', text: 'แนะนำให้พาไปตรวจสุขภาพทุกหกเดือนค่ะ', hours: 33 },
      { author: 4, text: 'ขอบคุณสำหรับข้อมูลครับ', hours: 5 },
    ],
  },
];

interface ReviewSpec {
  author: UserKey;
  place: number;
  rating: number;
  clean: number;
  convenience: number;
  pet: number;
  content: string;
  hours: number;
}

const REVIEWS: ReviewSpec[] = [
  {
    author: 0,
    place: 0,
    rating: 5,
    clean: 5,
    convenience: 4,
    pet: 5,
    hours: 300,
    content: 'พาน้องหมาไปบ่อย พนักงานใจดีและมีชามน้ำให้น้อง สะอาดมาก',
  },
  {
    author: 1,
    place: 0,
    rating: 4,
    clean: 4,
    convenience: 4,
    pet: 5,
    hours: 260,
    content: 'บรรยากาศดี น้องแมวในกระเป๋าไม่ถูกมองแปลก ๆ เลย แต่ช่วงเย็นคนค่อนข้างเยอะ',
  },
  {
    author: 2,
    place: 1,
    rating: 3,
    clean: 3,
    convenience: 3,
    pet: 4,
    hours: 220,
    content: 'ที่จอดรถค่อนข้างน้อย แต่เจ้าของร้านเป็นมิตรกับสัตว์เลี้ยงมาก',
  },
  {
    author: 3,
    place: 1,
    rating: 5,
    clean: 5,
    convenience: 5,
    pet: 5,
    hours: 200,
    content: 'ชอบมากค่ะ มีโซนในร่มแอร์เย็น พาน้องไปนั่งได้สบาย แนะนำเลย',
  },
  {
    author: 4,
    place: 2,
    rating: 4,
    clean: 4,
    convenience: 3,
    pet: 4,
    hours: 170,
    content: 'ทางเดินกว้าง น้องวิ่งเล่นได้ แต่ห้องน้ำไกลไปหน่อย',
  },
  {
    author: 5,
    place: 2,
    rating: 2,
    clean: 2,
    convenience: 3,
    pet: 3,
    hours: 150,
    content: 'วันที่ไปค่อนข้างแออัดและมีขยะเยอะ หวังว่าจะปรับปรุงให้ดีขึ้น',
  },
  {
    author: 0,
    place: 3,
    rating: 5,
    clean: 4,
    convenience: 5,
    pet: 5,
    hours: 120,
    content: 'เดินทางสะดวก ติดรถไฟฟ้า น้องหมาเดินได้ตลอดทาง ประทับใจ',
  },
  {
    author: 1,
    place: 4,
    rating: 4,
    clean: 5,
    convenience: 4,
    pet: 4,
    hours: 100,
    content: 'สะอาดและเงียบสงบ เหมาะกับน้องที่ตื่นตกใจง่าย',
  },
  {
    author: 2,
    place: 5,
    rating: 3,
    clean: 3,
    convenience: 4,
    pet: 3,
    hours: 80,
    content: 'พอใช้ได้ค่ะ ราคาปานกลาง แต่พื้นที่สำหรับสัตว์เลี้ยงยังจำกัด',
  },
  {
    author: 3,
    place: 6,
    rating: 5,
    clean: 5,
    convenience: 5,
    pet: 5,
    hours: 60,
    content: 'ดีที่สุดในย่านนี้เลย มีขนมสำหรับน้อง ๆ แจกด้วย',
  },
  {
    author: 'demoUser',
    place: 0,
    rating: 5,
    clean: 5,
    convenience: 5,
    pet: 5,
    hours: 40,
    content: 'พาน้องแมวไปลองเป็นครั้งแรก ทุกอย่างประทับใจ จะกลับไปอีกแน่นอน',
  },
  {
    author: 'demoUser',
    place: 3,
    rating: 4,
    clean: 4,
    convenience: 5,
    pet: 4,
    hours: 25,
    content: 'เดินทางง่ายและมีมุมพักสำหรับสัตว์เลี้ยง แนะนำค่ะ',
  },
  {
    author: 'demoUser2',
    place: 1,
    rating: 4,
    clean: 4,
    convenience: 4,
    pet: 5,
    hours: 45,
    content: 'พาเจ้าทองไปเดินเล่นช่วงเช้า อากาศดีและมีน้ำให้น้องดื่ม ประทับใจค่ะ',
  },
  {
    author: 'demoUser2',
    place: 4,
    rating: 5,
    clean: 5,
    convenience: 4,
    pet: 5,
    hours: 22,
    content: 'พนักงานเป็นมิตรกับแมวมาก ส้มจี๊ดไม่กลัวเลย จะพามาอีกแน่นอน',
  },
];

export function buildDemoContent(refs: DemoRefs): DemoContent {
  const { now, places, provinceId, categoryId, demoUserId, demoUser2Id } = refs;
  if (places.length === 0) throw new Error('DEMO_NO_PLACES');
  const placeAt = (index: number) => places[index % places.length]!;
  const userId = (index: number) => demoId('user', index + 1);
  const authorId = (author: UserKey): string | null =>
    author === 'demoUser' ? demoUserId : author === 'demoUser2' ? demoUser2Id : userId(author);

  const users: Prisma.UserCreateManyInput[] = PERSONAS.map((name, index) => ({
    id: userId(index),
    name,
    email: `member-${index + 1}@${DEMO_EMAIL_DOMAIN}`,
    emailVerified: true,
    createdAt: hoursAgo(now, 24 * 40),
  }));

  let petCount = 0;
  const pets: Prisma.PetCreateManyInput[] = MEMBER_PETS.flatMap((owned, index) =>
    owned.map((input) => {
      petCount += 1;
      return petRow(userId(index), demoId('pet', petCount), input);
    }),
  );

  const meetups: Prisma.MeetupCreateManyInput[] = [];
  const members: Prisma.MeetupMemberCreateManyInput[] = [];
  const messages: Prisma.MeetupMessageCreateManyInput[] = [];
  const images: DemoContent['images'] = [];
  let memberCount = 0;
  let messageCount = 0;
  /** Ids of the messages really emitted, so a reply never points at one that was left out. */
  const emittedMessages = new Set<string>();

  const joinedAtOf = (spec: MeetupSpec) => hoursAgo(now, (spec.messages[0]?.hours ?? 24) - 1);
  /** Who wrote messages in which Meetup, so every author can be made a member afterwards. */
  const messageAuthors: { meetupId: string; userId: string; joinedAt: Date }[] = [];
  const addMember = (meetupId: string, userKey: UserKey, joinedAt: Date) => {
    // A number is used up for every candidate, present or not, so ids do not shift once an account appears.
    memberCount += 1;
    const memberUserId = authorId(userKey);
    if (!memberUserId) return;
    members.push({ id: demoId('member', memberCount), meetupId, userId: memberUserId, joinedAt });
  };

  MEETUPS.forEach((spec, index) => {
    const meetupId = demoId('meetup', index + 1);
    const hostId = authorId(spec.host);
    if (!hostId) {
      // The host is a sign-in account that is not seeded yet: skip the Meetup, keep the numbering.
      memberCount += 1 + spec.members.length + (spec.demoUserJoins ? 1 : 0);
      messageCount += spec.messages.length;
      return;
    }
    const startsAt = bangkokTime(now, spec.startDays, spec.startHour);
    meetups.push({
      id: meetupId,
      title: spec.title,
      description: spec.description,
      rules: spec.rules,
      status: spec.status,
      startsAt,
      endsAt: new Date(startsAt.getTime() + spec.durationHours * 3_600_000),
      maxMembers: spec.maxMembers,
      hostId,
      placeId: placeAt(index).id,
      createdAt: hoursAgo(now, spec.messages[0]?.hours ?? 24),
    });

    const candidates: UserKey[] = [spec.host, ...spec.members];
    if (spec.demoUserJoins) candidates.push('demoUser');
    for (const candidate of candidates) addMember(meetupId, candidate, joinedAtOf(spec));

    const firstMessageNumber = messageCount + 1;
    let pinnedInMeetup = 0;
    spec.messages.forEach((message) => {
      messageCount += 1;
      const createdAt = hoursAgo(now, message.hours);
      const common = { id: demoId('msg', messageCount), meetupId, createdAt, updatedAt: createdAt };
      if (message.author === 'system') {
        messages.push({ ...common, kind: 'SYSTEM', text: message.text, authorId: null });
        emittedMessages.add(common.id);
        return;
      }
      const author = authorId(message.author);
      if (!author) return; // the demo user account does not exist: skip its lines
      messageAuthors.push({ meetupId, userId: author, joinedAt: joinedAtOf(spec) });
      let objectKey: string | undefined;
      if (message.image) {
        objectKey = demoImageKey(message.image);
        images.push({ key: objectKey, color: message.image === 1 ? '#8fbf9f' : '#e3b98a' });
      }
      const pinned = Boolean(message.pinned) && pinnedInMeetup < MAX_PINNED_MESSAGES;
      if (pinned) pinnedInMeetup += 1;
      const replyTarget =
        message.replyTo === undefined
          ? undefined
          : demoId('msg', firstMessageNumber + message.replyTo - 1);
      messages.push({
        ...common,
        kind: message.image ? 'IMAGE' : 'TEXT',
        text: message.text,
        authorId: author,
        objectKey,
        replyToId: replyTarget && emittedMessages.has(replyTarget) ? replyTarget : undefined,
        pinnedAt: pinned ? new Date(createdAt.getTime() + 60_000) : undefined,
      });
      emittedMessages.add(common.id);
    });
  });

  // The second sign-in user also joins the first Meetup, so it holds a conversation with the first user.
  addMember(demoId('meetup', 1), 'demoUser2', joinedAtOf(MEETUPS[0]!));

  // Whoever wrote a message is a member, so their name in the chat opens a profile. These come last, so
  // the ids above never shift and an earlier demo run is repaired by inserting only the missing rows.
  for (const { meetupId, userId: memberUserId, joinedAt } of messageAuthors) {
    if (members.some((row) => row.meetupId === meetupId && row.userId === memberUserId)) continue;
    memberCount += 1;
    members.push({ id: demoId('member', memberCount), meetupId, userId: memberUserId, joinedAt });
  }

  const reviews: Prisma.ReviewCreateManyInput[] = [];
  REVIEWS.forEach((spec, index) => {
    const author = authorId(spec.author);
    if (!author) return;
    const createdAt = hoursAgo(now, spec.hours);
    reviews.push({
      id: demoId('review', index + 1),
      userId: author,
      placeId: placeAt(spec.place).id,
      rating: spec.rating,
      cleanlinessRating: spec.clean,
      convenienceRating: spec.convenience,
      petFriendlinessRating: spec.pet,
      content: spec.content,
      createdAt,
      updatedAt: createdAt,
    });
  });

  const proposal = (name: string, description: string, address: string) => ({
    nameTh: name,
    nameEn: null,
    descriptionTh: description,
    descriptionEn: null,
    addressTh: address,
    latitude: 13.7563,
    longitude: 100.5018,
    phone: null,
    website: null,
    petTypes: ['DOG', 'CAT'],
    indoorAllowed: true,
    outdoorAllowed: true,
    leashRequired: true,
    open24Hours: false,
  });
  const submitter = (fallbackPersona: number) => demoUserId ?? userId(fallbackPersona);
  const submissionBase = { provinceId, categoryId };
  const submissions: Prisma.SubmissionCreateManyInput[] = [
    {
      ...submissionBase,
      id: demoId('sub', 1),
      status: 'DRAFT',
      submitterId: userId(1),
      proposedData: proposal(
        'คาเฟ่ลานหญ้าเจ้าตูบ',
        'คาเฟ่ลานหญ้ากว้าง',
        'ซอยสุขุมวิท 24 กรุงเทพมหานคร',
      ),
      createdAt: hoursAgo(now, 20),
    },
    {
      ...submissionBase,
      id: demoId('sub', 2),
      status: 'PENDING',
      submitterId: userId(2),
      proposedData: proposal(
        'สวนสุนัขริมน้ำ',
        'พื้นที่วิ่งเล่นสำหรับสุนัขริมแม่น้ำ มีน้ำดื่มและร่มเงา',
        'ถนนพระราม 3 กรุงเทพมหานคร',
      ),
      submittedAt: hoursAgo(now, 30),
      createdAt: hoursAgo(now, 32),
    },
    {
      ...submissionBase,
      id: demoId('sub', 3),
      status: 'PENDING',
      submitterId: submitter(3),
      proposedData: proposal(
        'ร้านอาหารสวนหลังบ้าน',
        'ร้านอาหารมีโซนกลางแจ้งให้นั่งกับสัตว์เลี้ยง',
        'ซอยอารีย์ กรุงเทพมหานคร',
      ),
      submittedAt: hoursAgo(now, 54),
      createdAt: hoursAgo(now, 56),
    },
    {
      ...submissionBase,
      id: demoId('sub', 4),
      status: 'NEEDS_REVISION',
      submitterId: submitter(4),
      proposedData: proposal(
        'โรงแรมแมวนอนสบาย',
        'ที่พักสำหรับแมวพร้อมห้องแยกเดี่ยว',
        'ซอยลาดพร้าว 71 กรุงเทพมหานคร',
      ),
      adminMessage: 'กรุณาเพิ่มรูปหน้าร้านและระบุราคาโดยประมาณ ก่อนส่งให้ตรวจอีกครั้ง',
      submittedAt: hoursAgo(now, 100),
      createdAt: hoursAgo(now, 102),
      updatedAt: hoursAgo(now, 70),
    },
    {
      ...submissionBase,
      id: demoId('sub', 5),
      status: 'REJECTED',
      submitterId: submitter(5),
      proposedData: proposal('จุดนัดพบริมถนน', 'จุดแวะพักข้างถนนใหญ่', 'ถนนเพชรเกษม กรุงเทพมหานคร'),
      adminMessage: 'สถานที่นี้ไม่เหมาะกับการนำสัตว์เลี้ยงเข้าพื้นที่เนื่องจากติดถนนใหญ่',
      submittedAt: hoursAgo(now, 200),
      decidedAt: hoursAgo(now, 150),
      createdAt: hoursAgo(now, 202),
      updatedAt: hoursAgo(now, 150),
    },
  ];

  const notifications: Prisma.NotificationCreateManyInput[] = [];
  if (demoUserId) {
    const note = (
      n: number,
      hours: number,
      data: Omit<Prisma.NotificationCreateManyInput, 'id' | 'userId' | 'createdAt'>,
    ) =>
      notifications.push({
        id: demoId('notif', n),
        userId: demoUserId,
        createdAt: hoursAgo(now, hours),
        ...data,
      });
    note(1, 70, {
      type: 'SUBMISSION_NEEDS_REVISION',
      titleTh: 'ข้อมูลที่ส่งต้องแก้ไข',
      titleEn: 'Changes requested',
      bodyTh: 'ผู้ดูแลขอให้เพิ่มรูปหน้าร้านและราคาโดยประมาณ',
      bodyEn: 'An admin asked for a storefront photo and a rough price.',
      link: `/my-submissions/${demoId('sub', 4)}`,
    });
    note(2, 150, {
      type: 'SUBMISSION_REJECTED',
      titleTh: 'ข้อมูลไม่ผ่านการอนุมัติ',
      titleEn: 'Submission rejected',
      bodyTh: 'สถานที่นี้ไม่เหมาะกับการนำสัตว์เลี้ยงเข้าพื้นที่',
      bodyEn: 'This place is not suitable for pets.',
      link: `/my-submissions/${demoId('sub', 5)}`,
    });
    note(3, 49, {
      type: 'MEETUP',
      titleTh: 'คำขอเข้าร่วมได้รับอนุมัติ',
      titleEn: 'Meetup request approved',
      bodyTh: 'คุณสามารถเข้าแชตกลุ่มได้แล้ว',
      bodyEn: 'You can now join the group chat.',
      link: `/meetups/${demoId('meetup', 1)}`,
    });
    note(4, 2, {
      type: 'MEETUP',
      titleTh: 'ข้อความใหม่ในแชต Meetup',
      titleEn: 'New Meetup chat message',
      bodyTh: 'กิตติพงษ์ ศรีสุข ส่งข้อความใหม่',
      bodyEn: 'กิตติพงษ์ ศรีสุข sent a new message',
      link: `/meetups/${demoId('meetup', 1)}/chat`,
      metadata: { kind: 'MEETUP_CHAT', meetupId: demoId('meetup', 1) },
    });
    note(5, 24, {
      type: 'FAVORITE_UPDATED',
      titleTh: 'สถานที่โปรดมีการอัปเดต',
      titleEn: 'A favorite place was updated',
      bodyTh: 'มีรีวิวใหม่ในสถานที่ที่คุณบันทึกไว้',
      bodyEn: 'There is a new review at a place you saved.',
    });
    note(6, 1, {
      type: 'SYSTEM',
      titleTh: 'ยินดีต้อนรับสู่ PetHub',
      titleEn: 'Welcome to PetHub',
      bodyTh: 'นี่คือข้อมูลตัวอย่างสำหรับการสาธิต',
      bodyEn: 'This is sample data for the demo.',
    });
  }

  if (demoUser2Id) {
    const note = (
      n: number,
      hours: number,
      data: Omit<Prisma.NotificationCreateManyInput, 'id' | 'userId' | 'createdAt'>,
    ) =>
      notifications.push({
        id: demoId('notif', n),
        userId: demoUser2Id,
        createdAt: hoursAgo(now, hours),
        ...data,
      });
    note(7, 48, {
      type: 'MEETUP',
      titleTh: 'คำขอเข้าร่วมได้รับอนุมัติ',
      titleEn: 'Meetup request approved',
      bodyTh: 'คุณสามารถเข้าแชตกลุ่มได้แล้ว',
      bodyEn: 'You can now join the group chat.',
      link: `/meetups/${demoId('meetup', 5)}`,
    });
    note(8, 3, {
      type: 'MEETUP',
      titleTh: 'ข้อความใหม่ในแชต Meetup',
      titleEn: 'New Meetup chat message',
      bodyTh: 'ผู้จัดกลุ่มส่งข้อความใหม่',
      bodyEn: 'The host sent a new message',
      link: `/meetups/${demoId('meetup', 5)}/chat`,
      metadata: { kind: 'MEETUP_CHAT', meetupId: demoId('meetup', 5) },
    });
    note(9, 1, {
      type: 'SYSTEM',
      titleTh: 'ยินดีต้อนรับสู่ PetHub',
      titleEn: 'Welcome to PetHub',
      bodyTh: 'นี่คือข้อมูลตัวอย่างสำหรับการสาธิต',
      bodyEn: 'This is sample data for the demo.',
    });
  }

  const reportAt = (hours: number) => hoursAgo(now, hours);
  const spamMessage = messages.find((m) => m.text?.startsWith('ลดราคาพิเศษ'));
  const rudeMessage = messages.find((m) => m.text?.startsWith('ทำไมต้องเสียเวลา'));
  const reporter = (n: number) =>
    demoUserId && n % 3 === 0 ? demoUserId : userId(n % PERSONAS.length);
  const meetupReports: Prisma.MeetupReportCreateManyInput[] = [];
  const addMeetupReport = (
    target: 'MEETUP' | 'USER' | 'MESSAGE' | 'IMAGE',
    meetupIndex: number,
    targetId: string | undefined,
    reason: Prisma.MeetupReportCreateManyInput['reason'],
    details: string,
    hours: number,
  ) => {
    if (!targetId) return;
    meetupReports.push({
      id: demoId('mreport', meetupReports.length + 1),
      meetupId: demoId('meetup', meetupIndex),
      reporterId: reporter(meetupReports.length + 1),
      target,
      targetId,
      reason,
      details,
      createdAt: reportAt(hours),
    });
  };
  addMeetupReport(
    'MEETUP',
    3,
    demoId('meetup', 3),
    'FAKE_MEETUP',
    'รายละเอียดสถานที่ไม่ตรงกับที่โฆษณาไว้',
    40,
  );
  addMeetupReport(
    'MEETUP',
    2,
    demoId('meetup', 2),
    'SCAM',
    'มีการชวนให้โอนเงินล่วงหน้านอกระบบ',
    28,
  );
  addMeetupReport('USER', 3, userId(4), 'HARASSMENT', 'ใช้ถ้อยคำไม่สุภาพกับผู้จัดกิจกรรม', 18);
  addMeetupReport('USER', 2, userId(5), 'SPAM', 'โพสต์โฆษณาซ้ำ ๆ ในกลุ่ม', 15);
  addMeetupReport('MESSAGE', 2, spamMessage?.id, 'SPAM', 'ข้อความโฆษณาขายสินค้าในแชตกลุ่ม', 12);
  addMeetupReport('MESSAGE', 3, rudeMessage?.id, 'HARASSMENT', 'ข้อความดูถูกผู้จัดกิจกรรม', 9);
  addMeetupReport('IMAGE', 1, demoImageKey(1), 'INAPPROPRIATE_CONTENT', 'ขอให้ตรวจสอบรูปนี้', 6);
  addMeetupReport('IMAGE', 1, demoImageKey(2), 'OTHER', 'รูปไม่เกี่ยวกับกิจกรรม', 4);

  const placeReports: Prisma.ReportCreateManyInput[] = [
    {
      id: demoId('report', 1),
      reason: 'PERMANENTLY_CLOSED',
      details: 'ผ่านไปเมื่อสัปดาห์ก่อน ร้านปิดและมีป้ายเซ้งหน้าร้านแล้ว',
      reporterId: userId(2),
      placeId: placeAt(1).id,
      createdAt: reportAt(52),
    },
    {
      id: demoId('report', 2),
      reason: 'INCORRECT_INFORMATION',
      details: 'เบอร์โทรศัพท์ในหน้านี้ไม่ใช่เบอร์ของร้านแล้ว โทรไปติดต่อไม่ได้',
      reporterId: userId(3),
      placeId: placeAt(2).id,
      createdAt: reportAt(26),
    },
  ];

  return {
    users,
    pets,
    meetups,
    members,
    messages,
    reviews,
    submissions,
    notifications,
    meetupReports,
    placeReports,
    images: images.filter(
      (image, index, all) => all.findIndex((x) => x.key === image.key) === index,
    ),
  };
}
