/* Shape of the on-disk real-data cache written by scripts/prepare-real-data.mjs
 * into public/data/real/. The browser fetches these files and nothing else. */

import type { QualityFlag } from '@/domain/quality';

export interface CachedGrid {
  /** Ascending, south to north. */
  readonly latitudes: number[];
  /** Ascending, west to east. */
  readonly longitudes: number[];
  /** Ascending, metres positive down. */
  readonly depthsM: number[];
  /** ISO 8601 UTC, ascending. */
  readonly timestamps: string[];
  readonly shape: { nt: number; nz: number; ny: number; nx: number };
  readonly layout: string;
}

/** One normalised observation profile. Parallel arrays keyed by depth index. */
export interface CachedProfile {
  readonly id: string;
  readonly platformType: 'ARGO' | 'GLIDER' | 'CTD' | 'BGC';
  readonly platformName: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly observedAt: string;
  readonly qc: QualityFlag;
  readonly depthsM: number[];
  readonly temperature: (number | null)[];
  readonly salinity: (number | null)[];
  readonly temperatureQc: (QualityFlag | null)[];
  readonly salinityQc: (QualityFlag | null)[];
  readonly identity: {
    readonly wmo: string;
    readonly dataCentre: string;
    readonly cycleNumber: number;
    readonly dataMode: string | null;
    readonly projectName: string | null;
    readonly principalInvestigator: string | null;
    readonly positioningSystem: string | null;
    readonly instrumentType: string | null;
    readonly positionQc: QualityFlag | null;
    readonly verticalSamplingScheme: string | null;
    /** Argo PROFILE_TEMP_QC / PROFILE_PSAL_QC letters (A best … F worst). */
    readonly profileTempQcLetter: string | null;
    readonly profilePsalQcLetter: string | null;
    readonly usedAdjustedFields: boolean;
    readonly sourceFile: string;
  };
}

/** Full-resolution model column at one observation's position, all timestamps. */
export interface CachedColumn {
  readonly observationId: string;
  readonly gridLatitude: number;
  readonly gridLongitude: number;
  readonly depthsM: number[];
  readonly byTimestamp: {
    readonly timestamp: string;
    readonly temperature: (number | null)[];
    readonly salinity: (number | null)[];
    readonly currentU: (number | null)[];
    readonly currentV: (number | null)[];
  }[];
}

export type CachedModelVariable =
  | 'temperature'
  | 'salinity'
  | 'currentU'
  | 'currentV';

/** The fully-loaded cache held in memory by CachedRealDataAdapter. */
export interface LoadedCache {
  readonly manifest: unknown; // validated separately against DatasetMetadata
  readonly grid: CachedGrid;
  readonly profiles: CachedProfile[];
  readonly columns: Map<string, CachedColumn>;
  /** var -> Float32Array [t][z][y][x], NaN = land/missing. Absent if not cached. */
  readonly slices: Partial<Record<CachedModelVariable, Float32Array>>;
  readonly haveCurrents: boolean;
}
