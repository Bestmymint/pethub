import { requireUser } from '@/lib/auth-guards';
import type { Locale } from '@/lib/i18n';
import { listPets } from './service';
import { PetsWorkspace } from './pets-workspace';

export async function PetsPage({ locale }: { locale: Locale }) {
  const session = await requireUser(locale, locale === 'th' ? '/pets' : '/en/pets');
  const pets = await listPets(session.user.id);
  return <PetsWorkspace locale={locale} pets={pets} name={session.user.name} />;
}
