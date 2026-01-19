// AI-powered analysis for ingestion

import { generate } from './openrouter';
import type { DroppedFile } from './files';
import { truncateForAnalysis, countWords } from './files';

// File classification types
export type FileClassification = 
  | 'chapter-draft'
  | 'scene-fragment'
  | 'character-doc'
  | 'worldbuilding'
  | 'plot-outline'
  | 'notes'
  | 'timeline'
  | 'dialogue'
  | 'research'
  | 'unknown';

export interface ClassifiedFile extends DroppedFile {
  classification: FileClassification;
  confidence: number;
  summary: string;
  extractedEntities: {
    characters: string[];
    locations: string[];
    concepts: string[];
  };
  chapterGuess?: number;
  isComplete?: boolean;
}

export interface IngestionAnalysis {
  title?: string;
  genre?: string;
  totalWords: number;
  files: ClassifiedFile[];
  characters: CharacterMention[];
  locations: LocationMention[];
  concepts: ConceptMention[];
  possibleDuplicates: Array<{ items: string[]; reason: string }>;
  structureGuess: StructureGuess;
  questions: ClarifyingQuestion[];
}

export interface CharacterMention {
  name: string;
  aliases: string[];
  mentions: number;
  appearsIn: string[];
  description?: string;
  role?: 'protagonist' | 'antagonist' | 'supporting' | 'minor' | 'unknown';
}

export interface LocationMention {
  name: string;
  mentions: number;
  appearsIn: string[];
  description?: string;
}

export interface ConceptMention {
  name: string;
  type: 'magic-system' | 'technology' | 'organization' | 'event' | 'other';
  mentions: number;
  appearsIn: string[];
  description?: string;
}

export interface StructureGuess {
  chapters: ChapterGuess[];
  estimatedCompletion: number; // 0-100
}

export interface ChapterGuess {
  number: number;
  title?: string;
  files: string[];
  wordCount: number;
  status: 'complete' | 'partial' | 'outline-only' | 'tentative';
  hasAlternateVersions: boolean;
}

export interface ClarifyingQuestion {
  id: string;
  type: 'duplicate' | 'canon' | 'structure' | 'character' | 'other';
  question: string;
  options?: string[];
  context?: string;
}

// Classify a single file
export async function classifyFile(
  apiKey: string,
  file: DroppedFile,
  model: string
): Promise<ClassifiedFile> {
  const prompt = `Analyze this file from a novel writing project and classify it.

FILE NAME: ${file.name}
FILE PATH: ${file.path}
WORD COUNT: ${countWords(file.content)}

CONTENT:
${truncateForAnalysis(file.content)}

Respond with JSON only:
{
  "classification": "chapter-draft" | "scene-fragment" | "character-doc" | "worldbuilding" | "plot-outline" | "notes" | "timeline" | "dialogue" | "research" | "unknown",
  "confidence": 0.0-1.0,
  "summary": "One sentence describing what this file contains",
  "characters": ["names mentioned that appear to be characters"],
  "locations": ["place names mentioned"],
  "concepts": ["important world concepts, magic systems, organizations, etc"],
  "chapterNumber": null or number if this appears to be a chapter,
  "isComplete": true/false if this is prose, does it seem complete or cut off
}`;

  const response = await generate(apiKey, {
    model,
    systemPrompt: 'You are analyzing files for a novel writing tool. Respond only with valid JSON, no markdown.',
    userPrompt: prompt,
    temperature: 0.3,
    maxTokens: 1000,
  });

  try {
    const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''));
    return {
      ...file,
      classification: parsed.classification || 'unknown',
      confidence: parsed.confidence || 0.5,
      summary: parsed.summary || 'Could not summarize',
      extractedEntities: {
        characters: parsed.characters || [],
        locations: parsed.locations || [],
        concepts: parsed.concepts || [],
      },
      chapterGuess: parsed.chapterNumber,
      isComplete: parsed.isComplete,
    };
  } catch {
    return {
      ...file,
      classification: 'unknown',
      confidence: 0,
      summary: 'Failed to analyze',
      extractedEntities: { characters: [], locations: [], concepts: [] },
    };
  }
}

// Analyze all files and build a cohesive picture
export async function analyzeProject(
  apiKey: string,
  files: ClassifiedFile[],
  model: string,
  onProgress?: (message: string) => void
): Promise<IngestionAnalysis> {
  onProgress?.('Consolidating findings...');
  
  // Aggregate all entities
  const characterMap = new Map<string, CharacterMention>();
  const locationMap = new Map<string, LocationMention>();
  const conceptMap = new Map<string, ConceptMention>();
  
  for (const file of files) {
    for (const char of file.extractedEntities.characters) {
      const normalized = char.toLowerCase().trim();
      const existing = characterMap.get(normalized);
      if (existing) {
        existing.mentions++;
        if (!existing.appearsIn.includes(file.name)) {
          existing.appearsIn.push(file.name);
        }
      } else {
        characterMap.set(normalized, {
          name: char,
          aliases: [],
          mentions: 1,
          appearsIn: [file.name],
          role: 'unknown',
        });
      }
    }
    
    for (const loc of file.extractedEntities.locations) {
      const normalized = loc.toLowerCase().trim();
      const existing = locationMap.get(normalized);
      if (existing) {
        existing.mentions++;
        if (!existing.appearsIn.includes(file.name)) {
          existing.appearsIn.push(file.name);
        }
      } else {
        locationMap.set(normalized, {
          name: loc,
          mentions: 1,
          appearsIn: [file.name],
        });
      }
    }
    
    for (const concept of file.extractedEntities.concepts) {
      const normalized = concept.toLowerCase().trim();
      const existing = conceptMap.get(normalized);
      if (existing) {
        existing.mentions++;
        if (!existing.appearsIn.includes(file.name)) {
          existing.appearsIn.push(file.name);
        }
      } else {
        conceptMap.set(normalized, {
          name: concept,
          type: 'other',
          mentions: 1,
          appearsIn: [file.name],
        });
      }
    }
  }
  
  // Sort by mentions
  const characters = Array.from(characterMap.values()).sort((a, b) => b.mentions - a.mentions);
  const locations = Array.from(locationMap.values()).sort((a, b) => b.mentions - a.mentions);
  const concepts = Array.from(conceptMap.values()).sort((a, b) => b.mentions - a.mentions);
  
  // Build structure guess from chapter files
  const chapterFiles = files.filter(f => 
    f.classification === 'chapter-draft' || f.classification === 'scene-fragment'
  );
  
  const chapterMap = new Map<number, ChapterGuess>();
  for (const file of chapterFiles) {
    const num = file.chapterGuess || 0;
    const existing = chapterMap.get(num);
    if (existing) {
      existing.files.push(file.name);
      existing.wordCount += countWords(file.content);
      existing.hasAlternateVersions = true;
    } else {
      chapterMap.set(num, {
        number: num,
        files: [file.name],
        wordCount: countWords(file.content),
        status: file.isComplete ? 'complete' : 'partial',
        hasAlternateVersions: false,
      });
    }
  }
  
  const chapters = Array.from(chapterMap.values()).sort((a, b) => a.number - b.number);
  
  // Calculate total words
  const totalWords = files.reduce((sum, f) => sum + countWords(f.content), 0);
  
  // Use AI to find duplicates and generate questions
  onProgress?.('Looking for duplicates and generating questions...');
  
  const consolidationPrompt = `I've analyzed a novel project with these findings:

CHARACTERS (${characters.length}):
${characters.slice(0, 30).map(c => `- ${c.name} (${c.mentions} mentions)`).join('\n')}

LOCATIONS (${locations.length}):
${locations.slice(0, 20).map(l => `- ${l.name} (${l.mentions} mentions)`).join('\n')}

CHAPTERS FOUND:
${chapters.map(c => `- Chapter ${c.number || '?'}: ${c.wordCount} words, ${c.status}${c.hasAlternateVersions ? ' (has alternate versions)' : ''}`).join('\n')}

Respond with JSON:
{
  "genreGuess": "best guess at genre",
  "possibleDuplicates": [
    {"items": ["Name1", "Name2"], "reason": "why these might be the same"}
  ],
  "questions": [
    {
      "id": "q1",
      "type": "duplicate" | "canon" | "structure" | "character",
      "question": "The question to ask the user",
      "options": ["Option A", "Option B"] // optional
    }
  ]
}

Focus on:
1. Character names that might be the same person (nicknames, typos, etc)
2. Alternate versions of chapters that need canon selection
3. Unclear protagonist/antagonist
4. Structural gaps or confusion`;

  let genreGuess = 'Fiction';
  let possibleDuplicates: Array<{ items: string[]; reason: string }> = [];
  let questions: ClarifyingQuestion[] = [];
  
  try {
    const response = await generate(apiKey, {
      model,
      systemPrompt: 'You are helping organize a novel project. Respond only with valid JSON.',
      userPrompt: consolidationPrompt,
      temperature: 0.3,
      maxTokens: 2000,
    });
    
    const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''));
    genreGuess = parsed.genreGuess || 'Fiction';
    possibleDuplicates = parsed.possibleDuplicates || [];
    questions = parsed.questions || [];
  } catch (err) {
    console.error('Failed to generate questions:', err);
  }
  
  return {
    genre: genreGuess,
    totalWords,
    files,
    characters,
    locations,
    concepts,
    possibleDuplicates,
    structureGuess: {
      chapters,
      estimatedCompletion: Math.min(100, Math.round((totalWords / 80000) * 100)),
    },
    questions,
  };
}

// Generate character details from context
export async function enrichCharacter(
  apiKey: string,
  character: CharacterMention,
  relevantContent: string,
  model: string
): Promise<CharacterMention> {
  const prompt = `Based on this content from a novel, describe the character "${character.name}":

${truncateForAnalysis(relevantContent, 4000)}

Respond with JSON:
{
  "description": "Brief description of who this character is",
  "role": "protagonist" | "antagonist" | "supporting" | "minor",
  "possibleAliases": ["other names or nicknames for this character"]
}`;

  try {
    const response = await generate(apiKey, {
      model,
      systemPrompt: 'You are analyzing a novel. Respond only with valid JSON.',
      userPrompt: prompt,
      temperature: 0.3,
      maxTokens: 500,
    });
    
    const parsed = JSON.parse(response.content.replace(/```json\n?|\n?```/g, ''));
    return {
      ...character,
      description: parsed.description,
      role: parsed.role || 'unknown',
      aliases: [...character.aliases, ...(parsed.possibleAliases || [])],
    };
  } catch {
    return character;
  }
}
