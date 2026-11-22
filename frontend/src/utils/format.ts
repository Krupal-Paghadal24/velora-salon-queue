export const formatToken = (n: number): string => `T-${String(n).padStart(2, '0')}`;

export const minutesBetween = (fromIso: string | null, now: number): number =>
  fromIso ? Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60000)) : 0;
