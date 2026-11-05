'use server';

import { revalidatePath } from 'next/cache';
import type { ActionResult } from '@/lib/action-result';
import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { firstFieldErrors } from '@/lib/validation';
import { careSchema, petSchema, recordSchema } from './pet-schema';
import { addOwnedRecord, archiveOwnedPet, saveOwnedPet, setOwnedCare } from './service';

function refreshPets() {
  revalidatePath('/pets');
  revalidatePath('/en/pets');
}

export async function savePet(
  input: unknown,
  id?: string,
  locale: Locale = 'th',
): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser(locale);
  const parsed = petSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  try {
    const petId = await saveOwnedPet(session.user.id, parsed.data, id);
    if (!petId) return { ok: false, formError: 'ไม่พบโปรไฟล์สัตว์เลี้ยง / Pet profile not found' };
    refreshPets();
    return { ok: true, data: { id: petId } };
  } catch {
    return {
      ok: false,
      formError: 'บันทึกไม่สำเร็จ กรุณาลองใหม่ / Could not save. Please try again.',
    };
  }
}

export async function setPetArchived(
  id: string,
  archived: boolean,
  locale: Locale = 'th',
): Promise<ActionResult> {
  const session = await requireUser(locale);
  if (typeof id !== 'string' || !id || typeof archived !== 'boolean')
    return { ok: false, formError: 'ข้อมูลไม่ถูกต้อง / Invalid input' };
  try {
    if (!(await archiveOwnedPet(session.user.id, id, archived)))
      return { ok: false, formError: 'ไม่พบโปรไฟล์สัตว์เลี้ยง / Pet profile not found' };
    refreshPets();
    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      formError: 'บันทึกไม่สำเร็จ กรุณาลองใหม่ / Could not save. Please try again.',
    };
  }
}

export async function addHealthRecord(
  input: unknown,
  locale: Locale = 'th',
): Promise<ActionResult<{ id: string }>> {
  const session = await requireUser(locale);
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  try {
    const id = await addOwnedRecord(session.user.id, parsed.data);
    if (!id) return { ok: false, formError: 'ไม่พบโปรไฟล์สัตว์เลี้ยง / Pet profile not found' };
    refreshPets();
    return { ok: true, data: { id } };
  } catch {
    return {
      ok: false,
      formError: 'บันทึกไม่สำเร็จ กรุณาลองใหม่ / Could not save. Please try again.',
    };
  }
}

export async function togglePetCare(input: unknown, locale: Locale = 'th'): Promise<ActionResult> {
  const session = await requireUser(locale);
  const parsed = careSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  try {
    if (!(await setOwnedCare(session.user.id, parsed.data)))
      return { ok: false, formError: 'ไม่พบโปรไฟล์สัตว์เลี้ยง / Pet profile not found' };
    refreshPets();
    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      formError: 'บันทึกไม่สำเร็จ กรุณาลองใหม่ / Could not save. Please try again.',
    };
  }
}
