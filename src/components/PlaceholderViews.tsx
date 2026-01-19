import { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getProject, getChapters, saveChapter, getScenesByChapter, saveScene, getCodexByType, saveCodexEntry } from '@/lib/db';
import type { Project, Chapter, Scene, CodexEntry, CodexEntryType } from '@/types';
import { BookOpen, Users, PenTool, BarChart3, Plus } from 'lucide-react';

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
  const { project, loading } = useCurrentProject();
  const { currentProjectId } = useAppStore();
  const [chapters, setChapters] = useState<(Chapter & { projectId: string })[]>([]);
  const [scenes, setScenes] = useState<Record<string, (Scene & { projectId: string })[]>>({});
  const [loadingChapters, setLoadingChapters] = useState(true);

  useEffect(() => {
    if (!currentProjectId) {
      setChapters([]);
      setScenes({});
      setLoadingChapters(false);
      return;
    }

    getChapters(currentProjectId).then(async (ch) => {
      setChapters(ch);

      // Load scenes for each chapter
      const scenesMap: Record<string, (Scene & { projectId: string })[]> = {};
      for (const chapter of ch) {
        scenesMap[chapter.id] = await getScenesByChapter(chapter.id);
      }
      setScenes(scenesMap);
      setLoadingChapters(false);
    });
  }, [currentProjectId]);

  const handleAddChapter = async () => {
    if (!currentProjectId) return;

    const newChapter: Chapter & { projectId: string } = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      number: chapters.length + 1,
      title: '',
      scenes: [],
    };

    await saveChapter(newChapter);
    setChapters([...chapters, newChapter]);
    setScenes({ ...scenes, [newChapter.id]: [] });
  };

  const handleAddScene = async (chapterId: string) => {
    if (!currentProjectId) return;

    const chapterScenes = scenes[chapterId] || [];
    const newScene: Scene & { projectId: string } = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      chapterId,
      number: chapterScenes.length + 1,
      goal: '',
      status: 'planned',
      wordCount: 0,
      issues: [],
    };

    await saveScene(newScene);
    setScenes({ ...scenes, [chapterId]: [...chapterScenes, newScene] });
  };

  const handleTitleChange = async (chapterId: string, newTitle: string) => {
    const updatedChapters = chapters.map(c => c.id === chapterId ? { ...c, title: newTitle } : c);
    setChapters(updatedChapters);
    const chapter = updatedChapters.find(c => c.id === chapterId);
    if (chapter) {
      await saveChapter(chapter);
    }
  };

  if (loading || loadingChapters) {
    return (
      <div className="flex items-center justify-center h-full text-ink-400">
        Loading...
      </div>
    );
  }

  const hasChapters = chapters.length > 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-3xl font-semibold text-ink-900">Structure</h1>
          {project && (
            <span className="text-ink-400 font-normal">— {project.name}</span>
          )}
        </div>
        <button
          onClick={handleAddChapter}
          className="btn-secondary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Chapter
        </button>
      </div>
      <p className="text-ink-500 mb-8">Define your story's beat sheet, outline, and chapter breakdown.</p>

      {!hasChapters ? (
        <div className="page-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-accent" />
          </div>
          <h3 className="font-medium text-ink-700 mb-2">No outline yet</h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto mb-6">
            Start building your story's structure by creating an outline or adding chapters manually.
          </p>
          <button className="btn-primary">
            Create Outline
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <div key={chapter.id} className="page-card p-4">
              <div className="flex items-center gap-4">
                <span className="font-medium text-ink-700">Chapter {chapter.number}</span>
                <input
                  type="text"
                  placeholder="Chapter title..."
                  value={chapter.title}
                  onChange={(e) => handleTitleChange(chapter.id, e.target.value)}
                  className="flex-1 bg-transparent border-b border-ink-200 focus:border-accent focus:outline-none px-2 py-1"
                />
                {chapter.title && <span data-testid="chapter-title-display">{chapter.title}</span>}
              </div>

              {/* Scenes */}
              {(scenes[chapter.id] || []).length > 0 && (
                <div className="mt-4 ml-4 space-y-2">
                  {(scenes[chapter.id] || []).map((scene) => (
                    <div key={scene.id} className="flex items-center gap-2 text-sm">
                      <span className="text-ink-600">Scene {scene.number}</span>
                      <span className="badge text-xs capitalize">{scene.status.charAt(0).toUpperCase() + scene.status.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <button
                  onClick={() => handleAddScene(chapter.id)}
                  className="btn-secondary text-sm flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add Scene
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CodexView() {
  const { project, loading } = useCurrentProject();
  const { currentProjectId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'characters' | 'locations' | 'items' | 'concepts'>('characters');
  const [entries, setEntries] = useState<(CodexEntry & { projectId: string })[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<(CodexEntry & { projectId: string }) | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Map tab to CodexEntryType
  const tabToType: Record<string, CodexEntryType> = {
    characters: 'character',
    locations: 'location',
    items: 'item',
    concepts: 'concept',
  };

  useEffect(() => {
    if (!currentProjectId) {
      setEntries([]);
      setLoadingEntries(false);
      return;
    }

    setLoadingEntries(true);
    getCodexByType(currentProjectId, tabToType[activeTab]).then((e) => {
      setEntries(e);
      setLoadingEntries(false);
    });
  }, [currentProjectId, activeTab]);

  const handleAddEntry = () => {
    setFormName('');
    setFormDescription('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!currentProjectId || !formName.trim()) return;

    const newEntry: CodexEntry & { projectId: string } = {
      id: crypto.randomUUID(),
      projectId: currentProjectId,
      type: tabToType[activeTab],
      name: formName.trim(),
      aliases: [],
      description: formDescription.trim(),
      attributes: {},
      relationships: [],
      tags: [],
    };

    await saveCodexEntry(newEntry);
    setEntries([...entries, newEntry]);
    setShowForm(false);
    setFormName('');
    setFormDescription('');
  };

  const handleEntryClick = (entry: CodexEntry & { projectId: string }) => {
    setSelectedEntry(entry);
    setIsEditing(false);
    setEditName(entry.name);
    setEditDescription(entry.description);
  };

  const handleEditClick = () => {
    if (selectedEntry) {
      setEditName(selectedEntry.name);
      setEditDescription(selectedEntry.description);
      setIsEditing(true);
    }
  };

  const handleEditSave = async () => {
    if (!selectedEntry || !editName.trim()) return;

    const updatedEntry = {
      ...selectedEntry,
      name: editName.trim(),
      description: editDescription.trim(),
    };

    await saveCodexEntry(updatedEntry);
    setEntries(entries.map(e => e.id === updatedEntry.id ? updatedEntry : e));
    setSelectedEntry(updatedEntry);
    setIsEditing(false);
  };

  const handleCloseDetail = () => {
    setSelectedEntry(null);
    setIsEditing(false);
  };

  if (loading || loadingEntries) {
    return (
      <div className="flex items-center justify-center h-full text-ink-400">
        Loading...
      </div>
    );
  }

  const tabs = [
    { id: 'characters' as const, label: 'Characters' },
    { id: 'locations' as const, label: 'Locations' },
    { id: 'items' as const, label: 'Items' },
    { id: 'concepts' as const, label: 'Concepts' },
  ];

  const getEmptyMessage = () => {
    switch (activeTab) {
      case 'characters': return 'No characters yet';
      case 'locations': return 'No locations yet';
      case 'items': return 'No items yet';
      case 'concepts': return 'No concepts yet';
    }
  };

  const getAddButtonLabel = () => {
    switch (activeTab) {
      case 'characters': return 'Add Character';
      case 'locations': return 'Add Location';
      case 'items': return 'Add Item';
      case 'concepts': return 'Add Concept';
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">Codex</h1>
        {project && (
          <span className="text-ink-400 font-normal">— {project.name}</span>
        )}
      </div>
      <p className="text-ink-500 mb-8">Your story bible: characters, locations, items, and world building.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search entries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent"
        />
      </div>

      {/* Form for adding new entry */}
      {showForm && (
        <div className="page-card p-6 mb-6">
          <h3 className="font-medium text-ink-700 mb-4">{getAddButtonLabel()}</h3>
          <div className="space-y-4">
            <div>
              <input
                type="text"
                placeholder="Name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <textarea
                placeholder="Description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent min-h-[100px]"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} className="btn-primary">
                Save
              </button>
              <button onClick={() => setShowForm(false)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail View */}
      {selectedEntry && (
        <div className="page-card p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-medium text-ink-700">
              {isEditing ? 'Edit Entry' : selectedEntry.name}
            </h3>
            <button onClick={handleCloseDetail} className="text-ink-400 hover:text-ink-600">
              ✕
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <textarea
                  placeholder="Description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent min-h-[100px]"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleEditSave} className="btn-primary">
                  Save
                </button>
                <button onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {selectedEntry.description && (
                <p className="text-ink-500 mb-4">{selectedEntry.description}</p>
              )}
              {selectedEntry.aliases.length > 0 && (
                <div className="mb-4">
                  <span className="text-ink-600 font-medium">Aliases: </span>
                  {selectedEntry.aliases.join(', ')}
                </div>
              )}
              {Object.entries(selectedEntry.attributes).length > 0 && (
                <div className="mb-4">
                  {Object.entries(selectedEntry.attributes).map(([key, value]) => (
                    <div key={key}>
                      {key}: {value}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleEditClick} className="btn-secondary">
                  Edit
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Entry list */}
      {entries.length > 0 && (
        <div className="space-y-3 mb-6">
          {entries
            .filter((entry) =>
              searchQuery.trim() === '' ||
              entry.name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((entry) => (
              <div
                key={entry.id}
                className="codex-entry page-card p-4 cursor-pointer hover:bg-ink-50"
                onClick={() => handleEntryClick(entry)}
              >
                <h4 className="font-medium text-ink-700">{entry.name}</h4>
                {entry.description && (
                  <p className="text-ink-500 text-sm mt-1">{entry.description}</p>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Empty State or Add button */}
      {entries.length === 0 && !showForm ? (
        <div className="page-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-accent" />
          </div>
          <h3 className="font-medium text-ink-700 mb-2">{getEmptyMessage()}</h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto mb-6">
            Start building your story's world by adding entries to your codex.
          </p>
          <button onClick={handleAddEntry} className="btn-primary">
            {getAddButtonLabel()}
          </button>
        </div>
      ) : !showForm && (
        <button onClick={handleAddEntry} className="btn-secondary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {getAddButtonLabel()}
        </button>
      )}
    </div>
  );
}

export function WriteView() {
  const { project, loading } = useCurrentProject();
  const { currentProjectId } = useAppStore();
  const [chapters, setChapters] = useState<(Chapter & { projectId: string })[]>([]);
  const [scenes, setScenes] = useState<Record<string, (Scene & { projectId: string })[]>>({});
  const [loadingChapters, setLoadingChapters] = useState(true);
  const [selectedScene, setSelectedScene] = useState<(Scene & { projectId: string }) | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [showSaved, setShowSaved] = useState(false);

  const wordCount = editorContent.trim() === '' ? 0 : editorContent.trim().split(/\s+/).length;

  const loadScenesData = async () => {
    if (!currentProjectId) {
      setChapters([]);
      setScenes({});
      setLoadingChapters(false);
      return;
    }

    const ch = await getChapters(currentProjectId);
    setChapters(ch);

    // Load scenes for each chapter
    const scenesMap: Record<string, (Scene & { projectId: string })[]> = {};
    for (const chapter of ch) {
      scenesMap[chapter.id] = await getScenesByChapter(chapter.id);
    }
    setScenes(scenesMap);
    setLoadingChapters(false);
  };

  useEffect(() => {
    loadScenesData();
  }, [currentProjectId]);

  const handleSceneClick = (scene: Scene & { projectId: string }) => {
    setSelectedScene(scene);
    setEditorContent(scene.content || '');
    setShowSaved(false);
  };

  const handleSave = async () => {
    if (!selectedScene) return;

    const updatedScene = {
      ...selectedScene,
      content: editorContent,
      wordCount: wordCount,
    };

    await saveScene(updatedScene);
    setSelectedScene(updatedScene);

    // Update scenes state
    setScenes(prev => ({
      ...prev,
      [selectedScene.chapterId]: (prev[selectedScene.chapterId] || []).map(s =>
        s.id === selectedScene.id ? updatedScene : s
      ),
    }));

    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 3000);
  };

  const handleMarkComplete = async () => {
    if (!selectedScene) return;

    const updatedScene = {
      ...selectedScene,
      status: 'complete' as const,
    };

    await saveScene(updatedScene);
    setSelectedScene(updatedScene);

    // Update scenes state
    setScenes(prev => ({
      ...prev,
      [selectedScene.chapterId]: (prev[selectedScene.chapterId] || []).map(s =>
        s.id === selectedScene.id ? updatedScene : s
      ),
    }));
  };

  if (loading || loadingChapters) {
    return (
      <div className="flex items-center justify-center h-full text-ink-400">
        Loading...
      </div>
    );
  }

  const hasChapters = chapters.length > 0;

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">Write</h1>
        {project && (
          <span className="text-ink-400 font-normal">— {project.name}</span>
        )}
      </div>
      <p className="text-ink-500 mb-8">Draft your scenes with AI assistance and precise detail.</p>

      {!hasChapters ? (
        <div className="page-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <PenTool className="w-8 h-8 text-accent" />
          </div>
          <h3 className="font-medium text-ink-700 mb-2">No scenes to write</h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto">
            Create chapters and scenes in the Structure view first.
          </p>
        </div>
      ) : selectedScene ? (
        <div className="flex gap-6">
          {/* Editor Panel */}
          <div className="editor-panel flex-1 page-card p-6">
            <div className="scene-header mb-4 flex items-center gap-2">
              <h2 className="font-medium text-ink-700">Scene {selectedScene.number}</h2>
              <span className="badge text-xs capitalize">
                {selectedScene.status.charAt(0).toUpperCase() + selectedScene.status.slice(1)}
              </span>
            </div>
            <textarea
              className="prose-editor w-full min-h-[300px] p-4 border border-ink-200 rounded-lg focus:outline-none focus:border-accent resize-none"
              placeholder="Start writing your scene..."
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
            />
            <div className="flex items-center justify-between mt-2">
              <div className="text-sm text-ink-500">
                {wordCount} words
              </div>
              <div className="flex items-center gap-2">
                {showSaved && <span className="text-sm text-green-600">Saved</span>}
                <button onClick={handleSave} className="btn-primary">
                  Save
                </button>
                <button onClick={handleMarkComplete} className="btn-secondary">
                  Mark Complete
                </button>
              </div>
            </div>
          </div>

          {/* Context Panel */}
          <div className="context-panel w-64 page-card p-4">
            <h3 className="font-medium text-ink-700 mb-4">Context</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-ink-600 mb-2">Characters</h4>
                <p className="text-ink-400 text-sm">None added</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-ink-600 mb-2">Location</h4>
                <p className="text-ink-400 text-sm">Not set</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-ink-600 mb-2">Previous Scene</h4>
                <p className="text-ink-400 text-sm">No previous scene</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {chapters.map((chapter) => (
            <div key={chapter.id} className="page-card p-4">
              <div className="flex items-center gap-4">
                <span className="font-medium text-ink-700">
                  {chapter.title || `Chapter ${chapter.number}`}
                </span>
              </div>

              {/* Scenes */}
              {(scenes[chapter.id] || []).length > 0 && (
                <div className="mt-4 ml-4 space-y-2">
                  {(scenes[chapter.id] || []).map((scene) => (
                    <div
                      key={scene.id}
                      className="flex items-center gap-2 text-sm cursor-pointer hover:bg-ink-50 p-2 rounded"
                      onClick={() => handleSceneClick(scene)}
                    >
                      <span className="text-ink-600">Scene {scene.number}</span>
                      <span className="badge text-xs capitalize">
                        {scene.status.charAt(0).toUpperCase() + scene.status.slice(1)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ForeshadowingSetup {
  id: string;
  description: string;
  status: 'planted' | 'paid';
}

export function AnalyzeView() {
  const { project, loading } = useCurrentProject();
  const [activeTab, setActiveTab] = useState<'continuity' | 'foreshadowing' | 'issues'>('continuity');
  const [setups, setSetups] = useState<ForeshadowingSetup[]>([]);
  const [showSetupForm, setShowSetupForm] = useState(false);
  const [setupDescription, setSetupDescription] = useState('');
  const [selectedSetup, setSelectedSetup] = useState<ForeshadowingSetup | null>(null);

  const handleAddSetup = () => {
    setSetupDescription('');
    setShowSetupForm(true);
  };

  const handleSaveSetup = () => {
    if (!setupDescription.trim()) return;

    const newSetup: ForeshadowingSetup = {
      id: crypto.randomUUID(),
      description: setupDescription.trim(),
      status: 'planted',
    };

    setSetups([...setups, newSetup]);
    setShowSetupForm(false);
    setSetupDescription('');
  };

  const handleSetupClick = (setup: ForeshadowingSetup) => {
    setSelectedSetup(setup);
  };

  const handleMarkPaid = () => {
    if (!selectedSetup) return;

    const updatedSetups = setups.map(s =>
      s.id === selectedSetup.id ? { ...s, status: 'paid' as const } : s
    );
    setSetups(updatedSetups);
    setSelectedSetup({ ...selectedSetup, status: 'paid' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-ink-400">
        Loading...
      </div>
    );
  }

  const tabs = [
    { id: 'continuity' as const, label: 'Continuity' },
    { id: 'foreshadowing' as const, label: 'Foreshadowing' },
    { id: 'issues' as const, label: 'Issues' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="font-serif text-3xl font-semibold text-ink-900">Analysis</h1>
        {project && (
          <span className="text-ink-400 font-normal">— {project.name}</span>
        )}
      </div>
      <p className="text-ink-500 mb-8">Continuity checks, foreshadowing tracking, and issue management.</p>

      {/* Analysis Summary */}
      <div className="analysis-summary page-card p-4 mb-6">
        <div className="flex gap-6">
          <span className="text-ink-600">Facts: 0</span>
          <span className="text-ink-600">Issues: 0</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'continuity' && (
        <div className="page-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-accent" />
          </div>
          <h3 className="font-medium text-ink-700 mb-2">No content to analyze</h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto">
            Write some scenes first to run continuity analysis.
          </p>
        </div>
      )}

      {activeTab === 'foreshadowing' && (
        <div className="space-y-6">
          <div className="page-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-ink-700">Setups</h3>
              <button onClick={handleAddSetup} className="btn-secondary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Setup
              </button>
            </div>

            {showSetupForm && (
              <div className="mb-4 p-4 border border-ink-200 rounded-lg">
                <input
                  type="text"
                  placeholder="Description of foreshadowing element"
                  value={setupDescription}
                  onChange={(e) => setSetupDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-ink-200 rounded-lg focus:outline-none focus:border-accent mb-3"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveSetup} className="btn-primary">
                    Save
                  </button>
                  <button onClick={() => setShowSetupForm(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {setups.length > 0 ? (
              <div className="space-y-2">
                {setups.map((setup) => (
                  <div
                    key={setup.id}
                    className="flex items-center justify-between p-3 border border-ink-200 rounded-lg cursor-pointer hover:bg-ink-50"
                    onClick={() => handleSetupClick(setup)}
                  >
                    <span className="text-ink-700">{setup.description}</span>
                    <span className="badge">
                      {setup.status === 'planted' ? 'Planted' : 'Paid'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-ink-400 text-sm">No items tracked yet.</p>
            )}

            {selectedSetup && (
              <div className="mt-4 p-4 border border-accent rounded-lg bg-accent/5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-700">{selectedSetup.description}</span>
                  {selectedSetup.status === 'planted' && (
                    <button onClick={handleMarkPaid} className="btn-secondary">
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="page-card p-6">
            <h3 className="font-medium text-ink-700 mb-4">Payoffs</h3>
            <p className="text-ink-400 text-sm">No items tracked yet.</p>
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="page-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
            <BarChart3 className="w-8 h-8 text-accent" />
          </div>
          <h3 className="font-medium text-ink-700 mb-2">Blocking</h3>
          <p className="text-ink-400 text-sm max-w-md mx-auto mb-4">
            Issues that need attention in your manuscript.
          </p>
          <p className="text-ink-500">Warnings</p>
        </div>
      )}
    </div>
  );
}
