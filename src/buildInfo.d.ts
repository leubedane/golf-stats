/** ISO timestamp of the build, set in vite.config.ts. */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** The commit a build was made from; set by the deploy workflow, absent in local builds. */
  readonly VITE_BUILD_COMMIT?: string;
}
