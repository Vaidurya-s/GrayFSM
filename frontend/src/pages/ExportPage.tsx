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
  Badge,
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

function fsmTypeBadgeVariant(type: string) {
  return type === 'moore' ? ('info' as const) : ('default' as const);
}

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
        <h2 className="text-sm font-semibold text-gray-900">Export Options</h2>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Module / entity name — only for HDL-family */}
        {hdl && (
          <div>
            <label
              htmlFor="module-name"
              className="block text-xs font-medium text-gray-700 mb-1"
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
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="include-comments" className="text-sm text-gray-700">
              Include comments
            </label>
          </div>
        )}

        {/* Code style — only for HDL */}
        {hdl && (
          <div>
            <label
              htmlFor="code-style"
              className="block text-xs font-medium text-gray-700 mb-1"
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
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="verbose">Verbose (with explanations)</option>
            </select>
          </div>
        )}

        {/* Format-specific notes */}
        {format === 'testbench' && (
          <p className="text-xs text-gray-500 leading-relaxed">
            Generates a Verilog testbench that exercises all state transitions
            with automatic pass/fail assertions.
          </p>
        )}
        {format === 'json' && (
          <p className="text-xs text-gray-500 leading-relaxed">
            Machine-readable JSON definition suitable for re-import or
            processing with other tools.
          </p>
        )}
        {format === 'csv' && (
          <p className="text-xs text-gray-500 leading-relaxed">
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
    <div className="relative font-mono text-sm leading-relaxed overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} className="hover:bg-gray-800/40 group">
              <td
                className="select-none text-right pr-4 pl-4 py-0 text-gray-500 text-xs w-12 shrink-0 border-r border-gray-700"
                aria-hidden="true"
              >
                {idx + 1}
              </td>
              <td className="pl-4 pr-4 py-0 text-green-300 whitespace-pre">
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

  // Sync module name from FSM name once loaded
  const fsm = fsmData as any;
  const fsmName: string =
    (fsm?.data?.name ?? fsm?.name ?? '') as string;

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
        <p className="text-sm text-gray-500">Loading FSM…</p>
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
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      data-testid="export-page"
    >
      {/* ---- Header ---- */}
      <div className="mb-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-2" aria-label="Breadcrumb">
          <Link to={ROUTES.HOME} className="hover:text-gray-700 transition-colors">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link to={editorHref} className="hover:text-gray-700 transition-colors">
            Editor
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-gray-900 font-medium">Export</span>
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {fsmName || 'Export FSM'}
          </h1>
          <Badge variant={fsmTypeBadgeVariant(fsmType)}>
            {fsmType === 'moore' ? 'Moore' : 'Mealy'}
          </Badge>
          {optimized && (
            <Badge variant="success">Optimized</Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Export to Verilog, VHDL, JSON, CSV, or a Verilog testbench.
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
                  {/* Preview toolbar */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-500 font-mono">
                      {exportResult
                        ? exportResult.file_name
                        : `output${fmt.extension}`}
                    </span>
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

                  {/* Code preview */}
                  <div
                    className="bg-gray-900 rounded-b-lg min-h-[420px] overflow-auto"
                    data-testid="export-preview"
                  >
                    {exportResult ? (
                      <CodePreview content={exportResult.content} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
                        <svg
                          className="h-12 w-12 opacity-40"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        <p className="text-sm text-gray-400 text-center px-6">
                          Configure options and click{' '}
                          <span className="font-semibold text-gray-300">
                            Generate Export
                          </span>{' '}
                          to preview the {fmt.label} code.
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

          {/* Quick tips */}
          <Card className="mt-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">Tips</p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside leading-relaxed">
              <li>Use <strong>Verilog</strong> for Xilinx / Vivado synthesis.</li>
              <li>Use <strong>VHDL</strong> for Intel Quartus or GHDL simulation.</li>
              <li><strong>Testbench</strong> wires up your module and auto-checks transitions.</li>
              <li><strong>JSON</strong> lets you re-import or diff versions.</li>
              {optimized && (
                <li className="text-green-600">
                  Exporting the <strong>optimized</strong> variant (Gray code encoding applied).
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
