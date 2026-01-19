import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MODELS } from '@/lib/openrouter';

type ActiveView = 'dashboard' | 'structure' | 'codex' | 'write' | 'analyze' | 'settings';

interface AppState {
  // API key (persisted)
  openRouterKey: string | null;
  setOpenRouterKey: (key: string | null) => void;

  // Current project
  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;

  // UI state
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  
  // Active view
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;

  // Selected scene for writing
  selectedSceneId: string | null;
  setSelectedScene: (id: string | null) => void;

  // Model preferences (persisted)
  modelPreferences: {
    analysis: string;
    writing: string;
    brainstorm: string;
  };
  setModelPreference: (task: 'analysis' | 'writing' | 'brainstorm', model: string) => void;

  // Generation state
  isGenerating: boolean;
  generationProgress: string | null;
  setGenerating: (generating: boolean, progress?: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // API key
      openRouterKey: null,
      setOpenRouterKey: (key) => set({ openRouterKey: key }),

      // Current project
      currentProjectId: null,
      setCurrentProject: (id) => set({ currentProjectId: id }),

      // UI state
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      // Active view
      activeView: 'dashboard',
      setActiveView: (view) => set({ activeView: view }),

      // Selected scene
      selectedSceneId: null,
      setSelectedScene: (id) => set({ selectedSceneId: id }),

      // Model preferences
      modelPreferences: DEFAULT_MODELS,
      setModelPreference: (task, model) =>
        set((state) => ({
          modelPreferences: { ...state.modelPreferences, [task]: model },
        })),

      // Generation state
      isGenerating: false,
      generationProgress: null,
      setGenerating: (generating, progress = null) =>
        set({ isGenerating: generating, generationProgress: progress }),
    }),
    {
      name: 'emerson-storage',
      partialize: (state) => ({
        openRouterKey: state.openRouterKey,
        modelPreferences: state.modelPreferences,
        currentProjectId: state.currentProjectId,
      }),
    }
  )
);
