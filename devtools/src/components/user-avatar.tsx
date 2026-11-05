'use client';

import Image from 'next/image';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function UserAvatar({
  src,
  name,
  className,
  decorative = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={cn(
        'relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--sage)] text-[var(--forest)]',
        className,
      )}
    >
      {src && failed !== src ? (
        <Image
          unoptimized
          src={src}
          alt={decorative ? '' : name}
          fill
          sizes="80px"
          className="object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <UserRound className="h-1/2 w-1/2" aria-hidden="true" />
      )}
    </span>
  );
}
