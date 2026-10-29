/** Local calendar date, fixed DD/MM/YYYY across application languages. */
export const formatDate = (
  value: string | null | undefined,
  withTime = true
): string => {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '—';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  return withTime
    ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : day;
};
