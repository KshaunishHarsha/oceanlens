/* Phase 3 — operational UI shell.
 *
 * Ported from the Claude Design artboard (OceanLens India.dc.html). This is
 * the shell: layout, chrome, controls wired to real API data, and every
 * loading/empty/error/unavailable state. The 3D scene, profile chart
 * internals, and detailed comparison/provenance visualisations are later
 * phases — SceneStage and EvidencePanel say so explicitly where they apply. */

import { AppShell } from '@/ui/AppShell';

export function App() {
  return <AppShell />;
}
