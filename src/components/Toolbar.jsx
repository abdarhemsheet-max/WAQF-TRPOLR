import { exportTableToCSV } from '../utils/csv.js';
import {
  ExportIcon,
  PlusIcon,
  PrintIcon,
  SearchIcon,
  TemplateIcon,
  WhatsappBubbleIcon
} from './Icons.jsx';

export default function Toolbar({
  query,
  onQueryChange,
  addLabel,
  onAdd,
  onMassMessage,
  onTemplates,
  isAdmin = true
}) {
  return (
    <div className="controls-group">
      <div className="search-box">
        <input
          type="text"
          placeholder="بحث بالاسم أو رقم الطالب..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <SearchIcon />
      </div>

      {isAdmin && (
        <button className="btn-action whatsapp-all" onClick={onMassMessage}>
          <WhatsappBubbleIcon />
          تصدير رسائل CSV
        </button>
      )}

      {isAdmin && (
        <button className="btn-action" onClick={onTemplates}>
          <TemplateIcon />
          القوالب
        </button>
      )}

      {isAdmin && (
        <button className="btn-action export" onClick={() => exportTableToCSV('students_report.csv')}>
          <ExportIcon />
          تصدير CSV
        </button>
      )}

      {isAdmin && (
        <button className="btn-action print" onClick={() => window.print()}>
          <PrintIcon />
          طباعة
        </button>
      )}

      {onAdd && (
        <button className="btn-action add" onClick={onAdd}>
          <PlusIcon />
          {addLabel}
        </button>
      )}
    </div>
  );
}
