'use client';

import { Camera, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent } from 'react';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n';

export function AvatarUpload({
  image,
  name,
  locale,
}: {
  image: string | null;
  name: string;
  locale: Locale;
}) {
  const th = locale === 'th';
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(image);
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function save(file?: File) {
    setError('');
    setSaved('');
    if (file && file.size > 5 * 1024 * 1024) {
      setError(th ? 'รูปต้องมีขนาดไม่เกิน 5 MB' : 'Image must be 5 MB or smaller.');
      return;
    }
    setPending(true);
    const objectUrl = file ? URL.createObjectURL(file) : null;
    setPreview(objectUrl);
    try {
      const body = new FormData();
      if (file) body.set('file', file);
      const response = await fetch('/api/profile/avatar', {
        method: file ? 'POST' : 'DELETE',
        ...(file ? { body } : {}),
      });
      const data = (await response.json()) as { image?: string | null; error?: string };
      if (!response.ok) {
        const message =
          data.error === 'INVALID_IMAGE'
            ? th
              ? 'กรุณาใช้รูป JPG, PNG หรือ WebP ที่เปิดได้'
              : 'Choose a valid JPG, PNG or WebP image.'
            : data.error === 'RATE_LIMIT'
              ? th
                ? 'เปลี่ยนรูปบ่อยเกินไป กรุณาลองใหม่ภายหลัง'
                : 'Too many uploads. Please try again later.'
              : data.error === 'FILE_TOO_LARGE'
                ? th
                  ? 'รูปต้องมีขนาดไม่เกิน 5 MB'
                  : 'Image must be 5 MB or smaller.'
                : th
                  ? 'บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง'
                  : 'Could not save your picture. Please retry.';
        throw new Error(message);
      }
      setCurrent(data.image ?? null);
      setSaved(
        file
          ? th
            ? 'บันทึกรูปโปรไฟล์แล้ว'
            : 'Profile picture saved.'
          : th
            ? 'ลบรูปโปรไฟล์แล้ว'
            : 'Profile picture removed.',
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : th
            ? 'บันทึกรูปไม่สำเร็จ'
            : 'Could not save your picture.',
      );
    } finally {
      setPreview(null);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (input.current) input.current.value = '';
      setPending(false);
    }
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    event.stopPropagation();
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file) void save(file);
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <UserAvatar src={preview ?? current} name={name} className="size-20" />
        <div className="min-w-0 flex-1 basis-48">
          <p className="font-bold">{th ? 'รูปโปรไฟล์' : 'Profile picture'}</p>
          <p id="avatar-help" className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
            {th
              ? 'JPG, PNG หรือ WebP ไม่เกิน 5 MB · รูปจะแสดงข้างข้อความในแชต'
              : 'JPG, PNG or WebP up to 5 MB. Shown beside your chat messages.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => input.current?.click()}
            >
              <Camera size={16} aria-hidden="true" />
              {pending
                ? th
                  ? 'กำลังบันทึก…'
                  : 'Saving…'
                : current
                  ? th
                    ? 'เปลี่ยนรูป'
                    : 'Change picture'
                  : th
                    ? 'เพิ่มรูปโปรไฟล์'
                    : 'Add profile picture'}
            </Button>
            {current && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => void save()}
              >
                <Trash2 size={15} aria-hidden="true" />
                {th ? 'ลบรูป' : 'Remove picture'}
              </Button>
            )}
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={th ? 'เลือกรูปโปรไฟล์' : 'Choose profile picture'}
            aria-describedby="avatar-help"
            className="sr-only"
            tabIndex={-1}
            disabled={pending}
            onChange={choose}
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm text-[var(--terracotta)]">
          {error}
        </p>
      )}
      <p role="status" className="mt-2 text-sm text-[var(--forest)]">
        {saved}
      </p>
    </div>
  );
}
