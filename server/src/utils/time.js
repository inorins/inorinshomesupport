export function toRelativeTime(isoDate) {
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return 'just now';
  const diffMs = Date.now() - ts;
  if (diffMs < 60_000) return 'just now';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH === 1 ? '' : 's'} ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} day${diffD === 1 ? '' : 's'} ago`;
}

export function toMessageTimestamp(date) {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kathmandu',
  });
}

export function withLastUpdated(ticket) {
  const updatedAt = ticket.updated_at ?? ticket.updatedAt ?? ticket.created_at ?? ticket.createdAt;
  return {
    ...ticket,
    requestType: ticket.request_type ?? ticket.requestType ?? 'Issue',
    lastUpdated: toRelativeTime(updatedAt),
  };
}
