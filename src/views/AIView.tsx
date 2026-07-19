import { useEffect, useState, useRef, useMemo } from 'react';
import type { Shop, Product, DailyMetric, DailyPromotion, MonthlyCost, MetricsSummary } from '@/types';
import { fetchProducts, fetchDailyMetrics, fetchDailyPromotions, fetchMonthlyCosts } from '@/lib/db';
import { naturalLanguageQuery } from '@/lib/ai';
import { calculateMetrics, getQuickRange } from '@/lib/calc';
import { showToast } from '@/components/Toast';

interface Props {
  currentShop: Shop | null;
  shops: Shop[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function AIView({ currentShop, shops }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [metrics, setMetrics] = useState<DailyMetric[]>([]);
  const [promotions, setPromotions] = useState<DailyPromotion[]>([]);
  const [costs, setCosts] = useState<MonthlyCost[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const summaryRange = useMemo(() => getQuickRange('thisMonth'), []);

  // 加载当前店铺数据
  useEffect(() => {
    if (!currentShop) return;
    const range = summaryRange;
    Promise.all([
      fetchProducts(currentShop.id),
      fetchDailyMetrics(currentShop.id, null, range.start, range.end),
      fetchDailyPromotions(currentShop.id, null, range.start, range.end),
      fetchMonthlyCosts(currentShop.id, null, new Date(range.start).getFullYear(), new Date(range.start).getMonth() + 1, new Date(range.end).getFullYear(), new Date(range.end).getMonth() + 1),
    ]).then(([p, m, pr, c]) => {
      setProducts(p);
      setMetrics(m);
      setPromotions(pr);
      setCosts(c);
    }).catch(() => {});
  }, [currentShop, summaryRange.start, summaryRange.end]);

  const shopCostRate = currentShop?.defaultCostRate || 0;
  const summary: MetricsSummary = useMemo(() => calculateMetrics(metrics, promotions, costs, [], shopCostRate, summaryRange), [metrics, promotions, costs, shopCostRate, summaryRange.start, summaryRange.end]);

  const quickQuestions = [
    '本月销售额是多少？',
    '退款率最高的产品是哪个？',
    '哪个推广渠道投产比最高？',
    '当前利润情况如何？',
    '给我一些优化建议',
  ];

  const handleSend = async (text?: string) => {
    const q = (text || input).trim();
    if (!q || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now() }]);

    try {
      await naturalLanguageQuery(
        q,
        {
          shops,
          products,
          currentShop: currentShop || undefined,
          metrics: summary,
          dailyMetrics: metrics,
          promotions,
          costs,
        },
        (token) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + token } : m)),
          );
        },
      );
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, content: '抱歉，出错了：' + e.message } : m)),
      );
      showToast(e.message || 'AI 调用失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  if (!currentShop) {
    return (
      <div className="card p-12 text-center">
        <div className="text-5xl mb-4">🤖</div>
        <p className="text-slate-500">请先在「店铺管理」中添加店铺</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">AI 经营助手</h2>
        <p className="text-sm text-slate-500 mt-1">
          {currentShop.name} · 用自然语言提问，AI 帮你分析数据
        </p>
      </div>

      {/* 对话区 */}
      <div className="card flex-1 flex flex-col min-h-[400px] max-h-[calc(100vh-280px)] lg:max-h-[calc(100vh-200px)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-lg font-medium text-slate-700 dark:text-slate-200 mb-2">我是你的电商经营助手</h3>
              <p className="text-sm text-slate-500 mb-6">试试这些问题：</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(q)}
                    className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm'
                }`}>
                  {m.content || (loading && m.role === 'assistant' ? '思考中...' : '')}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 输入区 */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="问我任何经营数据问题..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="btn-primary px-5"
          >
            {loading ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
