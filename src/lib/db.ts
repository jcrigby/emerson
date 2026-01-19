import Dexie, { type Table } from 'dexie';
import type {
  Project,
  Chapter,
  Scene,
  CodexEntry,
  Issue,
  ContinuityFact,
  ForeshadowingSetup,
  Premise,
  BeatSheet,
} from '@/types';

export class EmersonDatabase extends Dexie {
  projects!: Table<Project>;
  premises!: Table<Premise & { projectId: string }>;
  beatSheets!: Table<BeatSheet & { projectId: string }>;
  chapters!: Table<Chapter & { projectId: string }>;
  scenes!: Table<Scene & { projectId: string }>;
  codex!: Table<CodexEntry & { projectId: string }>;
  issues!: Table<Issue & { projectId: string }>;
  continuityFacts!: Table<ContinuityFact & { projectId: string }>;
  foreshadowing!: Table<ForeshadowingSetup & { projectId: string }>;

  constructor() {
    super('emerson');
    
    this.version(1).stores({
      projects: 'id, name, status, updatedAt',
      premises: 'projectId',
      beatSheets: 'projectId',
      chapters: 'id, projectId, number',
      scenes: 'id, projectId, chapterId, status',
      codex: 'id, projectId, type, name, *tags, *aliases',
      issues: 'id, projectId, sceneId, type, severity, resolved',
      continuityFacts: 'id, projectId, subject, sceneId',
      foreshadowing: 'id, projectId, status, setupSceneId, payoffSceneId',
    });
  }
}

export const db = new EmersonDatabase();

// Helper functions
export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function saveProject(project: Project): Promise<void> {
  project.updatedAt = new Date();
  await db.projects.put(project);
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', 
    [db.projects, db.premises, db.beatSheets, db.chapters, db.scenes, db.codex, db.issues, db.continuityFacts, db.foreshadowing],
    async () => {
      await db.projects.delete(id);
      await db.premises.where('projectId').equals(id).delete();
      await db.beatSheets.where('projectId').equals(id).delete();
      await db.chapters.where('projectId').equals(id).delete();
      await db.scenes.where('projectId').equals(id).delete();
      await db.codex.where('projectId').equals(id).delete();
      await db.issues.where('projectId').equals(id).delete();
      await db.continuityFacts.where('projectId').equals(id).delete();
      await db.foreshadowing.where('projectId').equals(id).delete();
    }
  );
}

export async function getChapters(projectId: string): Promise<(Chapter & { projectId: string })[]> {
  return db.chapters.where('projectId').equals(projectId).sortBy('number');
}

export async function getScenes(projectId: string): Promise<(Scene & { projectId: string })[]> {
  return db.scenes.where('projectId').equals(projectId).toArray();
}

export async function getScenesByChapter(chapterId: string): Promise<(Scene & { projectId: string })[]> {
  return db.scenes.where('chapterId').equals(chapterId).sortBy('number');
}

export async function getCodex(projectId: string): Promise<(CodexEntry & { projectId: string })[]> {
  return db.codex.where('projectId').equals(projectId).toArray();
}

export async function getCodexByType(projectId: string, type: string): Promise<(CodexEntry & { projectId: string })[]> {
  return db.codex.where({ projectId, type }).toArray();
}

export async function getIssues(projectId: string, unresolvedOnly = false): Promise<(Issue & { projectId: string })[]> {
  let query = db.issues.where('projectId').equals(projectId);
  const issues = await query.toArray();
  return unresolvedOnly ? issues.filter(i => !i.resolved) : issues;
}

export async function getBlockingIssues(projectId: string): Promise<(Issue & { projectId: string })[]> {
  const issues = await db.issues.where({ projectId, severity: 'blocking', resolved: false }).toArray();
  return issues;
}

export async function saveChapter(chapter: Chapter & { projectId: string }): Promise<void> {
  await db.chapters.put(chapter);
}

export async function saveScene(scene: Scene & { projectId: string }): Promise<void> {
  await db.scenes.put(scene);
}

export async function saveCodexEntry(entry: CodexEntry & { projectId: string }): Promise<void> {
  await db.codex.put(entry);
}

export async function deleteCodexEntry(id: string): Promise<void> {
  await db.codex.delete(id);
}
