import 'server-only';
import { prisma } from '@/lib/prisma';
import {
  bangkokToday,
  careSchema,
  petSchema,
  recordSchema,
  type PetSummary,
  type PetValues,
  type RecordValues,
} from './pet-schema';

export async function listPets(ownerId: string): Promise<PetSummary[]> {
  const pets = await prisma.pet.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      records: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }] },
      careLogs: { where: { date: new Date(`${bangkokToday()}T00:00:00.000Z`) } },
    },
  });
  return pets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    birthday: pet.birthday?.toISOString().slice(0, 10) ?? '',
    weight: pet.weight,
    color: pet.color,
    notes: pet.notes,
    archived: Boolean(pet.archivedAt),
    records: pet.records.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      note: r.note,
      value: r.value,
      date: r.date.toISOString().slice(0, 10),
      dueDate: r.dueDate?.toISOString().slice(0, 10) ?? '',
    })),
    careToday: pet.careLogs.map((log) => log.task),
  }));
}

export async function addOwnedRecord(ownerId: string, input: RecordValues) {
  const data = recordSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const owned = await tx.pet.updateMany({
      where: { id: data.petId, ownerId, archivedAt: null },
      data: { updatedAt: new Date() },
    });
    if (!owned.count) return null;
    const record = await tx.petHealthRecord.create({
      data: {
        ...data,
        date: new Date(`${data.date}T00:00:00.000Z`),
        dueDate: data.dueDate ? new Date(`${data.dueDate}T00:00:00.000Z`) : null,
      },
    });
    if (data.category === 'weight') {
      const latest = await tx.petHealthRecord.findFirstOrThrow({
        where: { petId: data.petId, category: 'weight' },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      await tx.pet.update({ where: { id: data.petId }, data: { weight: latest.value } });
    }
    return record.id;
  });
}

export async function setOwnedCare(ownerId: string, input: unknown) {
  const data = careSchema.parse(input);
  const date = new Date(`${bangkokToday()}T00:00:00.000Z`);
  return prisma.$transaction(async (tx) => {
    if (!(await tx.pet.findFirst({ where: { id: data.petId, ownerId, archivedAt: null } })))
      return false;
    if (data.done)
      await tx.petCareLog.upsert({
        where: { petId_task_date: { petId: data.petId, task: data.task, date } },
        create: { petId: data.petId, task: data.task, date },
        update: {},
      });
    else await tx.petCareLog.deleteMany({ where: { petId: data.petId, task: data.task, date } });
    return true;
  });
}

export async function saveOwnedPet(ownerId: string, input: PetValues, id?: string) {
  const parsed = petSchema.parse(input);
  const data = {
    ...parsed,
    birthday: parsed.birthday ? new Date(`${parsed.birthday}T00:00:00.000Z`) : null,
  };
  if (id) {
    const result = await prisma.pet.updateMany({ where: { id, ownerId, archivedAt: null }, data });
    return result.count ? id : null;
  }
  return (await prisma.pet.create({ data: { ...data, ownerId } })).id;
}

export async function archiveOwnedPet(ownerId: string, id: string, archived: boolean) {
  const result = await prisma.pet.updateMany({
    where: { id, ownerId },
    data: { archivedAt: archived ? new Date() : null },
  });
  return result.count > 0;
}
