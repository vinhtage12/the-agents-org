import RepositoryDialog from './RepositoryDialog';

import type { TmnPopupItemRendererParams } from '@truyenmoinhu/uikit';
import type { IRepoListItem } from './types';
import type { IWarehouseDialogParams } from './WarehouseListPage';

const RepositoryDialogRenderer = ({
  api,
  params
}: TmnPopupItemRendererParams<IWarehouseDialogParams<IRepoListItem>>) => (
  <RepositoryDialog repo={params?.item} onDone={api.dismiss} />
);
export default RepositoryDialogRenderer;
