import { CheckCircle2, CircleAlert, CircleX, Info } from 'lucide-react';

import type { Locale } from '@/lib/i18n';
import { severityLabel, type NotificationSeverity } from '@/lib/notification-severity';

const icons = {
  success: CheckCircle2,
  attention: CircleAlert,
  negative: CircleX,
  info: Info,
} as const;

/** Existing design tokens only, each defined for the light and dark themes. */
const tones: Record<NotificationSeverity, string> = {
  success: 'bg-[var(--sage)] text-[var(--forest)]',
  attention: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  negative: 'bg-[var(--terracotta-soft)] text-[var(--terracotta)]',
  info: 'bg-[var(--surface-soft)] text-[var(--text-muted)]',
};

export function NotificationSeverityIcon({
  severity,
  locale,
  plain = false,
  className = 'size-5',
}: {
  severity: NotificationSeverity;
  locale: Locale;
  /** Renders the bare icon instead of the filled circle, for compact spots. */
  plain?: boolean;
  className?: string;
}) {
  const Icon = icons[severity];
  const label = <span className="sr-only">{severityLabel(severity, locale)}</span>;
  const icon = <Icon className={className} aria-hidden="true" />;
  if (plain)
    return (
      <>
        {icon}
        {label}
      </>
    );
  return (
    <span className={`grid size-10 shrink-0 place-items-center rounded-full ${tones[severity]}`}>
      {icon}
      {label}
    </span>
  );
}
