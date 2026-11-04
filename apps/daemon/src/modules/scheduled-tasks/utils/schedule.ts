export type Schedule = { time: number; days: number[] };

export { expandHome } from './output-file';

export function occurrencesBetween(
  schedule: Schedule,
  from: Date,
  to: Date
): Date[] {
  if (from >= to) return [];

  const occurrences: Date[] = [];
  const day = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const lastDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (day <= lastDay) {
    if (schedule.days.includes(day.getDay())) {
      const occurrence = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        0,
        schedule.time
      );
      if (occurrence > from && occurrence <= to) occurrences.push(occurrence);
    }
    day.setDate(day.getDate() + 1);
  }

  return occurrences;
}

export function nextOccurrence(schedule: Schedule, after: Date): Date {
  const to = new Date(
    after.getFullYear(),
    after.getMonth(),
    after.getDate() + 8
  );
  const occurrence = occurrencesBetween(schedule, after, to)[0];
  if (!occurrence) throw new Error('No occurrence found within eight days');
  return occurrence;
}

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'task';
}
