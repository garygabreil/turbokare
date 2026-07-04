import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class PrintService {
  printTable(title: string, headers: string[], rows: string[][]): void {
    const headHtml = headers.map((h) => `<th>${this.escape(h)}</th>`).join('');
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${this.escape(title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; margin: 1.5rem; color: #111; }
    h1 { font-size: 16px; margin: 0 0 0.25rem; text-transform: uppercase; }
    .meta { color: #666; font-size: 11px; margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    td.num { text-align: center; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${this.escape(title)}</h1>
  <div class="meta">Printed ${new Date().toLocaleString()}</div>
  <table>
    <thead><tr><th>#</th>${headHtml}</tr></thead>
    <tbody>${rows.map((row, i) => `<tr><td class="num">${i + 1}</td>${row.map((c) => `<td>${this.escape(c)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) {
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
