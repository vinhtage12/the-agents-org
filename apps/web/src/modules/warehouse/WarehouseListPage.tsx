import { type ReactNode, memo } from 'react';

import {
  TmnButton,
  TmnCallout,
  TmnLoading,
  type TmnPopupItemRendererParams,
  UIUtils
} from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import { WAREHOUSE_DIALOG } from './constants';
import { useDeleteWarehouseItem, useWarehouseList } from './hooks';
import WarehouseTable, { type IWarehouseColumn } from './WarehouseTable';

import type { IWarehouseRow, WarehouseKind } from './types';

export interface IWarehouseDialogParams<TRow> {
  item?: TRow;
}
export interface IWarehouseListPageProps<TRow extends IWarehouseRow> {
  kind: WarehouseKind;
  params?: Record<string, string>;
  columns: IWarehouseColumn<TRow>[];
  addLabel: string;
  nameOf: (row: TRow) => string;
  renderer: (
    props: TmnPopupItemRendererParams<IWarehouseDialogParams<TRow>>
  ) => ReactNode;
}
const WarehouseListPage = <TRow extends IWarehouseRow>({
  kind,
  params,
  columns,
  addLabel,
  nameOf,
  renderer
}: IWarehouseListPageProps<TRow>) => {
  const { data, isLoading, isError, refetch } = useWarehouseList<TRow>(
    kind,
    params
  );
  const remove = useDeleteWarehouseItem(kind);

  const openDialog = (item?: TRow) => {
    UIUtils.popup.open({
      name: WAREHOUSE_DIALOG,
      size: 'xl',
      renderer,
      params: { item }
    });
  };

  if (isLoading) {
    return <TmnLoading />;
  }
  if (isError || !data) {
    return (
      <TmnCallout role="alert" color="red">
        {trans('warehouse.error')}
        <TmnButton onClick={() => refetch()}>
          {trans('warehouse.retry')}
        </TmnButton>
      </TmnCallout>
    );
  }

  return (
    <WarehouseTable
      columns={columns}
      rows={data}
      addLabel={addLabel}
      onAdd={() => openDialog()}
      onEdit={openDialog}
      onDelete={row => remove(row.id, nameOf(row))}
    />
  );
};
export default memo(WarehouseListPage) as typeof WarehouseListPage;
