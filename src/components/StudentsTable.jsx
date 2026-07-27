import { ar, arPercent } from '../utils/numbers.js';
import { progressColor } from '../utils/levels.js';
import { openGuardianWhatsapp } from '../utils/whatsapp.js';
import { displayGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import { EditIcon, WhatsappBubbleIcon } from './Icons.jsx';

/**
 * جدول الطلاب.
 * showTeacherColumn: عمود "المحفّظ" يظهر في لوحة الأدمن فقط.
 * نسبة الإنجاز قابلة للتعديل مباشرة من الجدول دون نموذج منفصل.
 * الإجراء الوحيد: إنشاء رسالة ولي الأمر بصيغة رسمية موجّهة لرقم وليّه.
 */
export default function StudentsTable({
  students,
  showTeacherColumn = false,
  onSort,
  onNoteChange,
  onNoteCommit,
  onProgressChange,
  onProgressCommit,
  onEdit
}) {
  const columnCount = showTeacherColumn ? 6 : 5;

  return (
    <div className="table-container">
      <table id="studentsTable">
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>المستوى</th>
            {showTeacherColumn && <th>المحفّظ</th>}
            <th onClick={onSort} title="انقر لترتيب الطلاب حسب الإنجاز">
              نسبة الإنجاز ⇅
            </th>
            <th>ملاحظة</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const phone = normalizeGuardianPhone(student.guardian_phone);

            return (
              <tr key={student.id}>
                <td style={{ fontWeight: 600 }}>{student.name}</td>
                <td>
                  <span className="level-badge">{student.level}</span>
                </td>
                {showTeacherColumn && (
                  <td>
                    <span className="teacher-badge">
                      {student.teacher?.name ?? 'غير مسند'}
                      {student.teacher?.halaqa_number
                        ? ` — الحلقة ${student.teacher.halaqa_number}`
                        : ''}
                    </span>
                  </td>
                )}
                {/* data-csv يحفظ صيغة النسبة النصية للتصدير مع بقاء الحقل رقمياً للتعديل */}
                <td data-csv={arPercent(student.progress)}>
                  <div className="progress-wrapper">
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, Number(student.progress) || 0))}%`,
                          background: progressColor(student.progress)
                        }}
                      />
                    </div>
                    <div className="progress-edit">
                      <input
                        type="number"
                        className="progress-input"
                        min="0"
                        max="100"
                        value={student.progress}
                        title="عدّل نسبة الإنجاز ثم اخرج من الحقل ليُحفظ"
                        onChange={(e) => onProgressChange(student.id, e.target.value)}
                        onBlur={(e) => onProgressCommit(student.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                      <span className="progress-sign">%</span>
                    </div>
                  </div>
                </td>
                <td>
                  <input
                    type="text"
                    className="note-input"
                    placeholder="إضافة ملاحظة..."
                    value={student.notes ?? ''}
                    onChange={(e) => onNoteChange(student.id, e.target.value)}
                    onBlur={(e) => onNoteCommit(student.id, e.target.value)}
                  />
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className={`btn-whatsapp guardian${phone ? '' : ' no-phone'}`}
                      onClick={() => openGuardianWhatsapp(student)}
                      title={
                        phone
                          ? `إرسال إلى ${displayGuardianPhone(phone)}`
                          : 'لا يوجد رقم لولي الأمر — سيُفتح منتقي جهات الاتصال'
                      }
                    >
                      <WhatsappBubbleIcon />
                      إنشاء رسالة ولي الأمر بصيغة رسمية
                    </button>
                    <button
                      className="btn-action edit-btn"
                      onClick={() => onEdit(student)}
                      title="تعديل رقم الطالب ورقم ولي الأمر والبيانات"
                    >
                      <EditIcon />
                      تعديل
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {students.length === 0 && (
            <tr>
              <td colSpan={columnCount}>
                <div className="empty-state">لا توجد سجلات مطابقة.</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="table-footer">إجمالي السجلات: {ar(students.length)}</div>
    </div>
  );
}
