const TZ = 'Asia/Kathmandu';

function dayStr(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

function timeStr(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  });
}

export function formatRelativeTime(input: string | Date | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input as string);
  if (isNaN(date.getTime())) return String(input);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const todayDay = dayStr(now);
  const yesterdayDay = dayStr(new Date(now.getTime() - 86_400_000));
  const dateDay = dayStr(date);

  if (dateDay === todayDay) return `Today ${timeStr(date)}`;
  if (dateDay === yesterdayDay) return `Yesterday ${timeStr(date)}`;

  if (diffMs < 7 * 24 * 3_600_000) {
    return `${date.toLocaleDateString('en-US', { weekday: 'short', timeZone: TZ })} ${timeStr(date)}`;
  }

  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: TZ });
}
