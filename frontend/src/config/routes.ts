export const ROUTES = {
  HOME: '/',
  EDITOR: '/editor',
  EDITOR_NEW: '/editor/new',
  EDITOR_EDIT: '/editor/:id',
  OPTIMIZE: '/optimize/:id',
  EXPORT: '/export/:id',
  GALLERY: '/gallery',
  EXAMPLES: '/examples',
  EXAMPLE_DETAIL: '/examples/:id',
  LEARN: '/learn',
  LEARN_TUTORIAL: '/learn/:tutorialId',
  ABOUT: '/about',
  DOCS: '/docs',
  NOT_FOUND: '*',
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Generate route with parameters
 */
export function generateRoute(route: string, params: Record<string, string>): string {
  let path = route;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, value);
  }
  return path;
}
