export type SnapshotExportRow = {
  country: string;
  region: string;
  regime: string;
  freshCoveragePct: number;
  confidencePct: number;
  riskPct: number;
  relationships: number;
  trust: string;
};

export const SNAPSHOT_EXPORT_COLUMNS = [
  { key: 'country', label: 'Country' },
  { key: 'region', label: 'Region' },
  { key: 'regime', label: 'Regime' },
  { key: 'freshCoveragePct', label: 'Fresh coverage %' },
  { key: 'confidencePct', label: 'Confidence %' },
  { key: 'riskPct', label: 'Risk %' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'trust', label: 'Trust' },
] as const;

type ExportColumnKey = (typeof SNAPSHOT_EXPORT_COLUMNS)[number]['key'];

const cellValue = (row: SnapshotExportRow, key: ExportColumnKey): string | number => row[key];

const escapeCsv = (value: string | number): string => {
  const raw = String(value);
  // Keep exported snapshots safe to open in spreadsheet applications.
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
};

const escapeMarkdown = (value: string | number): string => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

export const snapshotRowsToCsv = (rows: SnapshotExportRow[]): string => {
  const header = SNAPSHOT_EXPORT_COLUMNS.map((column) => escapeCsv(column.label)).join(',');
  const body = rows.map((row) =>
    SNAPSHOT_EXPORT_COLUMNS.map((column) => escapeCsv(cellValue(row, column.key))).join(','),
  );
  return [header, ...body].join('\n');
};

export const snapshotRowsToMarkdown = (
  rows: SnapshotExportRow[],
  asOf = new Date().toISOString().slice(0, 10),
): string => {
  const headers = SNAPSHOT_EXPORT_COLUMNS.map((column) => column.label);
  const lines = [
    '# Realpolitik factual index',
    '',
    `As of **${asOf}**. This is an observed-state snapshot; risk is not a forecast.`,
    '',
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(
      (row) => `| ${SNAPSHOT_EXPORT_COLUMNS.map((column) => escapeMarkdown(cellValue(row, column.key))).join(' | ')} |`,
    ),
  ];
  return lines.join('\n');
};

export const downloadTextFile = (filename: string, content: string, mimeType: string): void => {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
