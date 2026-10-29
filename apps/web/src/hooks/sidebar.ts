import { useUIStore } from '#stores/ui';
export const useSidebar = () => {
  const isOpen = useUIStore(state => state.sidebarOpen);
  const setOpen = useUIStore(state => state.setSidebarOpen);
  const toggle = useUIStore(state => state.toggleSidebar);
  return {
    isOpen,
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle
  };
};
