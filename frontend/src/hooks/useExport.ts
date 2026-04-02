import { useMutation } from '@tanstack/react-query';
import { exportAPI } from '../api/endpoints/export';
import type { ExportRequest } from '../types/fsm';

export function useExportFSM() {
  return useMutation({
    mutationFn: ({ fsmId, request }: { fsmId: string; request: ExportRequest }) =>
      exportAPI.export(fsmId, request),
  });
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: async ({ fsmId, format }: { fsmId: string; format: string }) => {
      const blob = await exportAPI.download(fsmId, format);
      return { blob, format };
    },
    onSuccess: ({ blob, format }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fsm_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}
