import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useStudents } from '../hooks/useStudents.js';
import TopBar from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import StudentsTable from '../components/StudentsTable.jsx';
import AddStudentForm from '../components/AddStudentForm.jsx';
import EditStudentForm from '../components/EditStudentForm.jsx';
import EvaluationPanel from '../components/EvaluationPanel.jsx';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const {
    visible,
    loading,
    error,
    query,
    setQuery,
    levelFilter,
    setLevelFilter,
    toggleSort,
    changeNote,
    commitNote,
    changeProgress,
    commitProgress,
    changeVoiceRating,
    commitVoiceRating,
    addStudent,
    replaceStudent,
    deleteStudent
  } = useStudents(user.id);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [judging, setJudging] = useState(null);

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
          levelFilter={levelFilter}
          onLevelFilterChange={setLevelFilter}
          addLabel="إضافة طالب"
          onAdd={() => setAdding(true)}
          isAdmin={false}
        />
      </div>

      {error && <div className="alert error">{error}</div>}

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
          onVoiceRatingChange={changeVoiceRating}
          onVoiceRatingCommit={commitVoiceRating}
          showActions
          onEdit={setEditing}
          onDelete={deleteStudent}
          onJudge={setJudging}
          showGuardianMessage={false}
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

      {judging && (
        <EvaluationPanel
          student={judging}
          user={user}
          onClose={() => setJudging(null)}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
