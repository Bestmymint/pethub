import type { Prisma } from '@prisma/client';

import { petSchema, type PetInput } from '@/features/pets/pet-schema';

/**
 * Pets of the demo accounts and of the made-up demo members. Pure data plus one builder that runs
 * every pet through the app's own `petSchema`, so a sample pet can never break the rules a pet
 * entered in the form has to follow. There is no pet photo feature (the pages show a stock picture
 * by species), so there are no photos here.
 */

export type DemoAccountKey = 'admin' | 'user' | 'user2';

/** Ids of the pets of the three sign-in accounts. They are part of the seed and never deleted by the demo tools. */
export const SEED_PET_PREFIX = 'seed_pet_';

/** Fixed per owner and position, so a re-run finds the same row, and two different users never share an id. */
export function seedPetId(ownerId: string, n: number) {
  return `${SEED_PET_PREFIX}${ownerId}_${n}`;
}

const pet = (
  name: string,
  species: 'dog' | 'cat' | 'other',
  breed: string,
  sex: 'male' | 'female' | 'unknown',
  birthday: string,
  weight: number | null,
  color: 'peach' | 'sage' | 'lavender',
  notes: string,
): PetInput => ({ name, species, breed, sex, birthday, weight, color, notes });

export const ACCOUNT_PETS: Record<DemoAccountKey, PetInput[]> = {
  admin: [
    pet(
      'ข้าวต้ม',
      'dog',
      'ชิบะ อินุ',
      'male',
      '2021-06-12',
      9.5,
      'peach',
      'ชอบวิ่งเล่นที่สวน แพ้ไก่เล็กน้อย',
    ),
    pet(
      'นมสด',
      'cat',
      'วิเชียรมาศ',
      'female',
      '2022-02-20',
      3.8,
      'sage',
      'ขี้อ้อน ชอบนอนตักเจ้าของ',
    ),
  ],
  user: [
    pet(
      'ถั่วแระ',
      'dog',
      'โกลเด้น รีทรีฟเวอร์',
      'male',
      '2020-09-05',
      28,
      'peach',
      'ใจดี เข้ากับน้องหมาตัวอื่นได้ดี ว่ายน้ำเก่ง',
    ),
    pet(
      'มะลิ',
      'cat',
      'เปอร์เซีย',
      'female',
      '2023-01-10',
      3.2,
      'lavender',
      'ขนยาว ต้องหวีขนทุกวัน',
    ),
    pet(
      'กุ๊กไก่',
      'other',
      'กระต่ายฮอลแลนด์ ลอป',
      'unknown',
      '2023-08-01',
      1.6,
      'sage',
      'กินหญ้าแห้งและผักสด ไม่ชอบเสียงดัง',
    ),
  ],
  user2: [
    pet(
      'เจ้าทอง',
      'dog',
      'ไทยหลังอาน',
      'male',
      '2019-11-30',
      24,
      'sage',
      'ขี้ระวัง รักเจ้าของมาก ต้องพาเดินทุกเช้า',
    ),
    pet(
      'ส้มจี๊ด',
      'cat',
      'สก็อตติช โฟลด์',
      'female',
      '2022-07-18',
      4.1,
      'peach',
      'ชอบเล่นของเล่นแบบแท่งไม้ตกแมว',
    ),
  ],
};

/** Pets of the six made-up members, by member index (0 to 5). They carry the demo_ marker and go with "delete". */
export const MEMBER_PETS: PetInput[][] = [
  [
    pet(
      'ข้าวปั้น',
      'dog',
      'โกลเด้น รีทรีฟเวอร์',
      'female',
      '2022-04-02',
      26,
      'peach',
      'ขี้เล่น วัคซีนครบ',
    ),
  ],
  [
    pet(
      'ถั่วดำ',
      'dog',
      'ชิสุห์',
      'male',
      '2021-12-11',
      7.4,
      'lavender',
      'ตื่นเต้นง่ายเมื่อเจอสุนัขตัวใหญ่',
    ),
    pet(
      'ขนุน',
      'cat',
      'เหมียวไทยพื้นเมือง',
      'male',
      '2020-05-25',
      4.4,
      'peach',
      'เก็บมาจากวัด ชอบนอนหน้าต่าง',
    ),
  ],
  [
    pet(
      'บราวนี่',
      'dog',
      'ลาบราดอร์',
      'female',
      '2023-03-15',
      21,
      'sage',
      'ยังไม่เคยเล่นน้ำ อยากลองมาก',
    ),
  ],
  [
    pet(
      'ไข่มุก',
      'cat',
      'บริติช ช็อตแฮร์',
      'female',
      '2021-10-09',
      4.9,
      'lavender',
      'ตื่นกลัวเสียงดัง ต้องใช้กรงผ้าคลุม',
    ),
  ],
  [pet('ส้ม', 'cat', 'ส้มไทย', 'male', '2022-09-01', 5.2, 'peach', 'ชอบตามเจ้าของไปทุกที่ในบ้าน')],
  [
    pet(
      'ลูกชิ้น',
      'dog',
      'ปอมเมอเรเนียน',
      'male',
      '2022-01-28',
      3.1,
      'peach',
      'ตัวเล็ก เสียงดัง รักเจ้าของ',
    ),
    pet(
      'ปุยฝ้าย',
      'other',
      'หนูแฮมสเตอร์',
      'female',
      '2024-02-14',
      0.1,
      'sage',
      'กลางคืนชอบวิ่งวงล้อ',
    ),
  ],
];

/** Validates a sample pet with the form's schema and turns it into a database row. */
export function petRow(ownerId: string, id: string, input: PetInput): Prisma.PetCreateManyInput {
  const parsed = petSchema.parse(input);
  return {
    id,
    ownerId,
    name: parsed.name,
    species: parsed.species,
    breed: parsed.breed,
    sex: parsed.sex,
    birthday: parsed.birthday ? new Date(`${parsed.birthday}T00:00:00.000Z`) : null,
    weight: parsed.weight,
    color: parsed.color,
    notes: parsed.notes,
  };
}
