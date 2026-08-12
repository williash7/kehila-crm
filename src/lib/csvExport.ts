export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  if (rows.length === 0) {
    alert('אין נתונים לייצוא');
    return;
  }
  let csvContent = '﻿' + headers.join(',') + '\n';
  rows.forEach(row => {
    csvContent += row.map(cell =>
      typeof cell === 'number' ? cell : `"${String(cell ?? '').replace(/"/g, '""')}"`
    ).join(',') + '\n';
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
