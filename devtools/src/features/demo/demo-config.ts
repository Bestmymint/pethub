/**
 * Shared rules of the admin demo-data tools. Pure, so the server action, the page and the tests agree.
 *
 * Every row the tools create has an id that starts with `demo_`, which is how "delete" finds exactly
 * those rows and nothing else. Real ids are random strings that never look like that.
 */

export type DemoKind =
  | 'user'
  | 'meetup'
  | 'member'
  | 'msg'
  | 'review'
  | 'sub'
  | 'notif'
  | 'mreport'
  | 'report';

export const DEMO_PREFIX = 'demo_';

/** E-mail domain of the made-up members. It is reserved (`.invalid`), so nothing can ever be sent to it. */
export const DEMO_EMAIL_DOMAIN = 'demo.pawmap.invalid';

export function demoId(kind: DemoKind, n: number) {
  return `${DEMO_PREFIX}${kind}_${n}`;
}

export function demoIdPrefix(kind: DemoKind) {
  return `${DEMO_PREFIX}${kind}_`;
}

export function isDemoId(id: string) {
  return id.startsWith(DEMO_PREFIX);
}

/** Object-storage key of a demo chat photo. It fits the media route's key pattern (hex and dashes). */
export function demoImageKey(n: number) {
  return `meetup_de0de000-0000-4000-8000-${String(n).padStart(12, '0')}.png`;
}

/** The tools are on only when DEMO_TOOLS_ENABLED is exactly "true" (set in compose.demo.yml only). */
export function demoToolsEnabled(env: Record<string, string | undefined> = process.env) {
  return env.DEMO_TOOLS_ENABLED === 'true';
}

export const DEMO_AUDIT = {
  create: 'DEMO_DATA_CREATE',
  delete: 'DEMO_DATA_DELETE',
  entityType: 'DemoData',
  entityId: 'demo',
} as const;

export interface DemoCounts {
  users: number;
  meetups: number;
  members: number;
  messages: number;
  reviews: number;
  submissions: number;
  notifications: number;
  meetupReports: number;
  placeReports: number;
}

export const emptyDemoCounts = (): DemoCounts => ({
  users: 0,
  meetups: 0,
  members: 0,
  messages: 0,
  reviews: 0,
  submissions: 0,
  notifications: 0,
  meetupReports: 0,
  placeReports: 0,
});

const countLabels: Array<[keyof DemoCounts, string]> = [
  ['users', 'สมาชิก'],
  ['meetups', 'Meetup'],
  ['members', 'ผู้เข้าร่วม'],
  ['messages', 'ข้อความแชต'],
  ['reviews', 'รีวิว'],
  ['submissions', 'รายการที่ส่ง'],
  ['notifications', 'การแจ้งเตือน'],
  ['meetupReports', 'รายงาน Meetup'],
  ['placeReports', 'รายงานสถานที่'],
];

/** Toast text such as "Meetup 4 · รีวิว 12". Kinds with no rows are left out; nothing at all gets its own sentence. */
export function formatDemoCounts(counts: DemoCounts, verb: 'created' | 'deleted') {
  const parts = countLabels
    .filter(([key]) => counts[key] > 0)
    .map(([key, label]) => `${label} ${counts[key].toLocaleString('th-TH')}`);
  if (parts.length === 0)
    return verb === 'created'
      ? 'มีข้อมูลตัวอย่างครบอยู่แล้ว ไม่ได้สร้างเพิ่ม'
      : 'ไม่มีข้อมูลตัวอย่างให้ลบ';
  return `${verb === 'created' ? 'สร้างข้อมูลตัวอย่างแล้ว' : 'ลบข้อมูลตัวอย่างแล้ว'}: ${parts.join(' · ')}`;
}

/** A moment `days` days from now (negative: in the past) at `hour` o'clock Bangkok time. */
export function bangkokTime(now: Date, days: number, hour: number, minute = 0) {
  const local = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + days,
      hour - 7,
      minute,
    ),
  );
}

/** A moment `hours` hours before `now` (used to spread chat messages and reviews over the past days). */
export function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 3_600_000);
}
