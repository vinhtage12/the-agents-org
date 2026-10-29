import { memo } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { TmnButton } from '@truyenmoinhu/uikit';

import { useSidebar } from '#hooks/sidebar';
import { trans } from '#i18n';

const ToggleSidebar = () => {
  const { isOpen, toggle } = useSidebar();
  return (
    <TmnButton
      startIcon={isOpen ? PanelLeftClose : PanelLeftOpen}
      onClick={toggle}
      variant="transparent"
      kind="default"
      tooltip={trans('common.toggle_sidebar')}
      aria-label={trans('common.toggle_sidebar')}
      aria-expanded={isOpen}
    />
  );
};
export default memo(ToggleSidebar);
