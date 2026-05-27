import { useState, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useToast } from '../components/ui';
import { useFSM } from '../hooks/useFSM';
import { useExportFSM } from '../hooks/useExport';
import { ROUTES, generateRoute } from '../config/routes';
import { EXPORT_FORMATS } from '../config/constants';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Tabs,
  TabPanel,
  Alert,
  Spinner,
  Kicktitle,
} from '../components/ui';
import type { ExportFormat, ExportResponse } from '../types/fsm';
import type { APIResponse } from '../api/client';
import type { AxiosResponse } from 'axios';

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //

type FormatId = ExportFormat['format'];

interface FormatOptions {
  moduleName: string;
  includeComments: boolean;
  style: 'standard' | 'compact' | 'verbose';
}

// ------------------------------------------------------------------ //
// Helpers
// ------------------------------------------------------------------ //

function fileExtension(format: FormatId): string {
  return EXPORT_FORMATS.find((f) => f.value === format)?.extension ?? `.${format}`;
}

function isHDLFormat(format: FormatId): boolean {
  return format === 'verilog' || format === 'vhdl' || format === 'testbench';
}

function defaultModuleName(fsmName: string): string {
  return fsmName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '') || 'fsm_module';
}

// ------------------------------------------------------------------ //
// Sub-components
// ------------------------------------------------------------------ //

interface OptionsPanelProps {
  format: FormatId;
  options: FormatOptions;
  onChange: (opts: Partial<FormatOptions>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

function OptionsPanel({
  format,
  options,
  onChange,
  onGenerate,
  isGenerating,
}: OptionsPanelProps) {
  const hdl = isHDLFormat(format);

  return (
    <Card className="sticky top-4">
      <CardHeader>
        <h2 className="text-sm font-semibold text-ink">Export Options</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Module / entity name — only for HDL-family */}
        {hdl && (
          <div>
            <label
              htmlFor="module-name"
              className="block text-xs font-medium text-ink mb-1"
            >
              {format === 'vhdl' ? 'Entity name' : 'Module name'}
            </label>
            <input
              id="module-name"
              type="text"
              value={options.moduleName}
              onChange={(e) => onChange({ moduleName: e.target.value })}
              data-testid="export-module-name"
              placeholder="fsm_module"
              className="w-full px-3 py-1.5 text-sm border border-rule-strong rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Include comments — for all text-based formats */}
        {format !== 'csv' && (
          <div className="flex items-center gap-2">
            <input
              id="include-comments"
              type="checkbox"
              checked={options.includeComments}
              onChange={(e) => onChange({ includeComments: e.target.checked })}
              data-testid="export-include-comments"
              className="rounded border-rule-strong text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="include-comments" className="text-sm text-ink">
              Include comments
            </label>
          </div>
        )}

        {/* Code style — only for HDL */}
        {hdl && (
          <div>
            <label
              htmlFor="code-style"
              className="block text-xs font-medium text-ink mb-1"
            >
              Code style
            </label>
            <select
              id="code-style"
              value={options.style}
              onChange={(e) =>
                onChange({ style: e.target.value as FormatOptions['style'] })
              }
              data-testid="export-style"
              className="w-full px-3 py-1.5 text-sm border border-rule-strong rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="verbose">Verbose (with explanations)</option>
            </select>
          </div>
        )}

        {/* Format-specific notes */}
        {format === 'testbench' && (
          <p className="text-xs text-ink-soft leading-relaxed">
            Generates a Verilog testbench that exercises all state transitions
            with automatic pass/fail assertions.
          </p>
        )}
        {format === 'json' && (
          <p className="text-xs text-ink-soft leading-relaxed">
            Machine-readable JSON definition suitable for re-import or
            processing with other tools.
          </p>
        )}
        {format === 'csv' && (
          <p className="text-xs text-ink-soft leading-relaxed">
            State transition table in CSV format — open directly in Excel or
            any spreadsheet application.
          </p>
        )}

        <Button
          variant="primary"
          size="md"
          loading={isGenerating}
          onClick={onGenerate}
          data-testid="export-submit"
          className="w-full"
        >
          {isGenerating ? 'Generating…' : 'Generate Export'}
        </Button>
      </CardBody>
    </Card>
  );
}

// ------------------------------------------------------------------ //
// Line-numbered code block
// ------------------------------------------------------------------ //

interface CodePreviewProps {
  content: string;
}

function CodePreview({ content }: CodePreviewProps) {
  const lines = content.split('\n');

  return (
    <div className="relative font-mono text-sm leading-relaxed overflow-x-auto bg-paper-deep">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-paper-shade/40 group">
              <td
                className="select-none text-right pr-4 pl-4 py-0 text-ink-faint font-tabular text-xs w-12 shrink-0 border-r border-rule"
                aria-hidden="true"
              >
                {idx + 1}
              </td>
              <td className="pl-4 pr-4 py-0 text-ink whitespace-pre">
                {line || ' '}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ //
// Main page
// ------------------------------------------------------------------ //

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const optimized = searchParams.get('optimized') === 'true';

  const { data: fsmData, isLoading, error } = useFSM(id);
  const exportMutation = useExportFSM();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeFormat, setActiveFormat] = useState<FormatId>('verilog');
  const [options, setOptions] = useState<FormatOptions>({
    moduleName: '',
    includeComments: true,
    style: 'standard',
  });
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync module name from FSM name once loaded. The query may resolve
  // to either the bare FSM or a {data: FSM} envelope depending on which
  // client method ran — narrow both shapes here to avoid an `as any`.
  type FsmFragment = { name?: string; fsm_type?: string };
  const fsm = fsmData as (FsmFragment & { data?: FsmFragment }) | undefined;
  const fsmName: string = fsm?.data?.name ?? fsm?.name ?? '';

  // If moduleName still blank and we now have a name, fill it in
  const resolvedModuleName = options.moduleName || defaultModuleName(fsmName);

  const handleOptionsChange = useCallback((patch: Partial<FormatOptions>) => {
    setOptions((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleFormatChange = (format: string) => {
    setActiveFormat(format as FormatId);
    setExportResult(null);
  };

  const handleGenerate = async () => {
    if (!id) return;
    try {
      const request = {
        format: activeFormat,
        options: {
          module_name: isHDLFormat(activeFormat) ? resolvedModuleName : undefined,
          include_comments: options.includeComments,
          style: isHDLFormat(activeFormat) ? options.style : undefined,
        },
      };
      const response = await exportMutation.mutateAsync({ fsmId: id, request });
      // The axios interceptor returns the full AxiosResponse at runtime;
      // unwrap the envelope: response.data.data
      const axiosResp = response as unknown as AxiosResponse<APIResponse<ExportResponse>>;
      const result: ExportResponse =
        axiosResp.data?.data ?? (response as unknown as ExportResponse);
      setExportResult(result);
      toastSuccess('Export generated successfully');
    } catch {
      toastError('Export failed');
    }
  };

  const handleCopy = async () => {
    if (!exportResult) return;
    try {
      await navigator.clipboard.writeText(exportResult.content);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toastSuccess('Copied to clipboard');
    } catch {
      toastError('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!exportResult) return;
    const blob = new Blob([exportResult.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      exportResult.file_name ||
      `${resolvedModuleName}${fileExtension(activeFormat)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastSuccess('File downloaded');
  };

  // ----------------------------------------------------------------
  // States: no ID, loading, error
  // ----------------------------------------------------------------

  if (!id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Alert variant="warning" title="No FSM selected">
          Please open an FSM from the{' '}
          <Link to={ROUTES.HOME} className="underline font-medium">
            home page
          </Link>{' '}
          or{' '}
          <Link to={ROUTES.EDITOR} className="underline font-medium">
            editor
          </Link>{' '}
          before exporting.
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-sm text-ink-soft">Loading FSM…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <Alert variant="error" title="Failed to load FSM">
          {error instanceof Error ? error.message : 'An unexpected error occurred.'}
        </Alert>
        <Link to={ROUTES.HOME}>
          <Button variant="secondary" size="sm">
            Go Home
          </Button>
        </Link>
      </div>
    );
  }

  const fsmType: string = (fsm?.data?.fsm_type ?? fsm?.fsm_type ?? 'moore') as string;
  const editorHref = id
    ? generateRoute(ROUTES.EDITOR_EDIT, { id })
    : ROUTES.EDITOR;

  // ----------------------------------------------------------------
  // Main render
  // ----------------------------------------------------------------

  return (
    <div
      className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-10 bg-paper text-ink min-h-screen"
      data-testid="export-page"
    >
      {/* ---- Header ---- */}
      <div className="mb-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint mb-3"
        >
          <Link to={ROUTES.HOME} className="hover:text-accent transition-colors">
            Catalog
          </Link>
          <span>›</span>
          <Link to={editorHref} className="hover:text-accent transition-colors">
            Editor
          </Link>
          <span>›</span>
          <span className="text-ink">Export</span>
        </nav>

        <Kicktitle number="6" className="mb-2">
          Export
        </Kicktitle>
        <div className="flex flex-wrap items-center gap-3 pb-3 border-b-[2px] border-ink">
          <h1 className="font-sans text-3xl sm:text-4xl font-semibold tracking-tight text-ink">
            {fsmName || 'Export specification'}
          </h1>
          <span className="font-mono text-[0.78rem] uppercase tracking-[0.05em] text-accent">
            {fsmType?.toUpperCase() ?? '—'}
          </span>
          {optimized && (
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.08em] border border-ok text-ok px-2 py-[0.1rem]">
              OPTIMISED
            </span>
          )}
        </div>
        <p className="mt-3 font-serif italic text-ink-soft text-base leading-relaxed max-w-[44rem]">
          Emit Verilog, VHDL, JSON, CSV, or a Verilog testbench. The
          optimised state encoding is preserved exactly.
        </p>
      </div>

      {/* ---- Body: two-column on lg+ ---- */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ---- Left: format tabs + preview ---- */}
        <div className="flex-1 min-w-0">
          <Card>
            {/* Format selection via Tabs */}
            <Tabs
              tabs={EXPORT_FORMATS.map((fmt) => ({ value: fmt.value, label: fmt.label }))}
              value={activeFormat}
              onChange={handleFormatChange}
            >
              {/* Preview area — shared across all tab panels */}
              {EXPORT_FORMATS.map((fmt) => (
                <TabPanel key={fmt.value} value={fmt.value} activeValue={activeFormat}>
                  {/* Preview toolbar — datasheet status bar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-rule bg-paper-shade">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-ink-faint">
                        File
                      </span>
                      <span className="text-xs text-ink font-mono">
                        {exportResult
                          ? exportResult.file_name
                          : `output${fmt.extension}`}
                      </span>
                    </div>
                    {exportResult && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          data-testid="export-copy"
                          leftIcon={
                            copySuccess ? (
                              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : (
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                />
                              </svg>
                            )
                          }
                        >
                          {copySuccess ? 'Copied!' : 'Copy'}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleDownload}
                          data-testid="export-download"
                          leftIcon={
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                          }
                        >
                          Download {fmt.extension}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Code preview — datasheet code pane */}
                  <div
                    className="bg-paper-deep min-h-[420px] overflow-auto"
                    data-testid="export-preview"
                  >
                    {exportResult ? (
                      <CodePreview content={exportResult.content} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-ink-soft gap-3">
                        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-faint">
                          ⚐ pre-emit
                        </span>
                        <p className="font-serif italic text-sm text-ink-soft text-center px-6 max-w-md">
                          Configure options on the right and click{' '}
                          <span className="font-mono not-italic font-medium text-accent">
                            Generate Export
                          </span>{' '}
                          to emit the {fmt.label} preview.
                        </p>
                      </div>
                    )}
                  </div>
                </TabPanel>
              ))}
            </Tabs>
          </Card>

          {/* Export error */}
          {exportMutation.isError && (
            <Alert variant="error" title="Export failed" className="mt-4">
              {exportMutation.error instanceof Error
                ? exportMutation.error.message
                : 'The backend could not generate this export. Check that your FSM is valid.'}
            </Alert>
          )}
        </div>

        {/* ---- Right: options panel ---- */}
        <div className="w-full lg:w-72 shrink-0">
          <OptionsPanel
            format={activeFormat}
            options={{ ...options, moduleName: resolvedModuleName }}
            onChange={handleOptionsChange}
            onGenerate={handleGenerate}
            isGenerating={exportMutation.isPending}
          />

          {/* Quick tips — datasheet annotated list */}
          <div className="mt-4 border border-rule bg-paper p-4">
            <h3 className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-ink pb-1.5 border-b border-ink mb-3">
              Notes
            </h3>
            <ul className="font-serif text-[0.88rem] text-ink-soft leading-relaxed space-y-2 list-none">
              <li>
                <span className="font-mono not-italic text-accent mr-2">›</span>
                Use <strong className="font-mono not-italic font-medium">Verilog</strong> for Xilinx / Vivado synthesis.
              </li>
              <li>
                <span className="font-mono not-italic text-accent mr-2">›</span>
                Use <strong className="font-mono not-italic font-medium">VHDL</strong> for Intel Quartus or GHDL simulation.
              </li>
              <li>
                <span className="font-mono not-italic text-accent mr-2">›</span>
                <strong className="font-mono not-italic font-medium">Testbench</strong> wires up your module and auto-checks transitions.
              </li>
              <li>
                <span className="font-mono not-italic text-accent mr-2">›</span>
                <strong className="font-mono not-italic font-medium">JSON</strong> lets you re-import or diff versions.
              </li>
              {optimized && (
                <li className="text-ok">
                  <span className="font-mono not-italic mr-2">‡</span>
                  Exporting the <strong className="font-mono not-italic font-medium">optimised</strong> variant — Gray code encoding applied.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
