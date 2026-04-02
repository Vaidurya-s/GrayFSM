import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useFSM } from '../hooks/useFSM';
import { useExportFSM } from '../hooks/useExport';
import ExportForm from '../components/forms/ExportForm';
import { ROUTES } from '../config/routes';
import type { ExportRequest, ExportResponse } from '../types/fsm';
import type { APIResponse } from '../api/client';
import type { AxiosResponse } from 'axios';

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoading, error } = useFSM(id);
  const exportMutation = useExportFSM();

  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);

  const handleExport = async (request: ExportRequest) => {
    if (!id) return;
    try {
      const response = await exportMutation.mutateAsync({ fsmId: id, request });
      // At runtime response is AxiosResponse<APIResponse<ExportResponse>>,
      // so response.data is { success: true, data: ExportResponse }
      // and response.data.data is the actual ExportResponse
      const axiosResp = response as unknown as AxiosResponse<APIResponse<ExportResponse>>;
      const exportResult = axiosResp.data?.data ?? (response as unknown as ExportResponse);
      setExportResult(exportResult);
    } catch {
      // Error handled by React Query
    }
  };

  const handleDownload = () => {
    if (!exportResult) return;
    const blob = new Blob([exportResult.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.file_name || `export.${exportResult.format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!exportResult) return;
    try {
      await navigator.clipboard.writeText(exportResult.content);
    } catch {
      // Fallback: select text in the pre element
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
            <p className="mt-4 text-sm text-gray-600">Loading FSM...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !id) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800">
            {!id ? 'No FSM ID provided' : 'Failed to load FSM'}
          </h2>
          <p className="text-sm text-red-600 mt-2">
            {error instanceof Error ? error.message : 'Please select an FSM to export.'}
          </p>
          <Link
            to={ROUTES.HOME}
            className="mt-4 inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="export-page">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to={ROUTES.HOME} className="hover:text-gray-700">Home</Link>
          <span>/</span>
          <span className="text-gray-900">Export</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Export FSM</h1>
        <p className="text-sm text-gray-600 mt-1">
          Export your FSM to various hardware description languages and formats.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Export Form */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Export Settings
            </h2>
            <ExportForm
              onSubmit={handleExport}
              isLoading={exportMutation.isPending}
            />
            {exportMutation.isError && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">
                  Export failed.{' '}
                  {exportMutation.error instanceof Error
                    ? exportMutation.error.message
                    : 'The backend may not support this operation yet.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">
                {exportResult
                  ? `${exportResult.file_name} (${exportResult.format})`
                  : 'Code Preview'}
              </h2>
              {exportResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    data-testid="export-copy"
                    className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Copy
                  </button>
                  <button
                    onClick={handleDownload}
                    data-testid="export-download"
                    className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Download
                  </button>
                </div>
              )}
            </div>
            <div className="p-6 min-h-[400px]">
              {exportResult ? (
                <pre
                  className="bg-gray-900 text-green-400 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre-wrap leading-relaxed"
                  data-testid="export-preview"
                >
                  {exportResult.content}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <div className="text-center">
                    <svg
                      className="mx-auto h-12 w-12"
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
                    <p className="mt-4 text-sm">
                      Select a format and click "Generate Export" to preview the code.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
