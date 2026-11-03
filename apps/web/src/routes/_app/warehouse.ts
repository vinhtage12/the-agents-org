import { createFileRoute } from '@tanstack/react-router';

import { WarehouseLayout } from '#modules/warehouse';
export const Route = createFileRoute('/_app/warehouse')({
  component: WarehouseLayout
});
