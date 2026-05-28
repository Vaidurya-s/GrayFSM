import { create } from 'zustand';

type ModalType = 'createFSM' | 'editState' | 'editTransition' | 'exportFSM' | 'confirmDelete' | null;

interface UIStore {
  sidebarOpen: boolean;
  activeModal: ModalType;
  mobileMenuOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  openModal: (modal: ModalType) => void;
  closeModal: () => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 1024px)').matches
      : true,
  activeModal: null,
  mobileMenuOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));
