import { memo } from 'react';
import { Link } from '@tanstack/react-router';
import { House } from 'lucide-react';

import { TmnButton, TmnFlex, TmnText } from '@truyenmoinhu/uikit';

import { ROUTE_PATHS } from '#constants/routes';
import { trans } from '#i18n';

// Root `notFoundComponent`: any URL that matches no route.
const NotFound = () => (
  <TmnFlex
    direction="column"
    align="center"
    justify="center"
    gap={3}
    className="min-h-dvh p-6 text-center"
  >
    <TmnText size="9" weight="bold" muted>
      404
    </TmnText>
    <TmnText size="5" weight="medium">
      {trans('not_found.title')}
    </TmnText>
    <TmnText muted>{trans('not_found.description')}</TmnText>
    <TmnButton
      asChild
      kind="primary"
      startIcon={House}
      title={trans('not_found.go_home')}
    >
      <Link to={ROUTE_PATHS.dashboard} />
    </TmnButton>
  </TmnFlex>
);
export default memo(NotFound);
