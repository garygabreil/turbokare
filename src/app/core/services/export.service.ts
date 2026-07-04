import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Exports an array of plain objects to a downloadable CSV file.
   * `columns` maps object keys to human-friendly headers.
   */
  toCsv<T extends Record<string, unknown>>(
    rows: T[],
    columns: { key: keyof T; label: string }[],
    filename: string,
  ): void {
    const header = columns.map((c) => this.escape(c.label)).join(',');
    const body = rows
      .map((row) => columns.map((c) => this.escape(this.format(row[c.key]))).join(','))
      .join('\n');
    const csv = `${header}\n${body}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private format(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private escape(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
