import { z } from 'zod';
import { plainText } from '@/lib/validation';

export function bangkokToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01'
  );
}

function validBirthday(value: string) {
  if (!value) return true;
  return validDate(value) && value <= bangkokToday();
}

export const petSchema = z.object({
  name: plainText(1, 40),
  species: z.enum(['dog', 'cat', 'other']),
  breed: plainText(0, 80).default(''),
  sex: z.enum(['male', 'female', 'unknown']).default('unknown'),
  birthday: z
    .string()
    .refine(
      validBirthday,
      'กรุณาระบุวันเกิดที่ถูกต้องและไม่อยู่ในอนาคต / Enter a valid birth date that is not in the future',
    )
    .default(''),
  weight: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : value),
    z.coerce.number().finite().gt(0).max(200).nullable(),
  ),
  color: z.enum(['peach', 'sage', 'lavender']).default('peach'),
  notes: plainText(0, 1000).default(''),
});

export type PetInput = z.input<typeof petSchema>;
export type PetValues = z.output<typeof petSchema>;

export type PetSummary = {
  id: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birthday: string;
  weight: number | null;
  color: string;
  notes: string;
  archived: boolean;
  records: HealthRecordSummary[];
  careToday: string[];
};

export const recordSchema = z
  .object({
    petId: z.string().min(1),
    category: z.enum(['checkup', 'vaccine', 'weight', 'note']),
    title: plainText(1, 100),
    note: plainText(0, 2000).default(''),
    value: z.preprocess(
      (v) => (v === '' || v === undefined || v === null ? null : v),
      z.coerce.number().finite().gt(0).max(200).nullable(),
    ),
    date: z
      .string()
      .refine(
        (v) => validDate(v) && v <= bangkokToday(),
        'วันที่บันทึกไม่ถูกต้อง / Invalid record date',
      ),
    dueDate: z
      .string()
      .refine((v) => !v || validDate(v), 'วันติดตามไม่ถูกต้อง / Invalid follow-up date')
      .default(''),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'weight' && data.value === null)
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'กรุณาระบุน้ำหนัก / Enter a weight',
      });
    if (data.dueDate && data.dueDate < data.date)
      ctx.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'วันติดตามต้องไม่ก่อนวันบันทึก / Follow-up must not precede the record',
      });
  });

export type RecordValues = z.output<typeof recordSchema>;
export type HealthRecordSummary = {
  id: string;
  category: string;
  title: string;
  note: string;
  value: number | null;
  date: string;
  dueDate: string;
};

export const careTasks = [
  { id: 'breakfast', time: '08:00', th: 'มื้อเช้าและน้ำสะอาด', en: 'Breakfast & fresh water' },
  { id: 'play', time: '17:00', th: 'เดินเล่น / เล่นด้วยกัน', en: 'Walk & play together' },
  { id: 'dinner', time: '18:30', th: 'มื้อเย็นและพักผ่อน', en: 'Dinner & rest' },
] as const;

export const careSchema = z.object({
  petId: z.string().min(1),
  task: z.enum(['breakfast', 'play', 'dinner']),
  done: z.boolean(),
});
