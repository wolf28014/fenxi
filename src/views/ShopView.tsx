import { useEffect, useState } from 'react';
import type { Shop, Platform } from '@/types';
import { PLATFORM_OPTIONS, PLATFORM_LABELS } from '@/types';
import { fetchShops, createShop, updateShop, deleteShop } from '@/lib/db';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';

interface Props {
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
  setCurrentShop: (shop: Shop | null) => void;
  currentShop: Shop | null;
}

export default function ShopView({ shops, setShops, setCurrentShop, currentShop }: Props) {
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Shop | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchShops();
      setShops(data);
      if (data.length > 0 && !currentShop) {
        setCurrentShop(data[0]);
      }
    } catch (e: any) {
      showToast(e.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('realtime:shops', handler);
    return () => window.removeEventListener('realtime:shops', handler);
  }, []);

  const handleDelete = async (shop: Shop) => {
    if (!confirm(`确定删除店铺"${shop.name}"吗？\n\n注意：该店铺下所有产品、数据、推广、成本都将被删除。`)) return;
    try {
      await deleteShop(shop.id);
      const next = shops.filter((s) => s.id !== shop.id);
      setShops(next);
      if (currentShop?.id === shop.id) {
        setCurrentShop(next[0] || null);
      }
      showToast('已删除', 'success');
    } catch (e: any) {
      showToast(e.message || '删除失败', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">店铺管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理你的所有电商平台店铺</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">+ 添加店铺</button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">加载中...</div>
      ) : shops.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">还没有店铺</h3>
          <p className="text-sm text-slate-500 mb-4">添加你的第一个店铺开始经营分析</p>
          <button onClick={() => setCreating(true)} className="btn-primary">+ 立即添加</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.map((shop) => {
            return (
              <div key={shop.id} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: PLATFORM_OPTIONS.find((p) => p.value === shop.platform)?.color }}
                    >
                      {PLATFORM_LABELS[shop.platform].slice(0, 1)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{shop.name}</div>
                      <div className="text-xs text-slate-500">{PLATFORM_LABELS[shop.platform]}</div>
                    </div>
                  </div>
                  <span className={`chip ${shop.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                    {shop.status === 'active' ? '运营中' : '已停用'}
                  </span>
                </div>

                {shop.platformAccount && (
                  <div className="text-xs text-slate-400 mb-1">平台账号：{shop.platformAccount}</div>
                )}
                {shop.defaultCostRate > 0 && (
                  <div className="text-xs text-amber-600 mb-2">
                    默认货品成本率：{shop.defaultCostRate.toFixed(2)}%
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <button onClick={() => setEditing(shop)} className="btn-secondary flex-1 text-xs">编辑</button>
                  <button onClick={() => handleDelete(shop)} className="btn-danger text-xs">删除</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ShopEditor
          shop={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ShopEditor({ shop, onClose, onSaved }: { shop: Shop | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(shop?.name || '');
  const [platform, setPlatform] = useState<Platform>(shop?.platform || 'taobao');
  const [platformAccount, setPlatformAccount] = useState(shop?.platformAccount || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(shop?.status || 'active');
  const [defaultCostRate, setDefaultCostRate] = useState<string>(shop?.defaultCostRate?.toString() || '0');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name) {
      showToast('请输入店铺名称', 'warning');
      return;
    }
    const rate = parseFloat(defaultCostRate) || 0;
    if (rate < 0 || rate > 100) {
      showToast('货品成本百分比应在 0-100 之间', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (shop) {
        await updateShop(shop.id, { name, platform, platformAccount, status, defaultCostRate: rate });
        showToast('已更新', 'success');
      } else {
        await createShop({ name, platform, platformAccount, status, sortOrder: 0, defaultCostRate: rate });
        showToast('已添加', 'success');
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
      title={shop ? '编辑店铺' : '添加店铺'}
      footer={
        <>
          <button onClick={onClose} className="btn-secondary">取消</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? '保存中...' : '保存'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label">店铺名称 *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：天猫旗舰店" />
        </div>
        <div>
          <label className="label">平台 *</label>
          <div className="grid grid-cols-3 gap-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value as Platform)}
                className={`p-3 rounded-lg border-2 text-sm transition ${
                  platform === p.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="w-6 h-6 mx-auto mb-1 rounded-full" style={{ backgroundColor: p.color }} />
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">平台账号（可选）</label>
          <input className="input" value={platformAccount} onChange={(e) => setPlatformAccount(e.target.value)} placeholder="店铺ID或账号" />
        </div>
        <div>
          <label className="label">默认货品成本百分比 (%)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            className="input"
            value={defaultCostRate}
            onChange={(e) => setDefaultCostRate(e.target.value)}
            placeholder="如 60 表示 60%"
          />
          <p className="text-xs text-slate-400 mt-1">
            录入每日数据时，货品成本默认按"销售额 × 此百分比"自动计算；可在录入时手动覆盖。
          </p>
        </div>
        <div>
          <label className="label">状态</label>
          <div className="flex gap-2">
            <button
              onClick={() => setStatus('active')}
              className={`flex-1 p-2 rounded-lg border text-sm ${status === 'active' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200'}`}
            >
              运营中
            </button>
            <button
              onClick={() => setStatus('inactive')}
              className={`flex-1 p-2 rounded-lg border text-sm ${status === 'inactive' ? 'border-slate-500 bg-slate-100 text-slate-700' : 'border-slate-200'}`}
            >
              已停用
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
