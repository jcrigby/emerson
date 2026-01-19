import { useState } from 'react';
import { useAppStore } from '@/store';
import { Sidebar } from '@/components/Sidebar';
import { DashboardView } from '@/components/DashboardView';
import { SettingsView } from '@/components/SettingsView';
import { IngestionView } from '@/components/IngestionView';
import { StructureView, CodexView, WriteView, AnalyzeView } from '@/components/PlaceholderViews';
import clsx from 'clsx';

function App() {
  const { sidebarOpen, activeView, setActiveView, setCurrentProject } = useAppStore();
  const [showIngestion, setShowIngestion] = useState(false);

  const handleNewProject = () => {
    setShowIngestion(true);
  };

  const handleIngestionComplete = (projectId: string) => {
    setShowIngestion(false);
    setCurrentProject(projectId);
    setActiveView('structure');
  };

  const renderView = () => {
    if (showIngestion) {
      return <IngestionView onComplete={handleIngestionComplete} />;
    }

    switch (activeView) {
      case 'dashboard':
        return <DashboardView onNewProject={handleNewProject} />;
      case 'structure':
        return <StructureView />;
      case 'codex':
        return <CodexView />;
      case 'write':
        return <WriteView />;
      case 'analyze':
        return <AnalyzeView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNewProject={handleNewProject} />;
    }
  };

  return (
    <div className="min-h-screen">
      {!showIngestion && <Sidebar />}
      <main
        className={clsx(
          'min-h-screen transition-all duration-300',
          !showIngestion && (sidebarOpen ? 'ml-64' : 'ml-16')
        )}
      >
        {renderView()}
      </main>
    </div>
  );
}

export default App;
