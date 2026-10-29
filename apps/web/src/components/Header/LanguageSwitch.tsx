import { memo, useCallback } from 'react';
import { Check, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  TmnButton,
  type TmnDropDownMenuAction,
  type TmnDropDownMenuActionCallback,
  TmnDropdownMenu
} from '@truyenmoinhu/uikit';

import { LANGUAGES, trans } from '#i18n';

const LanguageSwitch = () => {
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
};
export default memo(LanguageSwitch);
