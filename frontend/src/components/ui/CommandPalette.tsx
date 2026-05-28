import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Fragment,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Home,
  PenTool,
  Image,
  BookOpen,
  Info,
  FilePlus,
  Upload,
  PlusCircle,
  Zap,
  FileCode,
  FileText,
  Moon,
  Keyboard,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { ROUTES, generateRoute } from '../../config/routes';
import { useTheme } from '../providers/theme-context';
import { useUIStore } from '../../store/uiStore';
import { useFSMStore } from '../../store/fsmStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Command {
  id: string;
  name: string;
  category: string;
  shortcut?: string;
  icon?: ReactNode;
  action: () => void;
  keywords?: string[];
}

// ─── Fuzzy match helper ───────────────────────────────────────────────────────

interface MatchResult {
  matched: boolean;
  score: number;
  /** indices of matched characters in the original string */
  matchedIndices: number[];
}

function fuzzyMatch(query: string, text: string): MatchResult {
  if (!query) return { matched: true, score: 0, matchedIndices: [] };

  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const matchedIndices: number[] = [];

  let qi = 0;
  let score = 0;
  let lastMatchIdx = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      matchedIndices.push(ti);
      // Consecutive matches and prefix matches score higher
      if (lastMatchIdx === ti - 1) score += 3;
      if (ti === 0) score += 5;
      score += 1;
      lastMatchIdx = ti;
      qi++;
    }
  }

  return {
    matched: qi === q.length,
    score,
    matchedIndices,
  };
}

// ─── Highlighted text ────────────────────────────────────────────────────────

function HighlightedText({
  text,
  indices,
}: {
  text: string;
  indices: number[];
}) {
  if (indices.length === 0) return <>{text}</>;

  const indexSet = new Set(indices);
  return (
    <>
      {text.split('').map((char, i) =>
        indexSet.has(i) ? (
          <span key={i} className="text-accent dark:text-blue-400 font-semibold">
            {char}
          </span>
        ) : (
          <Fragment key={i}>{char}</Fragment>
        )
      )}
    </>
  );
}

// ─── Kbd badge ────────────────────────────────────────────────────────────────

function KbdBadge({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split('+');
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className={cn(
            'inline-flex items-center justify-center',
            'min-w-[1.4rem] h-5 px-1 rounded text-[10px] font-mono font-medium',
            'bg-paper-shade dark:bg-gray-700',
            'text-ink-faint dark:text-ink-faint',
            'border border-rule-strong dark:border-gray-600',
            'shadow-[0_1px_0_0_theme(colors.gray.300)] dark:shadow-[0_1px_0_0_theme(colors.gray.600)]'
          )}
        >
          {part}
        </kbd>
      ))}
    </span>
  );
}

// ─── Internal scored command ──────────────────────────────────────────────────

interface ScoredCommand extends Command {
  matchedIndices: number[];
  score: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { isDark, setTheme } = useTheme();
  const openModal = useUIStore((s) => s.openModal);
  const currentFSM = useFSMStore((s) => s.currentFSM);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ─── Command definitions ─────────────────────────────────────────────────

  const commands: Command[] = useMemo(
    () => [
      // Navigation
      {
        id: 'nav-home',
        name: 'Go to Home',
        category: 'Navigation',
        shortcut: 'G+H',
        icon: <Home className="w-4 h-4" />,
        action: () => navigate(ROUTES.HOME),
        keywords: ['home', 'start', 'dashboard'],
      },
      {
        id: 'nav-editor',
        name: 'Go to Editor',
        category: 'Navigation',
        shortcut: 'G+E',
        icon: <PenTool className="w-4 h-4" />,
        action: () => navigate(ROUTES.EDITOR),
        keywords: ['editor', 'fsm', 'create', 'design'],
      },
      {
        id: 'nav-gallery',
        name: 'Go to Gallery',
        category: 'Navigation',
        shortcut: 'G+G',
        icon: <Image className="w-4 h-4" />,
        action: () => navigate(ROUTES.GALLERY),
        keywords: ['gallery', 'browse', 'saved'],
      },
      {
        id: 'nav-examples',
        name: 'Go to Examples',
        category: 'Navigation',
        shortcut: 'G+X',
        icon: <BookOpen className="w-4 h-4" />,
        action: () => navigate(ROUTES.EXAMPLES),
        keywords: ['examples', 'learn', 'templates'],
      },
      {
        id: 'nav-about',
        name: 'Go to About',
        category: 'Navigation',
        icon: <Info className="w-4 h-4" />,
        action: () => navigate(ROUTES.ABOUT),
        keywords: ['about', 'info', 'docs'],
      },

      // Editor
      {
        id: 'editor-new',
        name: 'New FSM',
        category: 'Editor',
        shortcut: 'Ctrl+N',
        icon: <FilePlus className="w-4 h-4" />,
        action: () => {
          navigate(ROUTES.EDITOR_NEW);
          openModal('createFSM');
        },
        keywords: ['new', 'create', 'blank', 'fsm'],
      },
      {
        id: 'editor-import',
        name: 'Import FSM',
        category: 'Editor',
        icon: <Upload className="w-4 h-4" />,
        action: () => navigate(ROUTES.EDITOR),
        keywords: ['import', 'upload', 'load', 'open'],
      },
      {
        id: 'editor-add-state',
        name: 'Add State',
        category: 'Editor',
        shortcut: 'S',
        icon: <PlusCircle className="w-4 h-4" />,
        action: () => openModal('editState'),
        keywords: ['add', 'state', 'node'],
      },

      // Actions
      {
        id: 'action-optimize',
        name: 'Run Optimization',
        category: 'Actions',
        icon: <Zap className="w-4 h-4" />,
        action: () => {
          if (currentFSM?.id) {
            navigate(generateRoute(ROUTES.OPTIMIZE, { id: currentFSM.id }));
          } else {
            navigate(ROUTES.GALLERY);
          }
        },
        keywords: ['optimize', 'minimize', 'reduce', 'run'],
      },
      {
        id: 'action-export-verilog',
        name: 'Export Verilog',
        category: 'Actions',
        icon: <FileCode className="w-4 h-4" />,
        action: () => openModal('exportFSM'),
        keywords: ['export', 'verilog', 'hdl', 'code'],
      },
      {
        id: 'action-export-vhdl',
        name: 'Export VHDL',
        category: 'Actions',
        icon: <FileText className="w-4 h-4" />,
        action: () => openModal('exportFSM'),
        keywords: ['export', 'vhdl', 'hdl', 'code'],
      },

      // Settings
      {
        id: 'settings-dark-mode',
        name: 'Toggle Dark Mode',
        category: 'Settings',
        shortcut: 'Ctrl+Shift+L',
        icon: <Moon className="w-4 h-4" />,
        action: () => {
          setTheme(isDark ? 'light' : 'dark');
        },
        keywords: ['dark', 'light', 'theme', 'mode', 'color'],
      },
      {
        id: 'settings-shortcuts',
        name: 'Keyboard Shortcuts',
        category: 'Settings',
        shortcut: '?',
        icon: <Keyboard className="w-4 h-4" />,
        action: () => {
          // Placeholder — open a shortcuts modal when available
          console.info('Keyboard shortcuts panel not yet implemented');
        },
        keywords: ['keyboard', 'shortcuts', 'hotkeys', 'bindings'],
      },
    ],
    [navigate, openModal, isDark, setTheme, currentFSM]
  );

  // ─── Filtered + scored results ────────────────────────────────────────────

  const filteredCommands: ScoredCommand[] = useMemo(() => {
    if (!query.trim()) {
      return commands.map((c) => ({ ...c, matchedIndices: [], score: 0 }));
    }

    return commands
      .map((cmd) => {
        const nameMatch = fuzzyMatch(query, cmd.name);
        const keywordScore = (cmd.keywords ?? []).reduce((best, kw) => {
          const r = fuzzyMatch(query, kw);
          return r.matched && r.score > best ? r.score : best;
        }, 0);
        const score = nameMatch.matched
          ? nameMatch.score + keywordScore
          : keywordScore > 0
          ? keywordScore - 1
          : -1;
        return {
          ...cmd,
          score,
          matchedIndices: nameMatch.matched ? nameMatch.matchedIndices : [],
        };
      })
      .filter((c) => c.score >= 0)
      .sort((a, b) => b.score - a.score);
  }, [commands, query]);

  // Group by category preserving filtered order
  const grouped = useMemo(() => {
    const map = new Map<string, ScoredCommand[]>();
    for (const cmd of filteredCommands) {
      const arr = map.get(cmd.category) ?? [];
      arr.push(cmd);
      map.set(cmd.category, arr);
    }
    return map;
  }, [filteredCommands]);

  // ─── Keyboard handling ────────────────────────────────────────────────────

  const executeCommand = useCallback(
    (cmd: ScoredCommand) => {
      onClose();
      cmd.action();
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[activeIndex];
        if (cmd) executeCommand(cmd);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, filteredCommands, activeIndex, executeCommand]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after animation frame so the element is visible
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keep active item in view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  // flat ordered list for index mapping
  const flatList = filteredCommands;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={cn(
          'relative z-10 w-full max-w-lg',
          'bg-paper dark:bg-gray-900',
          'rounded-xl shadow-2xl ring-1 ring-black/10 dark:ring-white/10',
          'flex flex-col overflow-hidden',
          'max-h-[60vh]',
          // Appear animation via Tailwind + CSS custom property trick
          'animate-command-palette'
        )}
        style={{
          animation: 'commandPaletteIn 140ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Search row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-rule dark:border-gray-700 shrink-0">
          <Search className="w-4 h-4 text-ink-faint dark:text-ink-faint shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className={cn(
              'flex-1 bg-transparent outline-none',
              'text-sm text-ink dark:text-gray-100',
              'placeholder:text-ink-faint dark:placeholder:text-ink-faint'
            )}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 shrink-0">
            <span className="text-[10px] font-mono text-ink-faint dark:text-ink-faint bg-paper-shade dark:bg-gray-800 border border-rule-strong dark:border-gray-600 rounded px-1 py-0.5">
              ESC
            </span>
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-1.5">
          {filteredCommands.length === 0 ? (
            <p className="text-center text-sm text-ink-faint dark:text-ink-faint py-10">
              No commands found for &quot;{query}&quot;
            </p>
          ) : (
            Array.from(grouped.entries()).map(([category, cmds]) => (
              <div key={category}>
                {/* Category header */}
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint dark:text-ink-faint select-none">
                    {category}
                  </span>
                </div>

                {/* Commands */}
                {cmds.map((cmd) => {
                  const globalIdx = flatList.findIndex((c) => c.id === cmd.id);
                  const isActive = globalIdx === activeIndex;

                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      data-active={isActive}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setActiveIndex(globalIdx)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                        'text-sm transition-colors duration-75',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'text-ink-soft dark:text-gray-300 hover:bg-paper-shade dark:hover:bg-gray-800/60'
                      )}
                    >
                      {/* Icon */}
                      <span
                        className={cn(
                          'shrink-0 w-7 h-7 rounded-md flex items-center justify-center',
                          isActive
                            ? 'bg-blue-100 dark:bg-blue-900/60 text-accent dark:text-blue-400'
                            : 'bg-paper-shade dark:bg-gray-800 text-ink-faint dark:text-ink-faint'
                        )}
                      >
                        {cmd.icon}
                      </span>

                      {/* Name */}
                      <span className="flex-1 truncate">
                        <HighlightedText
                          text={cmd.name}
                          indices={cmd.matchedIndices}
                        />
                      </span>

                      {/* Shortcut */}
                      {cmd.shortcut && <KbdBadge shortcut={cmd.shortcut} />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-t border-rule dark:border-gray-800">
          <span className="flex items-center gap-1 text-[11px] text-ink-faint dark:text-ink-faint">
            <kbd className="font-mono">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-faint dark:text-ink-faint">
            <kbd className="font-mono">↵</kbd> select
          </span>
          <span className="flex items-center gap-1 text-[11px] text-ink-faint dark:text-ink-faint">
            <kbd className="font-mono">ESC</kbd> close
          </span>
        </div>
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes commandPaletteIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

// `useCommandPalette` now lives in `./use-command-palette`. Importers
// should pull from there directly or from the `./index` barrel —
// keeping a re-export here would re-introduce the
// react-refresh/only-export-components warning.
