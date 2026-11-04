import { memo } from 'react';

import { TmnBadge } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { useAttentionRuns } from '../hooks';

const AttentionBadge = () => {
  const count = useAttentionRuns().data?.length ?? 0;
  if (count === 0) {
    return null;
  }
  return (
    <TmnBadge aria-label={trans('scheduled.attention_badge', { count })}>
      {count}
    </TmnBadge>
  );
};
export default memo(AttentionBadge);
