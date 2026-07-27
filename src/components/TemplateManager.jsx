import { useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';
import {
  PREVIEW_STUDENT,
  TEMPLATE_VARIABLES,
  renderTemplate,
  usedVariables
} from '../utils/templates.js';
import Modal from './Modal.jsx';

const BLANK = { id: null, name: '', body: '' };

/**
 * إدارة قوالب الرسائل ذات المتغيّرات الديناميكية.
 * القالب الرسمي مقفل (is_locked) فيُعرض للمعاينة ولا يُعدّل ولا يُحذف،
 * التزاماً بقاعدة أن صيغته لا تقبل أي إضافة.
 */
export default function TemplateManager({ templates, user, onClose, onChanged }) {
  const [draft, setDraft] = useState(BLANK);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(null);

  const editing = Boolean(draft.id);
  const locked = templates.find((t) => t.id === draft.id)?.is_locked ?? false;

  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  /** إدراج المتغيّر في موضع المؤشر داخل نص القالب */
  const insertVariable = (token) => {
    const el = bodyRef.current;
    if (!el) return set('body', draft.body + token);

    const start = el.selectionStart ?? draft.body.length;
    const end = el.selectionEnd ?? start;
    const next = draft.body.slice(0, start) + token + draft.body.slice(end);
    set('body', next);

    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    const name = draft.name.trim();
    const body = draft.body.trim();

    if (!name || !body) {
      setError('اسم القالب ونص القالب حقلان مطلوبان.');
      return;
    }

    setSaving(true);
    const payload = {
      name,
      body,
      teacher_id: user.role === 'teacher' ? user.id : null
    };

    const { error: dbError } = draft.id
      ? await supabase.from('message_templates').update(payload).eq('id', draft.id)
      : await supabase.from('message_templates').insert({ ...payload, is_locked: false });

    setSaving(false);

    if (dbError) {
      setError('تعذّر الحفظ: ' + dbError.message);
      return;
    }

    setDraft(BLANK);
    onChanged();
  };

  const handleDelete = async (template) => {
    if (template.is_locked) return;
    if (!window.confirm(`حذف القالب «${template.name}»؟`)) return;

    const { error: dbError } = await supabase
      .from('message_templates')
      .delete()
      .eq('id', template.id);

    if (dbError) {
      setError('تعذّر الحذف: ' + dbError.message);
      return;
    }
    if (draft.id === template.id) setDraft(BLANK);
    onChanged();
  };

  return (
    <Modal title="قوالب الرسائل" onClose={onClose}>
      {error && <div className="alert error">{error}</div>}

      <div className="template-list">
        {templates.map((t) => (
          <div className={`template-row ${draft.id === t.id ? 'active' : ''}`} key={t.id}>
            <div className="template-row-main">
              <span className="template-row-name">{t.name}</span>
              {t.is_locked && <span className="level-badge">رسمي — غير قابل للتعديل</span>}
              <span className="template-row-vars">
                {usedVariables(t.body).map((v) => v.label).join(' · ') || 'بلا متغيّرات'}
              </span>
            </div>
            <div className="template-row-actions">
              <button
                type="button"
                className="btn-action"
                onClick={() => setDraft({ id: t.id, name: t.name, body: t.body })}
              >
                {t.is_locked ? 'معاينة' : 'تعديل'}
              </button>
              {!t.is_locked && (
                <button type="button" className="btn-action" onClick={() => handleDelete(t)}>
                  حذف
                </button>
              )}
            </div>
          </div>
        ))}
        {!templates.length && <div className="empty-state">لا توجد قوالب بعد.</div>}
      </div>

      <form onSubmit={handleSave} className="template-form">
        <h4 className="template-form-title">
          {locked ? 'معاينة القالب الرسمي' : editing ? 'تعديل القالب' : 'قالب جديد'}
        </h4>

        <div className="field">
          <label>اسم القالب</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="تنبيه تأخر عن الحلقة"
            disabled={locked}
          />
        </div>

        {!locked && (
          <div className="variable-chips">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                type="button"
                key={v.token}
                className="variable-chip"
                onClick={() => insertVariable(v.token)}
                title={`إدراج ${v.label}`}
              >
                {v.token}
              </button>
            ))}
          </div>
        )}

        <div className="field">
          <label>نص القالب</label>
          <textarea
            ref={bodyRef}
            rows={6}
            value={draft.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={'السلام عليكم\n{اسم_الطالب} في المستوى {المستوى} أنجز {النسبة}%'}
            disabled={locked}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }}
          />
        </div>

        {draft.body.trim() && (
          <div className="template-preview">
            <span className="template-preview-label">معاينة ببيانات طالب نموذجي</span>
            <pre>{renderTemplate(draft.body, PREVIEW_STUDENT)}</pre>
          </div>
        )}

        {!locked && (
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : editing ? 'حفظ التعديلات' : 'حفظ القالب'}
          </button>
        )}

        {(editing || locked) && (
          <button
            type="button"
            className="btn-action"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => setDraft(BLANK)}
          >
            {locked ? 'إغلاق المعاينة' : 'إلغاء التعديل'}
          </button>
        )}
      </form>
    </Modal>
  );
}
