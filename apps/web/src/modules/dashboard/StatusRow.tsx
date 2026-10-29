import { memo } from 'react';

import { TmnFlex, TmnText } from '@truyenmoinhu/uikit';
export interface IStatusRowProps {
  label: string;
  value: string;
  ok?: boolean;
}
const StatusRow = ({ label, value, ok }: IStatusRowProps) => (
  <TmnFlex direction="row" justify="between" align="center">
    <TmnText muted>{label}</TmnText>
    <TmnText
      weight="medium"
      color={ok === undefined ? undefined : ok ? 'green' : 'red'}
    >
      {value}
    </TmnText>
  </TmnFlex>
);
export default memo(StatusRow);
