export function toWasteTypeLabel(raw: string): string {
  if (raw === 'mixed') return 'Mixed';
  if (raw === 'non_biodegradable' || raw === 'non-biodegradable') return 'Non-biodegradable';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
