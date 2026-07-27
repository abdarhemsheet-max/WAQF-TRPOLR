import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useStudents } from '../hooks/useStudents.js';
import { useTemplates } from '../hooks/useTemplates.js';
import TopBar from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import StatsGrid from '../components/StatsGrid.jsx';
import StudentsTable from '../components/StudentsTable.jsx';
import AddStudentForm from '../components/AddStudentForm.jsx';
import EditStudentForm from '../components/EditStudentForm.jsx';
import MassMessaging from '../components/MassMessaging.jsx';
import TemplateManager from '../components/TemplateManager.jsx';

export default function TeacherDashboard() {
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
    addStudent,
    replaceStudent
  } = useStudents(user.id);
  const { templates, refresh: refreshTemplates } = useTemplates(user);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [messaging, setMessaging] = useState(false);
  const [managingTemplates, setManagingTemplates] = useState(false);

  return (
    <div className="container">
      <TopBar />

      <div className="print-header">
        <h2>تقرير متابعة إنجاز المتون</h2>
        <p>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</p>
      </div>

      <div className="header-section">
        <div className="title">
          <h1>متابعة إنجاز الطلاب</h1>
          <p>الحلقة {user.halaqa_number} - إدارة تقدم المتون</p>
        </div>

        <Toolbar
          query={query}
          onQueryChange={setQuery}
          addLabel="إضافة طالب"
          onAdd={() => setAdding(true)}
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
          onSort={toggleSort}
          onNoteChange={changeNote}
          onNoteCommit={commitNote}
          onProgressChange={changeProgress}
          onProgressCommit={commitProgress}
          onEdit={setEditing}
        />
      )}

      {adding && (
        <AddStudentForm
          teacherId={user.id}
          onClose={() => setAdding(false)}
          onSaved={addStudent}
        />
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
