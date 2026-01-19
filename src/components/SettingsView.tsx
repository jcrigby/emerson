import { useState, useEffect } from 'react';
import { Key, Cpu, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store';
import { MODELS, DEFAULT_MODELS } from '@/lib/openrouter';
import clsx from 'clsx';

export function SettingsView() {
  const { openRouterKey, setOpenRouterKey, modelPreferences, setModelPreference } = useAppStore();
  const [keyInput, setKeyInput] = useState(openRouterKey || '');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [showKey, setShowKey] = useState(false);

  // Check if key is already set
  useEffect(() => {
    if (openRouterKey) {
      setKeyStatus('valid');
    }
  }, [openRouterKey]);

  const validateKey = async () => {
    if (!keyInput.trim()) return;
    
    setKeyStatus('checking');
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: {
          'Authorization': `Bearer ${keyInput}`,
        },
      });
      
      if (response.ok) {
        setOpenRouterKey(keyInput);
        setKeyStatus('valid');
      } else {
        setKeyStatus('invalid');
      }
    } catch {
      setKeyStatus('invalid');
    }
  };

  const clearKey = () => {
    setOpenRouterKey(null);
    setKeyInput('');
    setKeyStatus('idle');
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-6 animate-fade-in">
      <h1 className="font-serif text-3xl font-semibold text-ink-900 mb-2">Settings</h1>
      <p className="text-ink-500 mb-8">Configure your API keys and model preferences.</p>

      {/* API Key Section */}
      <section className="page-card p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-ink-900">OpenRouter API Key</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Required for AI generation. Get one at{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline inline-flex items-center gap-1"
              >
                openrouter.ai/keys
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value);
                  setKeyStatus('idle');
                }}
                placeholder="sk-or-v1-..."
                className="input input-sm pr-20 font-mono text-sm"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 hover:text-ink-600"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            {keyStatus === 'valid' ? (
              <button onClick={clearKey} className="btn-secondary">
                Clear
              </button>
            ) : (
              <button
                onClick={validateKey}
                disabled={!keyInput.trim() || keyStatus === 'checking'}
                className="btn-primary"
              >
                {keyStatus === 'checking' ? 'Checking...' : 'Save'}
              </button>
            )}
          </div>

          {/* Status indicator */}
          {keyStatus === 'valid' && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="w-4 h-4" />
              API key validated and saved
            </div>
          )}
          {keyStatus === 'invalid' && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" />
              Invalid API key. Please check and try again.
            </div>
          )}
        </div>
      </section>

      {/* Model Preferences Section */}
      <section className="page-card p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-ink-900">Model Preferences</h2>
            <p className="text-sm text-ink-500 mt-0.5">
              Choose which models to use for different tasks. Affects cost and quality.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Analysis Model */}
          <div>
            <label className="label">Analysis &amp; Extraction</label>
            <p className="text-xs text-ink-400 mb-2">Used for parsing, indexing, and continuity checks. Cheap and fast.</p>
            <select
              value={modelPreferences.analysis}
              onChange={(e) => setModelPreference('analysis', e.target.value)}
              className="input input-sm"
            >
              {Object.values(MODELS).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — ${(model.costPer1kInput * 1000).toFixed(2)}/1M in
                </option>
              ))}
            </select>
          </div>

          {/* Writing Model */}
          <div>
            <label className="label">Writing &amp; Prose</label>
            <p className="text-xs text-ink-400 mb-2">Used for drafting scenes. Quality matters here.</p>
            <select
              value={modelPreferences.writing}
              onChange={(e) => setModelPreference('writing', e.target.value)}
              className="input input-sm"
            >
              {Object.values(MODELS).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — ${(model.costPer1kOutput * 1000).toFixed(2)}/1M out
                </option>
              ))}
            </select>
          </div>

          {/* Brainstorm Model */}
          <div>
            <label className="label">Brainstorming &amp; Creative</label>
            <p className="text-xs text-ink-400 mb-2">Used for ideation and creative exploration. Maximum creativity.</p>
            <select
              value={modelPreferences.brainstorm}
              onChange={(e) => setModelPreference('brainstorm', e.target.value)}
              className="input input-sm"
            >
              {Object.values(MODELS).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} — ${(model.costPer1kOutput * 1000).toFixed(2)}/1M out
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reset button */}
        <div className="mt-6 pt-4 border-t border-paper-200">
          <button
            onClick={() => {
              setModelPreference('analysis', DEFAULT_MODELS.analysis);
              setModelPreference('writing', DEFAULT_MODELS.writing);
              setModelPreference('brainstorm', DEFAULT_MODELS.brainstorm);
            }}
            className="btn-ghost text-sm"
          >
            Reset to defaults
          </button>
        </div>
      </section>
    </div>
  );
}
