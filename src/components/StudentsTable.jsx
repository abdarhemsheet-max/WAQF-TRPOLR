import { ar, arPercent } from '../utils/numbers.js';
import { progressColor } from '../utils/levels.js';
import { openGuardianWhatsapp } from '../utils/whatsapp.js';
import { displayGuardianPhone, normalizeGuardianPhone } from '../utils/phone.js';
import { EditIcon, TrashIcon, WhatsappBubbleIcon } from './Icons.jsx';

export default function StudentsTable({
  students,
  showTeacherColumn = false,
  showActions = true,
  showGuardianMessage = true,
  onSort,
  onNoteChange,
  onNoteCommit,
  onProgressChange,
  onProgressCommit,
  onEdit,
  onDelete
}) {
  const columnCount = showTeacherColumn ? 8 : 7;

  return (
    <div className="table-container">
      <table id="studentsTable">
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>المستوى</th>
            <th>مركز التحفيظ</th>
            <th>تقييم الصوت</th>
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
                <td>
                  <span className="center-badge">{student.memorization_center || '—'}</span>
                </td>
                <td>
                  <span className="voice-badge">{student.voice_rating ?? 0}<span style={{color:'#666',fontSize:'.7rem'}}>/10</span></span>
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
                    {showGuardianMessage && (
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
                        إنشاء رسالة
                      </button>
                    )}
                    {showActions && onEdit && (
                      <button
                        className="btn-action edit-btn"
                        onClick={() => onEdit(student)}
                        title="تعديل بيانات الطالب"
                      >
                        <EditIcon />
                        تعديل
                      </button>
                    )}
                    {showActions && onDelete && (
                      <button
                        className="btn-action edit-btn delete"
                        onClick={() => onDelete(student.id, student.name)}
                        title="حذف الطالب"
                      >
                        <TrashIcon />
                        حذف
                      </button>
                    )}
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
