import { type ReactNode, memo, useCallback } from 'react';
import {
  Check,
  Languages,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  Appearance,
  TmnButton,
  type TmnDropDownMenuAction,
  type TmnDropDownMenuActionCallback,
  TmnDropdownMenu,
  TmnFlex,
  TmnSeparator,
  useTheme
} from '@truyenmoinhu/uikit';

import { useSidebar } from '#hooks/sidebar';
import { LANGUAGES, trans } from '#i18n';

const ToggleSidebar = memo(() => {
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
});

const LanguageSwitch = memo(() => {
  const { i18n } = useTranslation();

  const actions = useCallback<TmnDropDownMenuActionCallback>(
    () =>
      LANGUAGES.map(lng => ({
        id: `language-${lng}`,
        // Endonym ("Tiếng Việt", "English") so each option reads in its own language.
        title:
          new Intl.DisplayNames([lng], { type: 'language' }).of(lng) ?? lng,
        icon: lng === i18n.resolvedLanguage ? Check : undefined,
        onClick: () => i18n.changeLanguage(lng)
      })) as TmnDropDownMenuAction[],
    [i18n]
  );

  return (
    <TmnDropdownMenu actions={actions} minWidth={150}>
      <TmnButton
        startIcon={Languages}
        variant="transparent"
        kind="default"
        tooltip={trans('common.language')}
        aria-label={trans('common.language')}
      />
    </TmnDropdownMenu>
  );
});

const ThemeToggle = memo(() => {
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
});

const Header = ({ children }: { children?: ReactNode }) => (
  <TmnFlex
    asChild
    direction="row"
    align="center"
    gap={2}
    flexGrow={0}
    paddingX={3}
    className="h-12 shrink-0 border-b border-border bg-card"
  >
    <header>
      <ToggleSidebar />
      <TmnSeparator orientation="vertical" className="h-4 shrink-0" />
      {children}
      <LanguageSwitch />
      <ThemeToggle />
    </header>
  </TmnFlex>
);

export default memo(Header);
