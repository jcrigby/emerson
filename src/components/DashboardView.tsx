import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Clock, BookOpen, Trash2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAllProjects, deleteProject } from '@/lib/db';
import type { Project, ProjectStatus } from '@/types';
import clsx from 'clsx';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  setup: 'Setting Up',
  outlining: 'Outlining',
  drafting: 'Drafting',
  revising: 'Revising',
  polishing: 'Polishing',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  setup: 'badge-info',
  outlining: 'badge-info',
  drafting: 'badge-warning',
  revising: 'badge-warning',
  polishing: 'badge-success',
};

interface DashboardViewProps {
  onNewProject?: () => void;
}

export function DashboardView({ onNewProject }: DashboardViewProps) {
  const { setCurrentProject, setActiveView, openRouterKey } = useAppStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const all = await getAllProjects();
      setProjects(all);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const openProject = (id: string) => {
    setCurrentProject(id);
    setActiveView('structure');
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects(projects.filter((p) => p.id !== id));
    setDeleteConfirm(null);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  };

  const handleNewProjectClick = () => {
    if (onNewProject) {
      onNewProject();
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink-900 mb-1">Projects</h1>
          <p className="text-ink-500">Your novels and works in progress.</p>
        </div>
        <button onClick={handleNewProjectClick} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* API Key Warning */}
      {!openRouterKey && (
        <div className="page-card p-4 mb-6 border-l-4 border-amber-400 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">No API key configured</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Add your OpenRouter API key in{' '}
                <button
                  onClick={() => setActiveView('settings')}
                  className="underline hover:no-underline"
                >
                  Settings
                </button>{' '}
                to enable AI features.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Projects List */}
      {loading ? (
        <div className="text-center py-12 text-ink-400">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-paper-200 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-ink-400" />
          </div>
          <h3 className="font-medium text-ink-700 mb-1">No projects yet</h3>
          <p className="text-ink-400 text-sm mb-4">Create your first project to get started.</p>
          <button onClick={handleNewProjectClick} className="btn-primary">
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="page-card p-5 hover:shadow-page-hover cursor-pointer group"
              onClick={() => openProject(project.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium text-ink-900 group-hover:text-accent transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-ink-500 mt-0.5">{project.genre}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={clsx('badge', STATUS_COLORS[project.status])}>
                    {STATUS_LABELS[project.status]}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(project.id);
                    }}
                    className="p-2 text-ink-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3 ml-14 text-xs text-ink-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {formatDate(project.updatedAt)}
                </span>
              </div>

              {/* Delete confirmation */}
              {deleteConfirm === project.id && (
                <div
                  className="mt-4 pt-4 border-t border-paper-200 flex items-center justify-between"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-sm text-red-600">Delete this project?</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="btn-ghost text-sm py-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="btn-primary bg-red-600 hover:bg-red-700 text-sm py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
