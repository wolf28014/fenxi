import { useEffect, useState } from 'react';
import type { Shop } from '@/types';
import { PLATFORM_LABELS } from '@/types';
import { fetchOperationNotes, createOperationNote, updateOperationNote, deleteOperationNote, type OperationNote } from '@/lib/db';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';

interface Props {
  currentShop: Shop | null;
  shops: Shop[];
}

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export default function NotesView({ currentShop, shops }: Props) {
  const [notes, setNotes] = useState<OperationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<OperationNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const load = async () => {
    setLoading(true);
    try {
      // 同时加载今年和去年的笔记（去年用于同期提示）
      const [thisYear, lastYear] = await Promise.all([
        fetchOperationNotes(selectedYear),
        fetchOperationNotes(selectedYear - 1),
      ]);
      setNotes([...thisYear, ...lastYear]);
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedYear]);

  const handleDelete = async (note: OperationNote) => {
    if (!confirm('确定删除这条笔记吗？')) return;
    try {
      await deleteOperationNote(note.id);
      showToast('已删除', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || '删除失败', 'error');
    }
  };

  // 按月分组
  const notesByMonth: Record<number, OperationNote[]> = {};
  for (const note of notes) {
    if (!notesByMonth[note.month]) notesByMonth[note.month] = [];
    notesByMonth[note.month].push(note);
  }

  // 去年同期的笔记（用于提示）
  const lastYearNotes = notes.filter((n) => n.year === selectedYear - 1);
  const currentMonth = new Date().getMonth() + 1;
  const lastYearSameMonthNotes = lastYearNotes.filter((n) => n.month === currentMonth && (selectedYear === new Date().getFullYear()));

  const shopNameMap: Record<string, string> = {};
  shops.forEach((s) => { shopNameMap[s.id] = s.name; });

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">运营笔记</h2>
          <p className="text-sm text-slate-500 mt-1">按月记录运营心得，次年同期自动提示参考</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y} 年</option>
            ))}
          </select>
          <button onClick={() => setCreating(true)} className="btn-primary">+ 新增笔记</button>
        </div>
      </div>

      {/* 去年同期提示 */}
      {lastYearSameMonthNotes.length > 0 && (
        <div className="card p-4 border-2 border-blue-300 bg-blue-50/50 dark:bg-blue-900/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">💡</span>
            <h3 className="font-medium text-sm text-blue-700 dark:text-blue-400">
              去年同期（{selectedYear - 1}年{MONTHS[currentMonth - 1]}）的运营笔记
            </h3>
          </div>
          <div className="space-y-2">
            {lastYearSameMonthNotes.map((note) => (
              <div key={note.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg">
                {note.title && <div className="font-medium text-sm mb-1">{note.title}</div>}
                <div className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{note.content}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 笔记列表（按月分组） */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : notes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">{selectedYear}年还没有笔记</h3>
          <p className="text-sm text-slate-500 mb-4">记录每月运营心得，明年同期会自动提示你参考</p>
          <button onClick={() => setCreating(true)} className="btn-primary">+ 写第一条笔记</button>
        </div>
      ) : (
        <div className="space-y-4">
          {MONTHS.map((monthName, idx) => {
            const monthNotes = notesByMonth[idx + 1] || [];
            if (monthNotes.length === 0) return null;
            return (
              <div key={idx} className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-5 bg-primary-600 rounded"></span>
                  <h3 className="font-medium text-slate-900 dark:text-white">{selectedYear}年 {monthName}</h3>
                  <span className="text-xs text-slate-400">（{monthNotes.length} 条）</span>
                </div>
                <div className="space-y-2">
                  {monthNotes.map((note) => (
                    <div key={note.id} className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          {note.title && <div className="font-medium text-sm mb-1">{note.title}</div>}
                          {note.shopId && shopNameMap[note.shopId] && (
                            <span className="chip bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 mr-2">
                              {shopNameMap[note.shopId]}
                            </span>
                          )}
                          {note.tags && note.tags.length > 0 && note.tags.map((tag, i) => (
                            <span key={i} className="chip bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200 mr-1">{tag}</span>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => setEditing(note)} className="text-primary-600 hover:underline text-xs">编辑</button>
                          <button onClick={() => handleDelete(note)} className="text-red-500 hover:underline text-xs ml-2">删除</button>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{note.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 编辑/新增弹窗 */}
      {(creating || editing) && (
        <NoteEditor
          note={editing}
          shops={shops}
          defaultYear={selectedYear}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function NoteEditor({ note, shops, defaultYear, onClose, onSaved }: {
  note: OperationNote | null;
  shops: Shop[];
  defaultYear: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [year, setYear] = useState(note?.year || defaultYear);
  const [month, setMonth] = useState(note?.month || new Date().getMonth() + 1);
  const [shopId, setShopId] = useState(note?.shopId || '');
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState((note?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      showToast('请输入笔记内容', 'warning');
      return;
    }
    setSaving(true);
    try {
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (note) {
        await updateOperationNote(note.id, { year, month, shopId: shopId || null, title, content, tags: tagArray });
        showToast('已更新', 'success');
      } else {
        await createOperationNote({ year, month, shopId: shopId || null, title, content, tags: tagArray });
        showToast('已保存', 'success');
      }
      onSaved();
    } catch (e: any) {
      showToast(e.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={note ? '编辑笔记' : '新增笔记'}
      size="lg"
      footer={<><button onClick={onClose} className="btn-secondary">取消</button><button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button></>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">年份</label>
            <select className="input" value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y} 年</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">月份</label>
            <select className="input" value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">店铺（可选）</label>
            <select className="input" value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">所有店铺</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">标题（可选）</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：双11大促总结" />
        </div>
        <div>
          <label className="label">标签（逗号分隔，可选）</label>
          <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="如：促销, 库存, 流量" />
        </div>
        <div>
          <label className="label">内容 *</label>
          <textarea
            className="input"
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录本月运营心得、经验教训、下月计划等..."
          />
        </div>
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-400">
          💡 明年同期会自动提示你这条笔记，帮助参考去年的节奏安排
        </div>
      </div>
    </Modal>
  );
}
