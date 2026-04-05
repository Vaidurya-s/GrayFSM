import { useState } from 'react';
import { mermaidToFSM } from '../../utils/mermaid';
import type { ParsedFSM } from '../../utils/mermaid';

type ActiveTab = 'file' | 'mermaid';

interface ImportFormProps {
  /** Called when the user confirms an import. */
  onImport?: (parsed: ParsedFSM) => void;
  /** Called when the user uploads a JSON file with FSM data. */
  onFileImport?: (content: string, fileName: string) => void;
}

export default function ImportForm({ onImport, onFileImport }: ImportFormProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('file');
  const [mermaidText, setMermaidText] = useState('');
  const [parsed, setParsed] = useState<ParsedFSM | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Mermaid tab handlers
  // -------------------------------------------------------------------------

  const handleMermaidChange = (text: string) => {
    setMermaidText(text);
    // Clear previous results when the text changes
    setParsed(null);
    setParseError(null);
  };

  const handleParse = () => {
    setParseError(null);
    setParsed(null);
    try {
      const result = mermaidToFSM(mermaidText);
      setParsed(result);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse diagram.');
    }
  };

  const handleImportMermaid = () => {
    if (!parsed) return;
    onImport?.(parsed);
  };

  // -------------------------------------------------------------------------
  // File tab handlers
  // -------------------------------------------------------------------------

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['.json', '.csv'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowed.includes(ext)) {
      setFileError(`Unsupported file type "${ext}". Only .json and .csv are accepted.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        onFileImport?.(content, file.name);
      }
    };
    reader.onerror = () => setFileError('Failed to read the file.');
    reader.readAsText(file);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-4" data-testid="import-form">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          data-testid="import-tab-file"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'file'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('mermaid')}
          data-testid="import-tab-mermaid"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'mermaid'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Paste Mermaid
        </button>
      </div>

      {/* File upload tab */}
      {activeTab === 'file' && (
        <div className="space-y-3" data-testid="import-file-panel">
          <p className="text-sm text-gray-600">
            Upload a previously exported FSM file (.json or .csv).
          </p>
          <label className="block">
            <span className="sr-only">Choose file</span>
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileChange}
              data-testid="import-file-input"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
          </label>
          {fileError && (
            <div
              className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800"
              data-testid="import-file-error"
            >
              {fileError}
            </div>
          )}
        </div>
      )}

      {/* Mermaid paste tab */}
      {activeTab === 'mermaid' && (
        <div className="space-y-3" data-testid="import-mermaid-panel">
          <p className="text-sm text-gray-600">
            Paste a Mermaid <code className="font-mono text-xs bg-gray-100 px-1 rounded">stateDiagram-v2</code> diagram to import it as an FSM.
          </p>

          <textarea
            value={mermaidText}
            onChange={(e) => handleMermaidChange(e.target.value)}
            placeholder={`stateDiagram-v2\n    [*] --> S0\n    S0 --> S1 : clk\n    S1 --> S0 : reset`}
            rows={10}
            data-testid="import-mermaid-textarea"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-mono focus:ring-blue-500 focus:border-blue-500 resize-y"
            spellCheck={false}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleParse}
              disabled={!mermaidText.trim()}
              data-testid="import-mermaid-parse"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Parse
            </button>
            {parsed && (
              <button
                type="button"
                onClick={handleImportMermaid}
                data-testid="import-mermaid-confirm"
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Import FSM
              </button>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div
              className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800"
              data-testid="import-mermaid-error"
            >
              <strong>Parse error:</strong> {parseError}
            </div>
          )}

          {/* Parsed preview */}
          {parsed && (
            <div
              className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3"
              data-testid="import-mermaid-preview"
            >
              <h3 className="text-sm font-semibold text-green-900">Parsed Successfully</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    FSM Name
                  </p>
                  <p className="text-gray-900">{parsed.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Initial State
                  </p>
                  <p className="text-gray-900">{parsed.initialState}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  States ({parsed.states.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {parsed.states.map((s) => (
                    <span
                      key={s.name}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {s.name}
                      {s.output !== undefined && (
                        <span className="ml-1 text-blue-500">/{s.output}</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Transitions ({parsed.transitions.length})
                </p>
                <ul className="space-y-0.5 max-h-32 overflow-y-auto">
                  {parsed.transitions.map((t, i) => (
                    <li key={i} className="text-xs text-gray-700 font-mono">
                      {t.from_state} &rarr; {t.to_state}
                      {t.label ? ` : ${t.label}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
