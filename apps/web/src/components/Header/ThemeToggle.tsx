import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';

import { Appearance, TmnButton, useTheme } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

const ThemeToggle = () => {
  const { appearance, onChangeAppearance } = useTheme();
  const isDark = appearance === Appearance.DARK;
  const label = trans(isDark ? 'common.light_mode' : 'common.dark_mode');
  return (
    <TmnButton
      startIcon={isDark ? Sun : Moon}
      onClick={() =>
        onChangeAppearance(isDark ? Appearance.LIGHT : Appearance.DARK)
      }
      variant="transparent"
      kind="default"
      tooltip={label}
      aria-label={label}
    />
  );
};
export default memo(ThemeToggle);
