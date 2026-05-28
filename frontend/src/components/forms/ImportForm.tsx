import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import { fsmAPI } from '../../api/endpoints/fsms';
import type { FSMCreate } from '../../types/fsm';
import { cn } from '../../utils/cn';

interface ImportPreview {
  name: string;
  stateCount: number;
  transitionCount: number;
  fsmType: string;
}

interface ImportFormProps {
  onSuccess: (fsmId: string) => void;
  onCancel: () => void;
}

function parseAndValidate(raw: string): { payload: FSMCreate; preview: ImportPreview } {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON — the file could not be parsed.');
  }

  // Accept both raw FSMCreate shape and a wrapped { data: FSMCreate } envelope
  const data = (json as { data?: Record<string, unknown> }).data ?? json;

  const states = data.states;
  if (!Array.isArray(states) || states.length === 0) {
    throw new Error('Missing or empty "states" array in the JSON file.');
  }

  const transitions = data.transitions;
  if (!Array.isArray(transitions)) {
    throw new Error('Missing "transitions" array in the JSON file.');
  }

  const name = typeof data.name === 'string' && data.name.trim()
    ? data.name.trim()
    : 'Imported FSM';

  const fsm_type =
    data.fsm_type === 'mealy' ? 'mealy' : 'moore';

  const initial_state =
    typeof data.initial_state === 'string' && data.initial_state
      ? data.initial_state
      : (states[0] as string);

  const payload: FSMCreate = {
    name,
    description: typeof data.description === 'string' ? data.description : undefined,
    fsm_type,
    states: states as string[],
    initial_state,
    transitions: transitions as FSMCreate['transitions'],
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    visibility:
      data.visibility === 'public' || data.visibility === 'unlisted'
        ? data.visibility
        : 'private',
  };

  const preview: ImportPreview = {
    name,
    stateCount: states.length,
    transitionCount: transitions.length,
    fsmType: fsm_type,
  };

  return { payload, preview };
}

export default function ImportForm({ onSuccess, onCancel }: ImportFormProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [parsedPayload, setParsedPayload] = useState<FSMCreate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    setPreview(null);
    setParsedPayload(null);

    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setError('Only .json files are supported.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      try {
        const { payload, preview } = parseAndValidate(raw);
        setPreview(preview);
        setParsedPayload(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file.');
      }
    };
    reader.onerror = () => setError('Could not read the file.');
    reader.readAsText(file);
  }, []);

  // ---- Drag handlers ----

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ---- File input fallback ----

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      // Reset value so selecting the same file again triggers onChange
      e.target.value = '';
    },
    [processFile],
  );

  // ---- Import action ----

  const handleImport = useCallback(async () => {
    if (!parsedPayload) return;
    setIsImporting(true);
    setError(null);
    try {
      const result = await fsmAPI.create(parsedPayload);
      const fsmData = (result as unknown as { data: { id: string } })?.data ?? result;
      const fsmId = (fsmData as { id: string }).id;
      onSuccess(fsmId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to import FSM. Please try again.',
      );
    } finally {
      setIsImporting(false);
    }
  }, [parsedPayload, onSuccess]);

  return (
    <div className="space-y-4" data-testid="import-form">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors select-none',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-rule-strong hover:border-gray-400 bg-paper-shade',
        )}
        data-testid="import-dropzone"
      >
        <svg
          className={cn('w-10 h-10', isDragging ? 'text-blue-500' : 'text-ink-faint')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium text-ink-soft">
            {isDragging ? 'Drop your file here' : 'Drag & drop a JSON file'}
          </p>
          <p className="text-xs text-ink-faint mt-1">
            or <span className="text-accent underline">browse</span> to select
          </p>
        </div>
        <p className="text-xs text-ink-faint">Accepts .json files</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={handleFileChange}
        data-testid="import-file-input"
      />

      {/* Error alert */}
      {error && (
        <div
          className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md px-4 py-3"
          data-testid="import-error"
          role="alert"
        >
          <svg
            className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Preview card */}
      {preview && (
        <div
          className="bg-green-50 border border-green-200 rounded-md px-4 py-3 space-y-2"
          data-testid="import-preview"
        >
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
            File parsed successfully
          </p>
          <table className="w-full text-sm text-ink-soft">
            <tbody>
              <tr>
                <td className="py-0.5 font-medium text-ink-faint w-32">Name</td>
                <td className="py-0.5 font-semibold text-ink">{preview.name}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-ink-faint">Type</td>
                <td className="py-0.5 capitalize">{preview.fsmType}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-ink-faint">States</td>
                <td className="py-0.5">{preview.stateCount}</td>
              </tr>
              <tr>
                <td className="py-0.5 font-medium text-ink-faint">Transitions</td>
                <td className="py-0.5">{preview.transitionCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleImport}
          disabled={!parsedPayload || isImporting}
          data-testid="import-submit"
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
        >
          {isImporting ? 'Importing...' : 'Import FSM'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-testid="import-cancel"
          className="px-4 py-2 text-sm font-medium text-ink-soft bg-paper border border-rule-strong rounded-md hover:bg-paper-shade focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
