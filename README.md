# Emerson

AI-powered novel writing orchestration tool. A static PWA that runs entirely client-side.

## Features

- **Project Management** - Create and manage multiple novel projects
- **IndexedDB Storage** - All data stored locally in your browser
- **OpenRouter Integration** - BYOK (bring your own key) for AI generation
- **Model Selection** - Choose different models for analysis vs writing
- **PWA** - Install as an app, works offline

## Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Push this code to the `main` branch
3. Go to Settings → Pages → Source: GitHub Actions
4. The included workflow will auto-deploy on push

Or manually:

```bash
# Build with GitHub Pages base path
GITHUB_PAGES=true npm run build

# The dist/ folder is your deployable output
```

## Configuration

### OpenRouter API Key

1. Get an API key from [openrouter.ai/keys](https://openrouter.ai/keys)
2. Enter it in Settings within the app
3. Key is stored in localStorage (never sent anywhere except OpenRouter)

### Model Preferences

Choose models for different tasks:

- **Analysis** - Cheap, fast models for parsing and indexing (default: Gemini Flash)
- **Writing** - Quality models for prose generation (default: Claude Sonnet)
- **Brainstorm** - Creative models for ideation (default: Claude Opus)

## Tech Stack

- **Vite** - Build tool
- **React 18** - UI framework
- **TypeScript** - Tailwind CSS 3 - Styling
- **Zustand** - State management
- **Dexie** - IndexedDB wrapper
- **vite-plugin-pwa** - PWA generation

## Project Structure

```
src/
├── App.tsx              # Main app component
├── main.tsx             # Entry point
├── index.css            # Global styles + Tailwind
├── components/          # React components
│   ├── Sidebar.tsx
│   ├── DashboardView.tsx
│   ├── SettingsView.tsx
│   └── PlaceholderViews.tsx
├── lib/                 # Core libraries
│   ├── db.ts            # Dexie database
│   └── openrouter.ts    # API client
├── store/               # Zustand stores
│   └── index.ts
└── types/               # TypeScript types
    └── index.ts
```

## Roadmap

- [ ] Structure view (beat sheets, outlines)
- [ ] Codex view (characters, locations, world)
- [ ] Write view (scene drafting with context assembly)
- [ ] Analysis passes (continuity, foreshadowing)
- [ ] File System Access API for local folders
- [ ] GitHub sync for versioned backups

## License

MIT
