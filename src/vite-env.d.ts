/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Development-only opt-in to the retained local-cache adapter. Never set
   * in a production build; see src/data/index.ts. */
  readonly VITE_USE_LOCAL_CACHE_ADAPTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
