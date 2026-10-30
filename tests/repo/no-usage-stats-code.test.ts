import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { listRepoFiles, readRepoText, repoPath } from './repository';

// Lumno collects no usage statistics: the telemetry and account-sync code is
// gone and stays gone, as JavaScript or TypeScript.

const REMOVED = [
  'src/background/telemetry.js',
  'src/shared/telemetry-schema.js',
  'serverless/tencent-scf-telemetry-ingest',
  'docs/telemetry-plan.md',
  'scripts/test-telemetry-runtime.js',
  'scripts/test-telemetry-schema.js',
  'scripts/test-telemetry-ingest-sanitize.js',
  'scripts/test-options-telemetry-copy.js',
  'src/background/usage-analytics-runtime.js',
  'src/shared/cloud-sync-schema.js',
  'supabase/functions/telemetry-ingest/index.ts'
];

// A removed runtime module must not come back as TypeScript either.
function candidates(file: string): string[] {
  return /^src\/.*\.js$/.test(file) ? [file, file.replace(/\.js$/, '.ts')] : [file];
}

describe('usage statistics', () => {
  it('keeps the telemetry and account-sync modules removed', () => {
    expect(REMOVED.flatMap(candidates).filter((file) => existsSync(repoPath(file)))).toEqual([]);
  });

  it('offers no account sync or analytics controls in Settings', () => {
    expect(readRepoText('src/options/options.html')).not.toMatch(/_x_extension_cloud_|Lumno 账号同步|开启账号同步/);
  });

  // Repository rule (no lint covers it): the worker collects and uploads no
  // account-linked usage statistics.
  it('leaves the worker without usage recording', () => {
    const recording = listRepoFiles('src/background', /\.tsx?$/)
      .filter((file) => /cloudRecordUsage|recordCloudUsageMetric|usage-analytics-runtime/.test(readFileSync(repoPath(file), 'utf8')));

    expect(recording).toEqual([]);
  });
});
