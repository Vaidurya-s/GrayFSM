import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FSM_TYPES, VISIBILITY_OPTIONS } from '../../config/constants';
import { useCreateFSM } from '../../hooks/useFSM';
import { useFSMStore } from '../../store/fsmStore';
import type { FSMCreate } from '../../types/fsm';

const fsmSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  fsm_type: z.enum(['moore', 'mealy']),
  visibility: z.enum(['private', 'public', 'unlisted']),
});

type FSMFormValues = z.infer<typeof fsmSchema>;

interface FSMCreateFormProps {
  onSuccess?: (fsmId: string) => void;
  onCancel?: () => void;
}

export default function FSMCreateForm({ onSuccess, onCancel }: FSMCreateFormProps) {
  const {
    draftStates,
    draftTransitions,
    draftInitialState,
  } = useFSMStore();

  const createFSM = useCreateFSM();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FSMFormValues>({
    resolver: zodResolver(fsmSchema),
    defaultValues: {
      name: '',
      description: '',
      fsm_type: 'moore',
      visibility: 'private',
    },
  });

  const onSubmit = async (values: FSMFormValues) => {
    const stateNames = draftStates.map((s) => s.name);
    const payload: FSMCreate = {
      name: values.name,
      description: values.description,
      fsm_type: values.fsm_type,
      states: stateNames.length > 0 ? stateNames : ['S0'],
      initial_state: draftInitialState || stateNames[0] || 'S0',
      transitions: draftTransitions.map((t) => ({
        from_state: t.from_state,
        to_state: t.to_state,
        input: t.input,
        output: t.output,
      })),
      visibility: values.visibility,
    };

    try {
      const result = await createFSM.mutateAsync(payload);
      const fsmData = (result as unknown as { data: { id: string } })?.data;
      if (fsmData?.id && onSuccess) {
        onSuccess(fsmData.id);
      }
    } catch {
      // Error handled by React Query
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      data-testid="fsm-create-form"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          {...register('name')}
          id="name"
          type="text"
          data-testid="fsm-form-name"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
          placeholder="My FSM"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700"
        >
          Description
        </label>
        <textarea
          {...register('description')}
          id="description"
          data-testid="fsm-form-description"
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
          placeholder="Describe your FSM..."
        />
      </div>

      <div>
        <label
          htmlFor="fsm_type"
          className="block text-sm font-medium text-gray-700"
        >
          FSM Type
        </label>
        <select
          {...register('fsm_type')}
          id="fsm_type"
          data-testid="fsm-form-type"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
        >
          {FSM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} -- {t.description}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="visibility"
          className="block text-sm font-medium text-gray-700"
        >
          Visibility
        </label>
        <select
          {...register('visibility')}
          id="visibility"
          data-testid="fsm-form-visibility"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-gray-900 placeholder-gray-400"
        >
          {VISIBILITY_OPTIONS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label} -- {v.description}
            </option>
          ))}
        </select>
      </div>

      {createFSM.isError && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800">
            Failed to create FSM.{' '}
            {createFSM.error instanceof Error ? createFSM.error.message : 'Please try again.'}
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || createFSM.isPending}
          data-testid="fsm-form-submit"
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {createFSM.isPending ? 'Creating...' : 'Create FSM'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            data-testid="fsm-form-cancel"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
