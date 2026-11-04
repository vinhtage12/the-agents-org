import { nextOccurrence, occurrencesBetween, slugify } from './schedule';

describe('occurrencesBetween', () => {
  const schedule = { time: 510, days: [1, 3, 5] };

  it('returns local occurrences in ascending order within the interval', () => {
    expect(
      occurrencesBetween(
        schedule,
        new Date(2026, 10, 2, 8),
        new Date(2026, 10, 6, 9)
      )
    ).toEqual([
      new Date(2026, 10, 2, 8, 30),
      new Date(2026, 10, 4, 8, 30),
      new Date(2026, 10, 6, 8, 30)
    ]);
  });

  it('excludes from and includes to', () => {
    expect(
      occurrencesBetween(
        schedule,
        new Date(2026, 10, 2, 8, 30),
        new Date(2026, 10, 6, 8, 30)
      )
    ).toEqual([new Date(2026, 10, 4, 8, 30), new Date(2026, 10, 6, 8, 30)]);
  });

  it('handles a range crossing midnight', () => {
    expect(
      occurrencesBetween(
        { time: 1080, days: [6] },
        new Date(2026, 10, 7, 17),
        new Date(2026, 10, 8, 1)
      )
    ).toEqual([new Date(2026, 10, 7, 18)]);
  });

  it.each([
    [new Date(2026, 10, 2), new Date(2026, 10, 2)],
    [new Date(2026, 10, 3), new Date(2026, 10, 2)]
  ])('returns no occurrences when from is not before to', (from, to) => {
    expect(occurrencesBetween(schedule, from, to)).toEqual([]);
  });
});

describe('nextOccurrence', () => {
  const daily = { time: 570, days: [0, 1, 2, 3, 4, 5, 6] };

  it('returns the next day when today has already occurred', () => {
    expect(nextOccurrence(daily, new Date(2026, 10, 2, 9, 30))).toEqual(
      new Date(2026, 10, 3, 9, 30)
    );
  });

  it('returns today when the occurrence is still ahead', () => {
    expect(nextOccurrence(daily, new Date(2026, 10, 2, 9, 29))).toEqual(
      new Date(2026, 10, 2, 9, 30)
    );
  });
});

describe('slugify', () => {
  it.each([
    ['Báo cáo EOD + Stand-up', 'bao-cao-eod-stand-up'],
    ['  Đi   ', 'di'],
    ['!!!', 'task']
  ])('slugifies %s', (name, expected) => {
    expect(slugify(name)).toBe(expected);
  });
});
