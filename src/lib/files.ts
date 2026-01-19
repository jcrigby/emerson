// File reading utilities for ingestion
import mammoth from 'mammoth';

export interface DroppedFile {
  name: string;
  path: string;
  type: string;
  size: number;
  content: string;
  lastModified: Date;
}

// Read text content from various file types
export async function readFileContent(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  
  // Plain text files
  if (['txt', 'md', 'markdown'].includes(ext || '')) {
    return file.text();
  }
  
  // For docx, use mammoth for proper extraction
  if (ext === 'docx') {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (err) {
      console.error('Mammoth error:', err);
      // Fallback to naive extraction
      const arrayBuffer = await file.arrayBuffer();
      return extractDocxTextFallback(arrayBuffer);
    }
  }
  
  // Default: try as text
  try {
    return await file.text();
  } catch {
    return `[Could not read file: ${file.name}]`;
  }
}

// Fallback docx text extraction (naive)
function extractDocxTextFallback(arrayBuffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
  
  // Try to find readable text between XML tags
  const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (matches) {
    return matches
      .map(m => m.replace(/<[^>]+>/g, ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50000);
}

// Process a FileList or array of Files from drag/drop or file picker
export async function processFiles(files: FileList | File[]): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];
  const fileArray = Array.from(files);
  
  for (const file of fileArray) {
    // Skip hidden files and system files
    if (file.name.startsWith('.') || file.name.startsWith('~')) continue;
    
    // Skip non-text files
    const ext = file.name.split('.').pop()?.toLowerCase();
    const textExtensions = ['txt', 'md', 'markdown', 'docx', 'doc', 'rtf', 'json', 'html', 'htm'];
    if (!textExtensions.includes(ext || '')) continue;
    
    try {
      const content = await readFileContent(file);
      results.push({
        name: file.name,
        path: (file as any).webkitRelativePath || file.name,
        type: ext || 'unknown',
        size: file.size,
        content,
        lastModified: new Date(file.lastModified),
      });
    } catch (err) {
      console.error(`Failed to read ${file.name}:`, err);
    }
  }
  
  return results;
}

// Use File System Access API to pick a folder (Chrome/Edge only)
export async function pickFolder(): Promise<DroppedFile[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('Folder picker not supported in this browser. Try Chrome or Edge, or drag and drop your files.');
  }
  
  const dirHandle = await (window as any).showDirectoryPicker();
  return readDirectory(dirHandle, '');
}

async function readDirectory(dirHandle: any, path: string): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];
  
  for await (const entry of dirHandle.values()) {
    const entryPath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'directory') {
      // Skip hidden directories and common non-content folders
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      
      const subResults = await readDirectory(entry, entryPath);
      results.push(...subResults);
    } else if (entry.kind === 'file') {
      // Skip hidden files
      if (entry.name.startsWith('.') || entry.name.startsWith('~')) continue;
      
      const ext = entry.name.split('.').pop()?.toLowerCase();
      const textExtensions = ['txt', 'md', 'markdown', 'docx', 'doc', 'rtf', 'json', 'html', 'htm'];
      if (!textExtensions.includes(ext || '')) continue;
      
      try {
        const file = await entry.getFile();
        const content = await readFileContent(file);
        results.push({
          name: entry.name,
          path: entryPath,
          type: ext || 'unknown',
          size: file.size,
          content,
          lastModified: new Date(file.lastModified),
        });
      } catch (err) {
        console.error(`Failed to read ${entryPath}:`, err);
      }
    }
  }
  
  return results;
}

// Count words in text
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

// Truncate content for AI analysis (to fit in context)
export function truncateForAnalysis(content: string, maxChars = 8000): string {
  if (content.length <= maxChars) return content;
  
  // Take beginning and end
  const half = Math.floor(maxChars / 2);
  return content.slice(0, half) + '\n\n[... content truncated ...]\n\n' + content.slice(-half);
}
