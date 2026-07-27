import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import { useStudents } from '../hooks/useStudents.js';
import { useTemplates } from '../hooks/useTemplates.js';
import { useAuth } from '../context/AuthContext.jsx';
import { ar } from '../utils/numbers.js';
import TopBar from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import StatsGrid from '../components/StatsGrid.jsx';
import StudentsTable from '../components/StudentsTable.jsx';
import AddTeacherForm from '../components/AddTeacherForm.jsx';
import EditStudentForm from '../components/EditStudentForm.jsx';
import MassMessaging from '../components/MassMessaging.jsx';
import TemplateManager from '../components/TemplateManager.jsx';

export default function AdminDashboard() {
  const { user } = useAuth();
  const {
    visible,
    loading,
    error,
    query,
    setQuery,
    toggleSort,
    changeNote,
    commitNote,
    changeProgress,
    commitProgress,
    replaceStudent,
    refresh
  } = useStudents(null);
  const { templates, refresh: refreshTemplates } = useTemplates(user);

  const [teachers, setTeachers] = useState([]);
  const [addingTeacher, setAddingTeacher] = useState(false);
  const [editing, setEditing] = useState(null);
  const [messaging, setMessaging] = useState(false);
  const [managingTemplates, setManagingTemplates] = useState(false);
  const [showTeachers, setShowTeachers] = useState(false);

  const loadTeachers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, name, halaqa_number')
      .eq('role', 'teacher')
      .order('name');
    if (!data) return;
    const enriched = await Promise.all(
      data.map((t) =>
        supabase
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('teacher_id', t.id)
          .then(({ count }) => ({ ...t, student_count: count ?? 0 }))
      )
    );
    setTeachers(enriched);
  }, []);

  useEffect(() => { loadTeachers(); }, [loadTeachers]);

  const handleTeacherSaved = (teacher) => {
    setTeachers((list) => [...list, { ...teacher, student_count: 0 }]);
    refresh();
  };

  return (
    <div className="container">
      <TopBar />

      <div className="print-header">
        <h2>تقرير متابعة إنجاز المتون — جميع الحلقات</h2>
        <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      <div className="header-section">
        <div className="title">
          <h1>متابعة إنجاز الطلاب</h1>
          <p>جميع الحلقات - عدد المحفّظين: {ar(teachers.length)}</p>
        </div>

        <Toolbar
          query={query}
          onQueryChange={setQuery}
          addLabel="إضافة محفّظ"
          onAdd={() => setAddingTeacher(true)}
          onMassMessage={() => setMessaging(true)}
          onTemplates={() => setManagingTemplates(true)}
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      <StatsGrid students={visible} />

      {loading ? (
        <div className="table-container">
          <div className="empty-state">جارٍ تحميل بيانات الطلاب...</div>
        </div>
      ) : (
        <StudentsTable
          students={visible}
          showTeacherColumn
          onSort={toggleSort}
          onNoteChange={changeNote}
          onNoteCommit={commitNote}
          onProgressChange={changeProgress}
          onProgressCommit={commitProgress}
          onEdit={setEditing}
        />
      )}

      <div className="glass-panel" style={{ marginTop: 24 }}>
        <div
          className="glass-panel-head"
          style={{ cursor: 'pointer', marginBottom: showTeachers ? 18 : 0 }}
          onClick={() => setShowTeachers((s) => !s)}
        >
          <h2>المحفّظون المسجّلون في النظام</h2>
          <span className="glass-panel-hint">
            {showTeachers ? 'إخفاء' : 'إظهار التفاصيل'} ({ar(teachers.length)})
          </span>
        </div>

        {showTeachers && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم المحفّظ</th>
                  <th>رمز الحلقة</th>
                  <th>عدد الطلاب</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-state">لا يوجد محفّظون بعد</td>
                  </tr>
                ) : (
                  teachers.map((t, i) => (
                    <tr key={t.id}>
                      <td className="student-number">{ar(i + 1)}</td>
                      <td>{t.name}</td>
                      <td>{t.halaqa_number}</td>
                      <td><span className="level-badge">{ar(t.student_count)}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addingTeacher && (
        <AddTeacherForm onClose={() => setAddingTeacher(false)} onSaved={handleTeacherSaved} />
      )}

      {editing && (
        <EditStudentForm
          student={editing}
          onClose={() => setEditing(null)}
          onSaved={replaceStudent}
        />
      )}

      {messaging && (
        <MassMessaging
          students={visible}
          templates={templates}
          user={user}
          onClose={() => setMessaging(false)}
        />
      )}

      {managingTemplates && (
        <TemplateManager
          templates={templates}
          user={user}
          onClose={() => setManagingTemplates(false)}
          onChanged={refreshTemplates}
        />
      )}
    </div>
  );
}
