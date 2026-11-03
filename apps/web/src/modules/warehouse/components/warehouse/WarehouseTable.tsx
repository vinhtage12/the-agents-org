import { type ReactNode, memo, useMemo, useRef } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';

import { type IColDef, type ITableApi, Table } from '@truyenmoinhu/table';
import { TmnButton, TmnFlex } from '@truyenmoinhu/uikit';

import { trans } from '#i18n';

import type { IWarehouseRow } from '../../types';

export interface IWarehouseColumn<TRow> {
  key: string;
  title: string;
  render: (row: TRow) => ReactNode;
}
export interface IWarehouseTableProps<TRow extends IWarehouseRow> {
  columns: IWarehouseColumn<TRow>[];
  rows: TRow[];
  addLabel: string;
  onAdd: () => void;
  onEdit: (row: TRow) => void;
  onDelete: (row: TRow) => void;
}
const WarehouseTable = <TRow extends IWarehouseRow>({
  columns,
  rows,
  addLabel,
  onAdd,
  onEdit,
  onDelete
}: IWarehouseTableProps<TRow>) => {
  const tableRef = useRef<ITableApi<TRow> | null>(null);
  const colDefs = useMemo<IColDef<TRow>[]>(
    () => [
      ...columns.map(column => ({
        colId: column.key,
        headerName: column.title,
        flex: 1,
        wrapText: true,
        cellRenderer: ({ data }: { data: TRow }) => column.render(data)
      })),
      {
        colId: 'actions',
        headerName: trans('warehouse.actions'),
        width: 120,
        pinned: 'end',
        cellRenderer: ({ data: row }: { data: TRow }) => (
          <TmnFlex direction="row" gap={1} justify="end">
            <TmnButton
              variant="transparent"
              kind="default"
              startIcon={Pencil}
              aria-label={trans('warehouse.edit')}
              onClick={() => onEdit(row)}
            />
            <TmnButton
              variant="transparent"
              kind="default"
              startIcon={Trash2}
              aria-label={trans('warehouse.delete')}
              disabled={row.inUse > 0}
              title={
                row.inUse > 0
                  ? trans('warehouse.delete_blocked', { count: row.inUse })
                  : trans('warehouse.delete')
              }
              onClick={() => onDelete(row)}
            />
          </TmnFlex>
        )
      }
    ],
    [columns, onEdit, onDelete]
  );

  return (
    <Table<TRow>
      tableRef={tableRef}
      colDefs={colDefs}
      data={rows}
      getRowId={row => String(row.id)}
      emptyMessage={trans('warehouse.empty')}
      rightNode={
        <TmnButton kind="primary" startIcon={Plus} onClick={onAdd}>
          {addLabel}
        </TmnButton>
      }
    />
  );
};
export default memo(WarehouseTable) as typeof WarehouseTable;
