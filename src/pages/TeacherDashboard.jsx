import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useStudents } from '../hooks/useStudents.js';
import TopBar from '../components/TopBar.jsx';
import Toolbar from '../components/Toolbar.jsx';
import StudentsTable from '../components/StudentsTable.jsx';
import AddStudentForm from '../components/AddStudentForm.jsx';
import EditStudentForm from '../components/EditStudentForm.jsx';
import Modal from '../components/Modal.jsx';
import { ar } from '../utils/numbers.js';

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
        <Modal title={`تحكيم: ${judging.name}`} onClose={() => setJudging(null)}>
          <div style={{ padding: '8px 0' }}>
            <div className="field">
              <label>المستوى</label>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{judging.level}</div>
            </div>
            <div className="field">
              <label>نسبة الإنجاز</label>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{ar(judging.progress)}%</div>
            </div>
            <div className="field">
              <label>مركز التحفيظ</label>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{judging.memorization_center || '—'}</div>
            </div>
            <div className="field">
              <label>تقييم الصوت</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                defaultValue={judging.voice_rating ?? 0}
                onChange={(e) => changeVoiceRating(judging.id, e.target.value)}
                onBlur={(e) => commitVoiceRating(judging.id, e.target.value)}
                style={{ direction: 'ltr', textAlign: 'left', width: 100 }}
              />
              <span style={{ color: '#666', fontSize: '.8rem', marginRight: 4 }}>/10</span>
            </div>
            <button className="btn-primary" onClick={() => setJudging(null)} style={{ width: '100%', marginTop: 8 }}>
              تم
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
