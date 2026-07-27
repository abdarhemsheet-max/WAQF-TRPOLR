import { loadDemoDb, saveDemoDb } from './demoData.js';

/**
 * عميل وهمي يحاكي واجهة supabase-js المستخدمة في هذا المشروع:
 *   supabase.rpc('login_user', {...})
 *   supabase.from(t).select(...).eq(...).order(...)
 *   supabase.from(t).insert({...}).select(...).single()
 *   supabase.from(t).update({...}).eq('id', id)
 *   supabase.from(t).delete().eq('id', id)
 *
 * الهدف: تشغيل النظام كاملاً بلا Supabase، دون تغيير أي سطر في الصفحات.
 */

const LATENCY = 180; // محاكاة زمن الشبكة حتى تظهر حالات التحميل بشكل واقعي

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ok = (data) => ({ data, error: null, status: 200 });
const fail = (message, code = 'PGRST000') => ({
  data: null,
  error: { message, code, details: null, hint: null },
  status: 400
});

const clean = (str) => String(str ?? '').trim();

/** ربط الطالب بمحفّظه — يحاكي embed العلاقة في PostgREST */
function withTeacher(student, users) {
  const teacher = users.find((u) => u.id === student.teacher_id);
  return {
    ...student,
    teacher: teacher
      ? { id: teacher.id, name: teacher.name, halaqa_number: teacher.halaqa_number }
      : null
  };
}

/** حجب عمود passcode تماماً كما هو الحال في المخطط الحقيقي */
function publicUser({ passcode, ...rest }) {
  return rest;
}

/** يحاكي تسلسل student_number_seq في قاعدة البيانات */
function nextStudentNumber(db) {
  const max = db.students.reduce((acc, s) => {
    const n = parseInt(s.student_number, 10);
    return Number.isNaN(n) ? acc : Math.max(acc, n);
  }, 2000);
  return max + 1;
}

class MockQuery {
  constructor(table) {
    this.table = table;
    this.op = 'select';
    this.payload = null;
    this.filters = [];
    this.orderBy = null;
    this.ascending = true;
    this.limitCount = null;
    this.wantSingle = false;
  }

  select() {
    if (this.op === 'select') this.op = 'select';
    return this;
  }

  insert(payload) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.op = 'delete';
    return this;
  }

  eq(column, value) {
    this.filters.push([column, value]);
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orderBy = column;
    this.ascending = ascending;
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.wantSingle = true;
    return this;
  }

  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  matches(row) {
    return this.filters.every(([col, val]) => String(row[col]) === String(val));
  }

  async run() {
    await wait(LATENCY);
    const db = loadDemoDb();

    if (this.op === 'insert') return this.runInsert(db);
    if (this.op === 'update') return this.runUpdate(db);
    if (this.op === 'delete') return this.runDelete(db);

    let rows = (db[this.table] ?? []).filter((r) => this.matches(r));

    if (this.orderBy) {
      const direction = this.ascending ? 1 : -1;
      rows = [...rows].sort(
        (a, b) =>
          direction *
          String(a[this.orderBy] ?? '').localeCompare(String(b[this.orderBy] ?? ''), 'ar', {
            numeric: true
          })
      );
    }

    if (this.table === 'students') rows = rows.map((r) => withTeacher(r, db.users));
    else if (this.table === 'users') rows = rows.map(publicUser);

    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);

    if (this.wantSingle) {
      return rows.length === 1
        ? ok(rows[0])
        : fail('لم يُعثر على صف واحد مطابق', 'PGRST116');
    }
    return ok(rows);
  }

  runInsert(db) {
    const now = new Date().toISOString();
    const input = this.payload;

    // إدراج متعدد: ننفّذه صفاً صفاً بنفس المنطق
    if (Array.isArray(input)) {
      const inserted = [];
      for (const row of input) {
        const single = new MockQuery(this.table);
        single.op = 'insert';
        single.payload = row;
        const result = single.runInsert(loadDemoDb());
        if (result.error) return result;
        inserted.push(result.data);
      }
      return ok(inserted);
    }

    if (this.table === 'students') {
      // يحاكي التسلسل student_number_seq: القاعدة تخصّص الرقم إن لم يُرسل
      const number = clean(input.student_number) || String(nextStudentNumber(db));

      if (db.students.some((s) => clean(s.student_number) === number)) {
        return fail('duplicate key value violates unique constraint', '23505');
      }
      const row = {
        id: crypto.randomUUID(),
        student_number: number,
        name: clean(input.name),
        level: input.level,
        matn: clean(input.matn),
        progress: Number(input.progress) || 0,
        notes: clean(input.notes),
        guardian_phone: clean(input.guardian_phone),
        teacher_id: input.teacher_id,
        created_at: now,
        updated_at: now
      };
      db.students.push(row);
      saveDemoDb(db);
      return ok(withTeacher(row, db.users));
    }

    if (this.table === 'users') {
      const name = clean(input.name);
      const passcode = clean(input.passcode);
      const duplicate = db.users.some(
        (u) =>
          clean(u.passcode) === passcode ||
          (u.name.trim().toLowerCase() === name.toLowerCase() && u.role === input.role)
      );
      if (duplicate) {
        return fail('duplicate key value violates unique constraint', '23505');
      }
      const row = {
        id: crypto.randomUUID(),
        name,
        role: input.role,
        passcode,
        halaqa_number: clean(input.halaqa_number) || null,
        created_at: now
      };
      db.users.push(row);
      saveDemoDb(db);
      return ok(publicUser(row));
    }

    // الجداول العامة (القوالب، التقارير): إدراج مباشر بمعرّف وتاريخ
    if (Array.isArray(db[this.table])) {
      const row = { id: crypto.randomUUID(), created_at: now, ...input };
      db[this.table].push(row);
      saveDemoDb(db);
      return ok(row);
    }

    return fail(`جدول غير معروف: ${this.table}`);
  }

  runUpdate(db) {
    const updated = [];
    db[this.table] = (db[this.table] ?? []).map((row) => {
      if (!this.matches(row)) return row;
      const next = { ...row, ...this.payload, updated_at: new Date().toISOString() };
      updated.push(next);
      return next;
    });
    saveDemoDb(db);

    const rows =
      this.table === 'students'
        ? updated.map((r) => withTeacher(r, db.users))
        : updated.map(publicUser);

    return this.wantSingle ? ok(rows[0] ?? null) : ok(rows);
  }

  runDelete(db) {
    const rows = db[this.table] ?? [];
    const removed = rows.filter((r) => this.matches(r));
    db[this.table] = rows.filter((r) => !this.matches(r));
    saveDemoDb(db);
    return ok(removed.map((r) => (this.table === 'users' ? publicUser(r) : r)));
  }

  // يجعل الكائن قابلاً لـ await و .then() تماماً كباني استعلامات supabase
  then(resolve, reject) {
    return this.run().then(resolve, reject);
  }
}

export const mockClient = {
  from(table) {
    return new MockQuery(table);
  },

  /**
   * الوضع التجريبي بمتصفح واحد، فلا معنى للبث اللحظي:
   * قناة صامتة تحفظ توافق الواجهة دون سلوك.
   */
  channel() {
    const stub = { on: () => stub, subscribe: () => stub, unsubscribe: () => {} };
    return stub;
  },

  removeChannel() {},

  /** يحاكي دالة login_user ذات SECURITY DEFINER */
  async rpc(fn, params = {}) {
    await wait(LATENCY);

    if (fn !== 'login_user') return fail(`دالة غير معروفة: ${fn}`);

    const db = loadDemoDb();
    const match = db.users.find(
      (u) =>
        u.role === clean(params.p_role) &&
        u.name.trim().toLowerCase() === clean(params.p_name).toLowerCase() &&
        clean(u.passcode) === clean(params.p_passcode)
    );

    return ok(
      match
        ? [{ id: match.id, name: match.name, role: match.role, halaqa_number: match.halaqa_number }]
        : []
    );
  }
};
