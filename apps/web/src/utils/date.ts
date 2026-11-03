import { DateFormat, DateUtils } from '@truyenmoinhu/utils';

/** Calendar date in the app's configured timezone, fixed DD/MM/YYYY across languages. */
export const formatDate = (
  value: string | null | undefined,
  withTime = true
): string => {
  if (!value) {
    return '—';
  }

  if (!DateUtils.toDayjs(value).isValid()) {
    return '—';
  }

  return DateUtils.format(
    value,
    withTime ? DateFormat.DDMMYYYYHHmm : DateFormat.DDMMYYYY
  );
};
