/**
 * تصدير الجدول المعروض إلى CSV — نفس سلوك التصميم الأساسي:
 * يقرأ صفوف الجدول من الـ DOM، ويستثني العمود الأخير (الإجراءات)،
 * ويأخذ قيمة حقول الإدخال (الملاحظات) بدل نصها الفارغ.
 */
export function exportTableToCSV(filename = 'students_report.csv', tableId = 'studentsTable') {
  const table = document.getElementById(tableId);
  if (!table) return;

  const csv = [];
  const rows = table.querySelectorAll('tr');

  for (let i = 0; i < rows.length; i++) {
    const row = [];
    const cols = rows[i].querySelectorAll('td, th');

    for (let j = 0; j < cols.length - 1; j++) {
      const cell = cols[j];
      const input = cell.querySelector('input');

      // data-csv يتقدّم على الحقول الرقمية القابلة للتعديل (نسبة الإنجاز)
      // حتى يبقى التصدير ملتزماً بصيغة النظام النصية
      let raw = cell.dataset.csv ?? (input ? input.value : cell.innerText);
      const text = String(raw).replace(/(\r\n|\n|\r)/gm, ' ').trim();

      row.push('"' + text.replace(/"/g, '""') + '"');
    }
    csv.push(row.join(','));
  }

  const csvFile = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const downloadLink = document.createElement('a');
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  window.URL.revokeObjectURL(downloadLink.href);
}
