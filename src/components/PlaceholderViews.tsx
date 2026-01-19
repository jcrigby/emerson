import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getProject } from '@/lib/db';
import type { Project } from '@/types';
import { BookOpen, Users, PenTool, BarChart3 } from 'lucide-react';

function useCurrentProject() {
  const { currentProjectId } = useAppStore();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProjectId) {
      setProject(null);
      setLoading(false);
      return;
    }

    getProject(currentProjectId).then((p) => {
      setProject(p || null);
      setLoading(false);
    });
  }, [currentProjectId]);

  return { project, loading };
}

function PlaceholderView({ 
  title, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  description: string;
  icon: typeof BookOpen;
}) {
  const { project, loading } = useCurrentProject();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">{title}</h1>
        {project && (
          <span className="text-ink-400 font-normal">— {project.name}</span>
        )}
      </div>
      <p className="text-ink-500 mb-8">{description}</p>

      <div className="page-card p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
          <Icon className="w-8 h-8 text-accent" />
        </div>
        <h3 className="font-medium text-ink-700 mb-2">Coming Soon</h3>
        <p className="text-ink-400 text-sm max-w-md mx-auto">
          This view is under construction. The core functionality is being built.
        </p>
      </div>
    </div>
  );
}

export function StructureView() {
  return (
    <PlaceholderView
      title="Structure"
      description="Define your story's beat sheet, outline, and chapter breakdown."
      icon={BookOpen}
    />
  );
}

export function CodexView() {
  return (
    <PlaceholderView
      title="Codex"
      description="Your story bible: characters, locations, items, and world building."
      icon={Users}
    />
  );
}

export function WriteView() {
  return (
    <PlaceholderView
      title="Write"
      description="Draft your scenes with AI assistance and surgical context."
      icon={PenTool}
    />
  );
}

export function AnalyzeView() {
  return (
    <PlaceholderView
      title="Analysis"
      description="Continuity checks, foreshadowing tracking, and issue management."
      icon={BarChart3}
    />
  );
}
