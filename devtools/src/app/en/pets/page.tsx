import { PetsPage } from '@/features/pets/pets-page';

export const metadata = { title: 'My pets' };
export default function Page() {
  return <PetsPage locale="en" />;
}
