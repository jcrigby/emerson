import { useState, useCallback, useRef, useEffect } from 'react';
import { Upload, FolderOpen, FileText, Users, MapPin, Sparkles, Check, ChevronRight, Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { useAppStore } from '@/store';
import { processFiles, pickFolder, countWords, type DroppedFile } from '@/lib/files';
import { classifyFile, analyzeProject, type ClassifiedFile, type IngestionAnalysis, type ClarifyingQuestion } from '@/lib/analysis';
import { db, saveProject } from '@/lib/db';
import type { Project, CodexEntry } from '@/types';
import clsx from 'clsx';

type IngestionStep = 
  | 'welcome'
  | 'dropping'
  | 'reading'
  | 'classifying'
  | 'analyzing'
  | 'summary'
  | 'characters'
  | 'structure'
  | 'questions'
  | 'confirm'
  | 'building'
  | 'complete';

interface Message {
  id: string;
  type: 'assistant' | 'user' | 'system';
  content: string;
  component?: React.ReactNode;
}

export function IngestionView({ onComplete }: { onComplete: (projectId: string) => void }) {
  const { openRouterKey, modelPreferences } = useAppStore();
  const [step, setStep] = useState<IngestionStep>('welcome');
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [classifiedFiles, setClassifiedFiles] = useState<ClassifiedFile[]>([]);
  const [analysis, setAnalysis] = useState<IngestionAnalysis | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectName, setProjectName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add a message
  const addMessage = useCallback((type: Message['type'], content: string, component?: React.ReactNode) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      type,
      content,
      component,
    }]);
  }, []);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!openRouterKey) {
      setError('Please add your OpenRouter API key in Settings first.');
      return;
    }

    setStep('reading');
    setIsProcessing(true);
    addMessage('system', 'Reading your files...');

    try {
      const items = e.dataTransfer.items;
      const fileList: File[] = [];

      // Handle both files and directories
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry?.();
          if (entry?.isDirectory) {
            // For directories, we need to read recursively
            await readDirectoryEntry(entry as FileSystemDirectoryEntry, fileList);
          } else {
            const file = item.getAsFile();
            if (file) fileList.push(file);
          }
        }
      }

      const processed = await processFiles(fileList);
      setFiles(processed);
      
      if (processed.length === 0) {
        addMessage('assistant', "I couldn't find any text files in what you dropped. I can read .txt, .md, .docx, and similar files. Could you try again?");
        setStep('welcome');
        setIsProcessing(false);
        return;
      }

      addMessage('assistant', `Found ${processed.length} files. Let me take a look...`);
      
      // Start classification
      await classifyFiles(processed);
    } catch (err) {
      console.error('Drop error:', err);
      setError('Failed to read files. Please try again.');
      setStep('welcome');
      setIsProcessing(false);
    }
  }, [openRouterKey, addMessage]);

  // Read directory recursively
  async function readDirectoryEntry(entry: FileSystemDirectoryEntry, fileList: File[]): Promise<void> {
    const reader = entry.createReader();
    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });

    for (const e of entries) {
      if (e.isDirectory) {
        await readDirectoryEntry(e as FileSystemDirectoryEntry, fileList);
      } else {
        const file = await new Promise<File>((resolve, reject) => {
          (e as FileSystemFileEntry).file(resolve, reject);
        });
        fileList.push(file);
      }
    }
  }

  // Handle folder picker
  const handlePickFolder = async () => {
    if (!openRouterKey) {
      setError('Please add your OpenRouter API key in Settings first.');
      return;
    }

    try {
      setStep('reading');
      setIsProcessing(true);
      addMessage('system', 'Reading your folder...');
      
      const processed = await pickFolder();
      setFiles(processed);
      
      if (processed.length === 0) {
        addMessage('assistant', "I couldn't find any text files in that folder. I can read .txt, .md, .docx, and similar files.");
        setStep('welcome');
        setIsProcessing(false);
        return;
      }

      addMessage('assistant', `Found ${processed.length} files. Analyzing...`);
      await classifyFiles(processed);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Folder picker error:', err);
        setError(err.message || 'Failed to read folder.');
      }
      setStep('welcome');
      setIsProcessing(false);
    }
  };

  // Classify all files
  const classifyFiles = async (filesToClassify: DroppedFile[]) => {
    setStep('classifying');
    const model = modelPreferences.analysis;
    const classified: ClassifiedFile[] = [];

    for (let i = 0; i < filesToClassify.length; i++) {
      setProgress(`Analyzing file ${i + 1} of ${filesToClassify.length}: ${filesToClassify[i].name}`);
      
      try {
        const result = await classifyFile(openRouterKey!, filesToClassify[i], model);
        classified.push(result);
      } catch (err) {
        console.error(`Failed to classify ${filesToClassify[i].name}:`, err);
        classified.push({
          ...filesToClassify[i],
          classification: 'unknown',
          confidence: 0,
          summary: 'Failed to analyze',
          extractedEntities: { characters: [], locations: [], concepts: [] },
        });
      }
    }

    setClassifiedFiles(classified);
    setProgress('');

    // Now analyze the whole project
    setStep('analyzing');
    addMessage('assistant', "I've read all your files. Now let me piece together the big picture...");

    try {
      const projectAnalysis = await analyzeProject(
        openRouterKey!,
        classified,
        model,
        setProgress
      );
      setAnalysis(projectAnalysis);
      setProgress('');
      
      // Move to summary
      setStep('summary');
      setIsProcessing(false);
      presentSummary(projectAnalysis);
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze project. Please try again.');
      setStep('welcome');
      setIsProcessing(false);
    }
  };

  // Present the summary
  const presentSummary = (analysis: IngestionAnalysis) => {
    const chapterCount = analysis.structureGuess.chapters.length;
    const completeChapters = analysis.structureGuess.chapters.filter(c => c.status === 'complete').length;
    const partialChapters = analysis.structureGuess.chapters.filter(c => c.status === 'partial').length;
    
    addMessage('assistant', `Here's what I found:`);
    
    // Add summary card as a component message
    addMessage('assistant', '', (
      <div className="bg-paper-100 rounded-lg p-4 space-y-3 my-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink-900">{analysis.totalWords.toLocaleString()}</div>
              <div className="text-sm text-ink-500">words of prose</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink-900">{chapterCount}</div>
              <div className="text-sm text-ink-500">chapters found</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink-900">{analysis.characters.length}</div>
              <div className="text-sm text-ink-500">characters</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="text-2xl font-semibold text-ink-900">{analysis.locations.length}</div>
              <div className="text-sm text-ink-500">locations</div>
            </div>
          </div>
        </div>
        {analysis.genre && (
          <div className="pt-2 border-t border-paper-300">
            <span className="text-sm text-ink-500">Genre: </span>
            <span className="text-sm font-medium text-ink-700">{analysis.genre}</span>
          </div>
        )}
      </div>
    ));

    // Mention structure status
    if (completeChapters > 0 || partialChapters > 0) {
      addMessage('assistant', 
        `Of those chapters: ${completeChapters} look complete, ${partialChapters} are partial or cut off mid-scene.`
      );
    }

    // If there are questions, transition to interview
    if (analysis.questions.length > 0 || analysis.possibleDuplicates.length > 0) {
      setTimeout(() => {
        addMessage('assistant', "I have a few questions to make sure I understand everything correctly. Ready?");
        setStep('questions');
      }, 1000);
    } else {
      setTimeout(() => {
        addMessage('assistant', "Everything looks pretty clear! Let's give your project a name and I'll set it up.");
        setStep('confirm');
      }, 1000);
    }
  };

  // Handle question answers
  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
    addMessage('user', answer);
    
    // Find next unanswered question
    const unansweredQuestions = analysis?.questions.filter(q => !answers[q.id] && q.id !== questionId) || [];
    
    if (unansweredQuestions.length > 0) {
      setTimeout(() => {
        const next = unansweredQuestions[0];
        addMessage('assistant', next.question);
      }, 500);
    } else {
      // All questions answered
      setTimeout(() => {
        addMessage('assistant', "Perfect, I've got what I need. Let's give your project a name.");
        setStep('confirm');
      }, 500);
    }
  };

  // Build the project
  const buildProject = async () => {
    if (!projectName.trim() || !analysis) return;
    
    setStep('building');
    setIsProcessing(true);
    addMessage('system', 'Building your project...');

    try {
      // Create project
      const project: Project = {
        id: crypto.randomUUID(),
        name: projectName.trim(),
        genre: analysis.genre || 'Fiction',
        status: 'drafting',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          preferredModels: modelPreferences,
        },
      };

      await saveProject(project);

      // Create codex entries for characters
      setProgress('Creating characters...');
      for (const char of analysis.characters.slice(0, 20)) { // Limit to top 20
        const entry: CodexEntry & { projectId: string } = {
          id: crypto.randomUUID(),
          projectId: project.id,
          type: 'character',
          name: char.name,
          aliases: char.aliases,
          description: char.description || '',
          attributes: {
            role: char.role || 'unknown',
            mentions: String(char.mentions),
          },
          relationships: [],
          tags: [],
        };
        await db.codex.put(entry);
      }

      // Create codex entries for locations
      setProgress('Creating locations...');
      for (const loc of analysis.locations.slice(0, 15)) {
        const entry: CodexEntry & { projectId: string } = {
          id: crypto.randomUUID(),
          projectId: project.id,
          type: 'location',
          name: loc.name,
          aliases: [],
          description: loc.description || '',
          attributes: {},
          relationships: [],
          tags: [],
        };
        await db.codex.put(entry);
      }

      // Create chapters and import content
      setProgress('Importing chapters...');
      for (const chapter of analysis.structureGuess.chapters) {
        const chapterEntry = {
          id: crypto.randomUUID(),
          projectId: project.id,
          number: chapter.number || 0,
          title: chapter.title || `Chapter ${chapter.number || '?'}`,
          scenes: [],
          summary: undefined,
        };
        await db.chapters.put(chapterEntry);

        // Create scene with the content
        const chapterFile = classifiedFiles.find(f => chapter.files.includes(f.name));
        if (chapterFile) {
          const scene = {
            id: crypto.randomUUID(),
            projectId: project.id,
            chapterId: chapterEntry.id,
            number: 1,
            goal: chapterFile.summary || 'Imported scene',
            status: chapter.status === 'complete' ? 'drafted' as const : 'planned' as const,
            content: chapterFile.content,
            wordCount: countWords(chapterFile.content),
            issues: [],
          };
          await db.scenes.put(scene);
        }
      }

      setProgress('');
      setStep('complete');
      setIsProcessing(false);
      
      addMessage('assistant', `Your project "${projectName}" is ready! I've imported ${analysis.structureGuess.chapters.length} chapters and created entries for ${analysis.characters.length} characters and ${analysis.locations.length} locations.`);
      
      // Callback to parent
      setTimeout(() => {
        onComplete(project.id);
      }, 2000);

    } catch (err) {
      console.error('Build error:', err);
      setError('Failed to create project. Please try again.');
      setStep('confirm');
      setIsProcessing(false);
    }
  };

  // Render current question
  const renderCurrentQuestion = () => {
    if (!analysis || step !== 'questions') return null;
    
    const unanswered = analysis.questions.filter(q => !answers[q.id]);
    if (unanswered.length === 0) return null;
    
    const q = unanswered[0];
    
    return (
      <div className="space-y-3 mt-4">
        {q.options ? (
          <div className="flex flex-wrap gap-2">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => handleAnswer(q.id, opt)}
                className="btn-secondary"
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            placeholder="Type your answer..."
            className="input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                handleAnswer(q.id, e.currentTarget.value.trim());
                e.currentTarget.value = '';
              }
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-paper-200">
        <h1 className="font-serif text-xl font-semibold text-ink-900">New Project</h1>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Welcome state */}
          {step === 'welcome' && messages.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-accent" />
              </div>
              <h2 className="font-serif text-2xl font-semibold text-ink-900 mb-2">
                What are we working with?
              </h2>
              <p className="text-ink-500 mb-8 max-w-md mx-auto">
                Do you have existing materials for this novel, or are we starting fresh?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <div
                  ref={dropZoneRef}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setStep('dropping'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setStep('welcome'); }}
                  onDrop={handleDrop}
                  className="page-card p-8 cursor-pointer hover:shadow-page-hover transition-all group"
                  onClick={handlePickFolder}
                >
                  <Upload className="w-8 h-8 text-accent mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-ink-900">I have files</div>
                  <div className="text-sm text-ink-500 mt-1">Drop folder or click to browse</div>
                </div>
                
                <div 
                  className="page-card p-8 cursor-pointer hover:shadow-page-hover transition-all group"
                  onClick={() => {
                    addMessage('assistant', "Starting fresh! Let's begin with the basics. What's your story about?");
                    setStep('confirm');
                  }}
                >
                  <FileText className="w-8 h-8 text-accent mx-auto mb-3 group-hover:scale-110 transition-transform" />
                  <div className="font-medium text-ink-900">Starting fresh</div>
                  <div className="text-sm text-ink-500 mt-1">Begin with a blank slate</div>
                </div>
              </div>
            </div>
          )}

          {/* Drop zone active state */}
          {step === 'dropping' && (
            <div 
              className="border-2 border-dashed border-accent rounded-xl p-12 text-center animate-pulse"
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setStep('welcome'); }}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-accent mx-auto mb-4" />
              <div className="text-lg font-medium text-accent">Drop your files here</div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'animate-slide-up',
                msg.type === 'user' && 'flex justify-end',
                msg.type === 'system' && 'flex justify-center'
              )}
            >
              {msg.type === 'assistant' && (
                <div className="flex gap-3 max-w-lg">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-paper-50" />
                  </div>
                  <div>
                    {msg.content && <p className="text-ink-800">{msg.content}</p>}
                    {msg.component}
                  </div>
                </div>
              )}
              {msg.type === 'user' && (
                <div className="bg-accent text-paper-50 px-4 py-2 rounded-2xl rounded-br-sm max-w-xs">
                  {msg.content}
                </div>
              )}
              {msg.type === 'system' && (
                <div className="flex items-center gap-2 text-sm text-ink-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {msg.content}
                </div>
              )}
            </div>
          ))}

          {/* Progress indicator */}
          {isProcessing && progress && (
            <div className="flex items-center gap-2 text-sm text-ink-400 animate-fade-in">
              <Loader2 className="w-4 h-4 animate-spin" />
              {progress}
            </div>
          )}

          {/* Current question input */}
          {step === 'questions' && !isProcessing && analysis && (
            <div className="animate-slide-up">
              {messages.length > 0 && !analysis.questions.some(q => !answers[q.id]) ? null : (
                <>
                  {analysis.questions.filter(q => !answers[q.id]).length > 0 && 
                    messages[messages.length - 1]?.content !== analysis.questions.filter(q => !answers[q.id])[0]?.question && (
                      <div className="flex gap-3 max-w-lg mb-4">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-paper-50" />
                        </div>
                        <p className="text-ink-800">
                          {analysis.questions.filter(q => !answers[q.id])[0]?.question}
                        </p>
                      </div>
                    )
                  }
                  {renderCurrentQuestion()}
                </>
              )}
            </div>
          )}

          {/* Confirm / Name input */}
          {step === 'confirm' && !isProcessing && (
            <div className="animate-slide-up space-y-4">
              <div className="flex gap-3 max-w-lg">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-paper-50" />
                </div>
                <p className="text-ink-800">What would you like to call this project?</p>
              </div>
              <div className="flex gap-3 ml-11">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="The Great American Novel"
                  className="input flex-1"
                  autoFocus
                />
                <button
                  onClick={buildProject}
                  disabled={!projectName.trim()}
                  className="btn-primary"
                >
                  <Check className="w-4 h-4" />
                  Create
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg animate-slide-up">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                Dismiss
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
}
