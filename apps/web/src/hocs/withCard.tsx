import { TmnCard, type TmnCardProps } from '@truyenmoinhu/uikit';

import type { ComponentType } from 'react';

const withCard =
  <T extends {}>(cardProps?: TmnCardProps) =>
  (Component: ComponentType<T>) => {
    return (props: T) => {
      return (
        <TmnCard {...cardProps}>
          <Component {...props} />
        </TmnCard>
      );
    };
  };

export default withCard;
