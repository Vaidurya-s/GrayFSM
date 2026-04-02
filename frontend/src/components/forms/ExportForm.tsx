import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EXPORT_FORMATS } from '../../config/constants';
import type { ExportRequest } from '../../types/fsm';

const exportSchema = z.object({
  format: z.enum(['verilog', 'vhdl', 'json', 'csv', 'testbench']),
  module_name: z.string().optional(),
  include_comments: z.boolean().optional(),
  style: z.enum(['standard', 'compact', 'verbose']).optional(),
});

type ExportFormValues = z.infer<typeof exportSchema>;

interface ExportFormProps {
  onSubmit: (request: ExportRequest) => void;
  isLoading: boolean;
}

export default function ExportForm({ onSubmit, isLoading }: ExportFormProps) {
  const {
    register,
    handleSubmit,
    watch,
  } = useForm<ExportFormValues>({
    resolver: zodResolver(exportSchema),
    defaultValues: {
      format: 'verilog',
      module_name: '',
      include_comments: true,
      style: 'standard',
    },
  });

  const selectedFormat = watch('format');
  const showHDLOptions = selectedFormat === 'verilog' || selectedFormat === 'vhdl' || selectedFormat === 'testbench';

  const handleFormSubmit = (values: ExportFormValues) => {
    const request: ExportRequest = {
      format: values.format,
      options: {
        ...(values.module_name ? { module_name: values.module_name } : {}),
        include_comments: values.include_comments,
        style: values.style,
      },
    };
    onSubmit(request);
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-4"
      data-testid="export-form"
    >
      <div>
        <label htmlFor="format" className="block text-sm font-medium text-gray-700">
          Export Format
        </label>
        <div className="mt-2 grid grid-cols-1 gap-2">
          {EXPORT_FORMATS.map((fmt) => (
            <label
              key={fmt.value}
              className={`relative flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedFormat === fmt.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                {...register('format')}
                type="radio"
                value={fmt.value}
                className="sr-only"
                data-testid={`export-format-${fmt.value}`}
              />
              <div>
                <span className="block text-sm font-medium text-gray-900">
                  {fmt.label}
                </span>
                <span className="block text-xs text-gray-500">
                  {fmt.description} ({fmt.extension})
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {showHDLOptions && (
        <div className="space-y-3 border-t border-gray-200 pt-4">
          <div>
            <label htmlFor="module_name" className="block text-sm font-medium text-gray-700">
              Module Name
            </label>
            <input
              {...register('module_name')}
              id="module_name"
              type="text"
              data-testid="export-module-name"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="fsm_module"
            />
          </div>

          <div>
            <label htmlFor="style" className="block text-sm font-medium text-gray-700">
              Code Style
            </label>
            <select
              {...register('style')}
              id="style"
              data-testid="export-style"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="standard">Standard</option>
              <option value="compact">Compact</option>
              <option value="verbose">Verbose</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              {...register('include_comments')}
              id="include_comments"
              type="checkbox"
              data-testid="export-include-comments"
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="include_comments" className="text-sm text-gray-700">
              Include comments
            </label>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        data-testid="export-submit"
        className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Generating...' : 'Generate Export'}
      </button>
    </form>
  );
}
