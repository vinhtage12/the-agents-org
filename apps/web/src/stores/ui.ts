import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}
export const useUIStore = create<UIState>()(
  persist(
    set => ({
      sidebarOpen:
        typeof window === 'undefined' ||
        window.matchMedia('(min-width: 768px)').matches,
      setSidebarOpen: sidebarOpen => set({ sidebarOpen }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen }))
    }),
    {
      name: 'ui',
      partialize: ({ sidebarOpen }) => ({ sidebarOpen })
    }
  )
);
