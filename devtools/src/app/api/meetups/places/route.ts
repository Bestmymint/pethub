import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { publicPlaceWhere } from '@/lib/place-repository';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim().slice(0, 100) ?? '';
  const places = await prisma.place.findMany({
    where: publicPlaceWhere({ query: q }),
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      addressTh: true,
      latitude: true,
      longitude: true,
      province: { select: { nameTh: true, nameEn: true } },
      category: { select: { nameTh: true, nameEn: true } },
      images: { where: { isCover: true }, select: { objectKey: true }, take: 1 },
    },
    orderBy: [{ nameTh: 'asc' }, { id: 'asc' }],
    take: 20,
  });
  return NextResponse.json(
    { items: places },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
