import type * as ExcelJS from 'exceljs';
import { upsertDailyMetric, upsertDailyPromotion, upsertMonthlyCost, fetchMonthlyCosts, upsertDailyMetrics, upsertDailyPromotions, upsertMonthlyCosts } from './db';
import { PROMOTION_FIELDS, COST_FIELDS, type Shop, type MonthlyCost } from '@/types';
import { formatLocalDate } from './calc';

// ============= 生意参谋字段映射表 =============
// 生意参谋导出的字段名 → 软件字段
const SYP_FIELD_MAP: Record<string, { target: 'metric' | 'promo'; key: string; label?: string }> = {
  '统计日期': { target: 'metric', key: 'date' },
  '日期': { target: 'metric', key: 'date' },
  '店铺名称': { target: 'metric', key: '_shop_name' }, // 忽略，使用当前选中店铺
  '店铺': { target: 'metric', key: '_shop_name' },
  '访客数': { target: 'metric', key: 'visitorCount' },
  '支付金额': { target: 'metric', key: 'salesAmount' },
  '支付买家数': { target: 'metric', key: 'orderCount' }, // 支付买家数≈订单量
  '支付件数': { target: 'metric', key: 'orderCount' },
  '成功退款金额': { target: 'metric', key: 'refundAmount' },
  '退款金额': { target: 'metric', key: 'refundAmount' },
  // 推广花费
  '全站推广花费': { target: 'promo', key: 'productSitePromo', label: '货品全站推广' },
  '全站推广费用': { target: 'promo', key: 'productSitePromo', label: '货品全站推广' },
  '关键词推广花费': { target: 'promo', key: 'keywordPromo', label: '关键词推广' },
  '关键词推广费用': { target: 'promo', key: 'keywordPromo', label: '关键词推广' },
  '精准人群推广花费': { target: 'promo', key: 'audiencePromo', label: '人群推广' },
  '人群推广花费': { target: 'promo', key: 'audiencePromo', label: '人群推广' },
  '智能场景花费': { target: 'promo', key: 'otherPromo', label: '其它' }, // 智能场景归入"其它"
  '智能推广花费': { target: 'promo', key: 'otherPromo', label: '其它' },
  '淘宝客佣金': { target: 'promo', key: 'taobaoKe', label: '淘宝客' },
  '淘宝客花费': { target: 'promo', key: 'taobaoKe', label: '淘宝客' },
  '内容营销花费': { target: 'promo', key: 'contentMarketing', label: '内容营销' },
  '店铺直达花费': { target: 'promo', key: 'storeDirect', label: '店铺直达' },
};

// ============= 下载模板 =============

export async function exportToExcelTemplate(type: 'metrics' | 'promotions' | 'costs' | 'syp') {
  const ExcelJSRuntime = await getExcelJS();
  let headers: string[] = [];
  let sheetName = '';
  let sampleRows: any[] = [];

  if (type === 'metrics') {
    headers = ['日期', '销售额', '订单量', '退款金额', '推广费用', '访客数'];
    sheetName = '每日数据';
    sampleRows = [
      { '日期': '2026-01-01', '销售额': 1500.5, '订单量': 30, '退款金额': 50, '推广费用': 200, '访客数': 800 },
      { '日期': '2026-01-02', '销售额': 1800, '订单量': 35, '退款金额': 0, '推广费用': 180, '访客数': 950 },
    ];
  } else if (type === 'promotions') {
    headers = ['日期', ...PROMOTION_FIELDS.map((f) => f.label)];
    sheetName = '每日推广';
    sampleRows = [
      { '日期': '2026-01-01', '货品全站推广': 200, '关键词推广': 150, '人群推广': 100, '店铺直达': 50, '内容营销': 80, '淘宝客': 30, '其它': 10 },
    ];
  } else if (type === 'costs') {
    // 新格式：月份 / 业务大类 / 扣费金额合计
    headers = ['月份', '业务大类', '扣费金额合计 (元)'];
    sheetName = '月度成本';
    sampleRows = [
      { '月份': '2026-01', '业务大类': '货品成本', '扣费金额合计 (元)': 5000 },
      { '月份': '2026-01', '业务大类': '红包', '扣费金额合计 (元)': 200 },
      { '月份': '2026-01', '业务大类': '人工', '扣费金额合计 (元)': 1000 },
      { '月份': '2026-01', '业务大类': '税务', '扣费金额合计 (元)': 100 },
      { '月份': '2026-02', '业务大类': '货品成本', '扣费金额合计 (元)': 5500 },
    ];
  } else if (type === 'syp') {
    // 生意参谋格式模板
    headers = ['统计日期', '店铺名称', '访客数', '支付金额', '支付买家数', '支付转化率', 'UV价值', '全站推广花费', '关键词推广花费', '精准人群推广花费', '智能场景花费', '淘宝客佣金', '成功退款金额'];
    sheetName = '生意参谋导入模板';
    sampleRows = [
      { '统计日期': '2026-07-01', '店铺名称': '天猫旗舰店', '访客数': 1250, '支付金额': 3580.5, '支付买家数': 28, '支付转化率': '2.24%', 'UV价值': '2.86', '全站推广花费': 280, '关键词推广花费': 150, '精准人群推广花费': 80, '智能场景花费': 50, '淘宝客佣金': 30, '成功退款金额': 65 },
    ];
  }

  const wb = new ExcelJSRuntime.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = headers.map((header) => ({ header, key: header, width: 18 }));
  ws.addRows(sampleRows);
  await downloadWorkbook(wb, `${sheetName}.xlsx`);
}

// ============= 解析数字（处理 "2.24%" / "¥1,234" 等格式） =============

function parseNumber(val: any): number {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return val;
  let s = String(val).trim();
  // 去除 ¥、￥、,、空格
  s = s.replace(/[¥￥,\s]/g, '');
  // 去除百分号（按值返回原值，不转换）
  if (s.endsWith('%')) {
    s = s.slice(0, -1);
    return Number(s) || 0;
  }
  return Number(s) || 0;
}

// ============= 解析日期（处理各种格式） =============

function parseDate(val: any): string {
  if (val == null || val === '') return '';
  if (val instanceof Date) {
    // 校验日期有效性（避免 Excel 日期序列号误转）
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return formatLocalDate(val);
    }
    return '';
  }
  let s = String(val).trim();
  // 处理 "2026/7/1" → "2026-07-01"
  s = s.replace(/\//g, '-');
  // 处理 "2026.7.1" → "2026-07-01"
  s = s.replace(/\./g, '-');
  // 处理 "2026年7月1日"
  s = s.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '');
  // 处理 "2026-7-1" → "2026-07-01"
  const parts = s.split('-').map((p) => p.trim());
  if (parts.length === 3) {
    const y = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const d = parseInt(parts[2]);
    // 校验日期有效性
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // 无效日期（如 0008-13-24）返回空
    return '';
  }
  // 已经是 "2026-07-01" 格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 处理 Excel 日期序列号（数字）
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s);
    // Excel 日期序列号：1 = 1900-01-01，44927 = 2022-12-01
    if (serial > 30000 && serial < 80000) {
      // 转换：以 1900-01-01 为基准（注意 Excel 1900 闰年 bug）
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      const y = date.getUTCFullYear();
      const m = date.getUTCMonth() + 1;
      const d = date.getUTCDate();
      if (y >= 2000 && y <= 2100) {
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }
  return '';
}

// ============= 解析 Excel（只解析不写入） =============

export interface ParsedRow {
  [key: string]: any;
}

export interface ParseResult {
  type: 'syp' | 'metrics' | 'promotions' | 'costs';
  rows: ParsedRow[];
  totalRows: number;
  validRows: number;
  preview: ParsedRow[]; // 前 50 行预览
  columns: string[]; // 列名
  invalidReasons?: Record<string, number>; // 无效行原因统计
}

export async function parseExcelFile(
  file: File,
  hintType?: 'metrics' | 'promotions' | 'costs' | 'auto',
): Promise<ParseResult> {
  if (file.size > 10 * 1024 * 1024) throw new Error('文件不能超过 10MB');
  const ExcelJSRuntime = await getExcelJS();
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJSRuntime.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('文件没有工作表');
  const headers = (ws.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? '').trim());
  const rows: ParsedRow[] = [];
  ws.eachRow((row: ExcelJS.Row, rowNumber: number) => {
    if (rows.length >= 100_000) return;
    if (rowNumber === 1) return;
    const values = row.values as unknown[];
    const parsed: ParsedRow = {};
    headers.forEach((header, index) => { parsed[header] = String(values[index + 1] ?? ''); });
    rows.push(parsed);
  });

  if (rows.length === 0) throw new Error('文件无数据');

  // 自动识别格式
  let actualType: 'syp' | 'metrics' | 'promotions' | 'costs' = (hintType as any) || 'metrics';
  if (!hintType || hintType === 'auto') {
    const firstRow = rows[0];
    const keys = Object.keys(firstRow).map((k) => k.trim());
    if (keys.some((k) => SYP_FIELD_MAP[k])) {
      actualType = 'syp';
    } else if (keys.includes('月份') || keys.includes('业务大类') || keys.includes('扣费金额合计')) {
      actualType = 'costs';
    } else if (keys.includes('年份')) {
      actualType = 'costs';
    } else if (keys.some((k) => PROMOTION_FIELDS.some((f) => f.label === k))) {
      actualType = 'promotions';
    } else {
      actualType = 'metrics';
    }
  }

  // 清理字段名空格
  const cleanedRows = rows.map((row) => {
    const cleaned: any = {};
    Object.keys(row).forEach((k) => {
      cleaned[k.trim()] = row[k];
    });
    return cleaned;
  });

  // 统计有效行数（按类型判断 - 必须所有必填字段都有效）
  let validRows = 0;
  const invalidReasons: Record<string, number> = {};
  for (const row of cleanedRows) {
    if (actualType === 'syp') {
      const date = parseDate(row['统计日期'] || row['日期']);
      if (date) validRows++;
      else invalidReasons['日期无效'] = (invalidReasons['日期无效'] || 0) + 1;
    } else if (actualType === 'metrics') {
      const date = parseDate(row['日期'] || row['统计日期']);
      if (date) validRows++;
      else invalidReasons['日期无效'] = (invalidReasons['日期无效'] || 0) + 1;
    } else if (actualType === 'promotions') {
      const date = parseDate(row['日期']);
      if (date) validRows++;
      else invalidReasons['日期无效'] = (invalidReasons['日期无效'] || 0) + 1;
    } else if (actualType === 'costs') {
      // 成本格式：月份 + 业务大类（非空）+ 金额（非0）即有效
      const month = parseMonth(row['月份']);
      const category = String(row['业务大类'] || '').trim();
      const amount = parseNumber(row['扣费金额合计 (元)'] ?? row['扣费金额合计'] ?? row['扣费金额'] ?? row['金额']);
      if (!month) invalidReasons['月份无法解析'] = (invalidReasons['月份无法解析'] || 0) + 1;
      else if (!category) invalidReasons['业务大类为空'] = (invalidReasons['业务大类为空'] || 0) + 1;
      else if (amount === 0) invalidReasons['金额为0或空'] = (invalidReasons['金额为0或空'] || 0) + 1;
      else validRows++;
    }
  }

  // 列名
  const columns = cleanedRows.length > 0 ? Object.keys(cleanedRows[0]) : [];

  return {
    type: actualType,
    rows: cleanedRows,
    totalRows: cleanedRows.length,
    validRows,
    preview: cleanedRows, // 预览所有数据（不限行数）
    columns,
    invalidReasons,
  };
}

// ============= 解析月份（支持 2026-01 / 2026/01 / 2026年01月 / 2026.01） =============

export function parseMonth(val: any): { year: number; month: number } | null {
  if (val == null || val === '') return null;
  if (val instanceof Date) {
    return { year: val.getFullYear(), month: val.getMonth() + 1 };
  }
  let s = String(val).trim();
  // 去除"月"、"年"字
  s = s.replace(/年/g, '-').replace(/月/g, '').replace(/\//g, '-').replace(/\./g, '-');
  const parts = s.split('-').map((p) => p.trim());
  if (parts.length === 2) {
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    if (year > 1900 && month >= 1 && month <= 12) return { year, month };
  }
  if (parts.length === 1 && parts[0].length === 6) {
    // 202601
    const year = parseInt(parts[0].slice(0, 4));
    const month = parseInt(parts[0].slice(4, 6));
    if (year > 1900 && month >= 1 && month <= 12) return { year, month };
  }
  return null;
}

// ============= 执行导入（根据 ParseResult 写入数据库） =============

export async function executeImport(
  parseResult: ParseResult,
  shopId: string,
  productId: string | null | undefined,
): Promise<{ count: number; type: string; detail?: string }> {
  return executeImportWithProgress(parseResult, shopId, productId);
}

// 带进度回调的导入函数
export async function executeImportWithProgress(
  parseResult: ParseResult,
  shopId: string,
  productId: string | null | undefined,
  onProgress?: (current: number, total: number) => void,
): Promise<{ count: number; type: string; detail?: string }> {
  const { type, rows } = parseResult;
  let count = 0;

  if (type === 'syp') {
    // 生意参谋格式批量导入（每批 50 条）
    const total = rows.length;
    const BATCH_SIZE = 50;
    const validMetrics: any[] = [];
    const validPromos: any[] = [];

    // 先解析所有行
    for (const row of rows) {
      const parsed = parseSypRow(row, shopId, productId);
      if (parsed) {
        validMetrics.push(parsed.metric);
        if (parsed.promo) validPromos.push(parsed.promo);
      }
    }

    // 分批 upsert metrics
    for (let i = 0; i < validMetrics.length; i += BATCH_SIZE) {
      const batch = validMetrics.slice(i, i + BATCH_SIZE);
      await upsertDailyMetrics(batch);
      count += batch.length;
      onProgress?.(count, total);
    }

    // 分批 upsert promotions
    for (let i = 0; i < validPromos.length; i += BATCH_SIZE) {
      const batch = validPromos.slice(i, i + BATCH_SIZE);
      await upsertDailyPromotions(batch);
    }

    return { count, type, detail: `导入 ${count} 条生意参谋数据` };
  }

  if (type === 'costs') {
    // 成本格式：先按月份+分类聚合，再写入（同月同分类累加）
    const aggregated: Record<string, Record<string, number>> = {}; // key: "year-month", value: { costFieldKey: amount }
    const monthKeys: string[] = [];
    let skipped = 0;

    for (const row of rows) {
      const monthData = parseMonth(row['月份']);
      if (!monthData) { skipped++; continue; }
      const { year, month } = monthData;
      const category = String(row['业务大类'] || '').trim();
      const amount = parseNumber(row['扣费金额合计 (元)'] ?? row['扣费金额合计'] ?? row['扣费金额'] ?? row['金额']);
      if (!category || amount === 0) { skipped++; continue; }

      // 查找对应字段
      let costField = COST_FIELDS.find((f) => f.label === category);
      if (!costField) {
        costField = COST_FIELDS.find((f) => category.includes(f.label) || f.label.includes(category));
      }
      if (!costField) {
        costField = COST_FIELDS.find((f) => f.key === 'otherCost');
      }

      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      if (!aggregated[monthKey]) {
        aggregated[monthKey] = {};
        monthKeys.push(monthKey);
      }
      aggregated[monthKey][costField!.key] = (aggregated[monthKey][costField!.key] || 0) + amount;
    }

    // 按月份逐个写入（每月一次 upsert）
    const total = monthKeys.length;
    for (const monthKey of monthKeys) {
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);

      // 拉取该月已有数据
      const existingCosts = await fetchMonthlyCosts(shopId, productId || null, year, month, year, month);
      const existing = existingCosts[0];

      const payload: any = {
        shopId,
        productId: productId || null,
        year,
        month,
        productCost: existing?.productCost || 0,
        redPacket: existing?.redPacket || 0,
        labor: existing?.labor || 0,
        otherCost: existing?.otherCost || 0,
        tax: existing?.tax || 0,
        consumerExperienceFee: existing?.consumerExperienceFee || 0,
        bnplFee: existing?.bnplFee || 0,
        basicSoftwareFee: existing?.basicSoftwareFee || 0,
        limitedRedPacket: existing?.limitedRedPacket || 0,
        logisticsFee: existing?.logisticsFee || 0,
        brandGiftFee: existing?.brandGiftFee || 0,
        charityBaby: existing?.charityBaby || 0,
        quickPaymentFee: existing?.quickPaymentFee || 0,
        marketingPlatform: existing?.marketingPlatform || 0,
        isTotalOverridden: existing?.isTotalOverridden || false,
        costSource: 'manual' as const,
      };

      // 覆盖写入聚合后的金额（不再累加已有值）
      for (const [fieldKey, amount] of Object.entries(aggregated[monthKey])) {
        payload[fieldKey] = amount as number;
      }

      await upsertMonthlyCost(payload);
      count++;
      onProgress?.(count, total);
    }

    return {
      count: monthKeys.length,
      type,
      detail: `写入 ${monthKeys.length} 个月份的成本数据（跳过 ${skipped} 条无效行）`,
    };
  }

  // metrics / promotions 批量导入（每批 50 条，一次请求）
  const total = rows.length;
  const BATCH_SIZE = 50;
  let processed = 0;

  // 先解析所有有效行
  const validData: any[] = [];
  for (const row of rows) {
    if (type === 'metrics') {
      const date = parseDate(row['日期'] || row['统计日期']);
      if (!date) continue;
      validData.push({
        shopId,
        productId: productId || null,
        date,
        salesAmount: parseNumber(row['销售额'] ?? row['支付金额']),
        orderCount: parseNumber(row['订单量'] ?? row['支付买家数']),
        refundAmount: parseNumber(row['退款金额'] ?? row['成功退款金额']),
        promotionCost: parseNumber(row['推广费用'] ?? row['推广费'] ?? row['推广花费']),
        visitorCount: parseNumber(row['访客数']),
        dataSource: 'excel',
      });
    } else if (type === 'promotions') {
      const date = parseDate(row['日期']);
      if (!date) continue;
      const payload: any = { shopId, productId: productId || null, date };
      PROMOTION_FIELDS.forEach((f) => {
        payload[f.key] = parseNumber(row[f.label]);
      });
      validData.push(payload);
    }
  }

  // 分批 upsert
  for (let i = 0; i < validData.length; i += BATCH_SIZE) {
    const batch = validData.slice(i, i + BATCH_SIZE);
    if (type === 'metrics') {
      await upsertDailyMetrics(batch);
    } else if (type === 'promotions') {
      await upsertDailyPromotions(batch);
    }
    count += batch.length;
    processed += batch.length;
    onProgress?.(processed, total);
  }

  return { count, type };
}

// 生意参谋单行导入（用于带进度导入）
// 生意参谋单行解析（不写入，返回数据用于批量导入）
function parseSypRow(row: any, shopId: string, productId: string | null | undefined): { metric: any; promo?: any } | null {
  const cleanRow: any = {};
  Object.keys(row).forEach((k) => { cleanRow[k.trim()] = row[k]; });

  const date = parseDate(cleanRow['统计日期'] || cleanRow['日期']);
  if (!date) return null;

  const salesAmount = parseNumber(cleanRow['支付金额']);
  const orderCount = parseNumber(cleanRow['支付买家数'] ?? cleanRow['支付件数']);
  const refundAmount = parseNumber(cleanRow['成功退款金额'] ?? cleanRow['退款金额']);
  const visitorCount = parseNumber(cleanRow['访客数']);

  const productSitePromo = parseNumber(cleanRow['全站推广花费'] ?? cleanRow['全站推广费用']);
  const keywordPromo = parseNumber(cleanRow['关键词推广花费'] ?? cleanRow['关键词推广费用']);
  const audiencePromo = parseNumber(cleanRow['精准人群推广花费'] ?? cleanRow['人群推广花费']);
  const otherPromo = parseNumber(cleanRow['智能场景花费'] ?? cleanRow['智能推广花费']);
  const taobaoKe = parseNumber(cleanRow['淘宝客佣金'] ?? cleanRow['淘宝客花费']);
  const contentMarketing = parseNumber(cleanRow['内容营销花费']);
  const storeDirect = parseNumber(cleanRow['店铺直达花费']);

  const promoTotal = productSitePromo + keywordPromo + audiencePromo + otherPromo + taobaoKe + contentMarketing + storeDirect;

  const metric = {
    shopId,
    productId: productId || null,
    date,
    salesAmount,
    orderCount,
    refundAmount,
    promotionCost: promoTotal,
    visitorCount,
    dataSource: 'excel',
  };

  let promo: any = null;
  if (promoTotal > 0) {
    promo = {
      shopId,
      productId: productId || null,
      date,
      productSitePromo,
      keywordPromo,
      audiencePromo,
      storeDirect,
      contentMarketing,
      taobaoKe,
      otherPromo,
      isTotalOverridden: false,
    };
  }

  return { metric, promo };
}

// 生意参谋单行导入（保留旧接口，内部调用批量）
async function importSypRow(row: any, shopId: string, productId: string | null | undefined) {
  const parsed = parseSypRow(row, shopId, productId);
  if (!parsed) return;
  await upsertDailyMetrics([parsed.metric]);
  if (parsed.promo) await upsertDailyPromotions([parsed.promo]);
}

// ============= 兼容旧接口（直接导入） =============

export async function importFromExcel(
  file: File,
  shopId: string,
  productId: string | null | undefined,
  type: 'metrics' | 'promotions' | 'costs' | 'auto',
): Promise<{ count: number; type: string; detail?: string }> {
  const parseResult = await parseExcelFile(file, type);
  return executeImport(parseResult, shopId, productId);
}

// ============= 生意参谋格式导入 =============

async function importSyp(rows: any[], shopId: string, productId: string | null | undefined): Promise<{ count: number; type: string; detail: string }> {
  let count = 0;
  let totalPromo = 0;

  for (const row of rows) {
    // 清理字段名（去除前后空格）
    const cleanRow: any = {};
    Object.keys(row).forEach((k) => {
      cleanRow[k.trim()] = row[k];
    });

    const date = parseDate(cleanRow['统计日期'] || cleanRow['日期']);
    if (!date) continue;

    // 提取核心指标
    const salesAmount = parseNumber(cleanRow['支付金额']);
    const orderCount = parseNumber(cleanRow['支付买家数'] ?? cleanRow['支付件数']);
    const refundAmount = parseNumber(cleanRow['成功退款金额'] ?? cleanRow['退款金额']);
    const visitorCount = parseNumber(cleanRow['访客数']);

    // 提取推广费用（合并各项）
    const productSitePromo = parseNumber(cleanRow['全站推广花费'] ?? cleanRow['全站推广费用']);
    const keywordPromo = parseNumber(cleanRow['关键词推广花费'] ?? cleanRow['关键词推广费用']);
    const audiencePromo = parseNumber(cleanRow['精准人群推广花费'] ?? cleanRow['人群推广花费']);
    const otherPromo = parseNumber(cleanRow['智能场景花费'] ?? cleanRow['智能推广花费']);
    const taobaoKe = parseNumber(cleanRow['淘宝客佣金'] ?? cleanRow['淘宝客花费']);
    const contentMarketing = parseNumber(cleanRow['内容营销花费']);
    const storeDirect = parseNumber(cleanRow['店铺直达花费']);

    const promoTotal = productSitePromo + keywordPromo + audiencePromo + otherPromo + taobaoKe + contentMarketing + storeDirect;
    totalPromo += promoTotal;

    // 写入每日指标（含推广费用总额）
    await upsertDailyMetric({
      shopId,
      productId: productId || null,
      date,
      salesAmount,
      orderCount,
      refundAmount,
      promotionCost: promoTotal,
      visitorCount,
      dataSource: 'excel',
    });

    // 同时写入推广明细表（如果有推广数据）
    if (promoTotal > 0) {
      await upsertDailyPromotion({
        shopId,
        productId: productId || null,
        date,
        productSitePromo,
        keywordPromo,
        audiencePromo,
        storeDirect,
        contentMarketing,
        taobaoKe,
        otherPromo,
        isTotalOverridden: false,
      } as any);
    }

    count++;
  }

  return {
    count,
    type: 'syp',
    detail: `导入 ${count} 条生意参谋数据，推广费用合计 ¥${totalPromo.toFixed(2)}`,
  };
}

// ============= 粘贴导入（从剪贴板文本解析） =============

export async function importFromClipboard(
  text: string,
  shopId: string,
  productId: string | null | undefined,
): Promise<{ count: number; type: string; detail: string }> {
  if (!text || !text.trim()) throw new Error('剪贴板内容为空');

  // 按行分割
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('数据至少需要表头+1行');

  // 解析为二维数组（支持 Tab / 逗号 / 多空格分隔）
  const parseLine = (line: string): string[] => {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(',')) return line.split(',');
    return line.split(/\s{2,}|\s+/);
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = cells[idx] || '';
    });
    rows.push(row);
  }

  // 自动识别格式（基于表头）
  let actualType: 'syp' | 'metrics' | 'promotions' | 'costs' = 'metrics';
  if (headers.some((h) => SYP_FIELD_MAP[h])) {
    actualType = 'syp';
  } else if (headers.includes('月份') || headers.includes('业务大类') || headers.includes('扣费金额合计') || headers.includes('年份')) {
    actualType = 'costs';
  } else if (headers.some((h) => PROMOTION_FIELDS.some((f) => f.label === h))) {
    actualType = 'promotions';
  } else {
    actualType = 'metrics';
  }

  if (actualType === 'syp') {
    return importSyp(rows, shopId, productId);
  }

  let count = 0;
  for (const row of rows) {
    if (actualType === 'metrics') {
      const date = parseDate(row['日期'] || row['统计日期']);
      if (!date) continue;
      await upsertDailyMetric({
        shopId,
        productId: productId || null,
        date,
        salesAmount: parseNumber(row['销售额'] ?? row['支付金额']),
        orderCount: parseNumber(row['订单量'] ?? row['支付买家数']),
        refundAmount: parseNumber(row['退款金额'] ?? row['成功退款金额']),
        promotionCost: parseNumber(row['推广费用'] ?? row['推广费'] ?? row['推广花费']),
        visitorCount: parseNumber(row['访客数']),
        dataSource: 'excel',
      });
    } else if (actualType === 'promotions') {
      const date = parseDate(row['日期']);
      if (!date) continue;
      const payload: any = { shopId, productId: productId || null, date };
      PROMOTION_FIELDS.forEach((f) => {
        payload[f.key] = parseNumber(row[f.label]);
      });
      payload.dataSource = 'excel';
      await upsertDailyPromotion(payload);
    } else {
      // 新格式：月份 / 业务大类 / 扣费金额合计
      const monthData = parseMonth(row['月份']);
      if (!monthData) continue;
      const { year, month } = monthData;
      const category = String(row['业务大类'] || '').trim();
      const amount = parseNumber(row['扣费金额合计 (元)'] ?? row['扣费金额合计'] ?? row['扣费金额'] ?? row['金额']);
      if (!category || amount === 0) continue;
      // 查找对应字段；未匹配的归到"其它"
      let costField = COST_FIELDS.find((f) => f.label === category);
      if (!costField) {
        costField = COST_FIELDS.find((f) => category.includes(f.label) || f.label.includes(category));
      }
      if (!costField) {
        costField = COST_FIELDS.find((f) => f.key === 'otherCost');
      }
      const existingCosts = await fetchMonthlyCosts(shopId, productId || null, year, month, year, month);
      const existing = existingCosts[0];
      const payload: any = {
        shopId,
        productId: productId || null,
        year,
        month,
        productCost: existing?.productCost || 0,
        redPacket: existing?.redPacket || 0,
        labor: existing?.labor || 0,
        otherCost: existing?.otherCost || 0,
        tax: existing?.tax || 0,
        consumerExperienceFee: existing?.consumerExperienceFee || 0,
        bnplFee: existing?.bnplFee || 0,
        basicSoftwareFee: existing?.basicSoftwareFee || 0,
        limitedRedPacket: existing?.limitedRedPacket || 0,
        logisticsFee: existing?.logisticsFee || 0,
        brandGiftFee: existing?.brandGiftFee || 0,
        charityBaby: existing?.charityBaby || 0,
        quickPaymentFee: existing?.quickPaymentFee || 0,
        marketingPlatform: existing?.marketingPlatform || 0,
        isTotalOverridden: existing?.isTotalOverridden || false,
        costSource: 'manual' as const,
      };
      payload[costField!.key] = amount;
      await upsertMonthlyCost(payload);
    }
    count++;
  }

  return { count, type: actualType, detail: `粘贴导入 ${count} 条数据` };
}

// ============= 导出数据 =============

export async function exportDataToExcel(
  shop: Shop,
  productName: string | undefined | null,
  data: { metrics: any[]; promotions: any[]; costs: any[] },
) {
  const ExcelJSRuntime = await getExcelJS();
  const wb = new ExcelJSRuntime.Workbook();
  const prefix = `${shop.name}${productName ? '_' + productName : ''}`;

  // 每日指标
  if (data.metrics.length > 0) {
    const rows = data.metrics.map((m) => ({
      日期: m.date,
      销售额: m.salesAmount,
      订单量: m.orderCount,
      退款金额: m.refundAmount,
      访客数: m.visitorCount,
    }));
    addObjectRows(wb.addWorksheet('每日指标'), rows);
  }

  // 推广
  if (data.promotions.length > 0) {
    const rows = data.promotions.map((p) => {
      const row: any = { 日期: p.date };
      PROMOTION_FIELDS.forEach((f) => {
        row[f.label] = p[f.key];
      });
      row['合计'] = p.total;
      return row;
    });
    addObjectRows(wb.addWorksheet('每日推广'), rows);
  }

  // 成本
  if (data.costs.length > 0) {
    const rows = data.costs.map((c) => {
      const row: any = { 年份: c.year, 月份: c.month };
      COST_FIELDS.forEach((f) => {
        row[f.label] = c[f.key];
      });
      row['合计'] = c.total;
      return row;
    });
    addObjectRows(wb.addWorksheet('月度成本'), rows);
  }

  await downloadWorkbook(wb, `${prefix}_数据导出.xlsx`);
}

function addObjectRows(sheet: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  sheet.columns = headers.map((header) => ({ header, key: header, width: 18 }));
  sheet.addRows(rows);
}

async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function getExcelJS(): Promise<typeof import('exceljs')> {
  const module = await import('exceljs');
  return (module as any).default || module;
}
