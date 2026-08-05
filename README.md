# 电商数据分析软件

> 多店铺多产品电商经营分析平台，支持 PC Web + Android APP 数据实时同步

## 📋 功能特性

### 1. 经营分析中心
- **KPI 卡片**：12 项核心指标实时展示（销售额、净销售额、退款率、推广占比、投产比、利润等）
- **趋势分析**：销售额/订单量/访客数随时间变化的折线图
- **结构分析**：推广费用构成饼图（8 项）、成本构成饼图（13 项）
- **同比分析**：今年 vs 去年、自然年 vs 季节年柱状对比图
- **投产比分析**：推广费用 vs 销售额散点图，识别高效渠道
- **利润计算**：完整利润漏斗 + 明细表
- **AI 分析**：智能洞察、经营建议、销售预测、智能报表解读
- **快捷日期范围**：今日/昨日/本周/上周/本月/上月/近30天/近90天/本自然年/本季节年/自定义

### 2. 数据明细
- **每日 5 项核心指标录入**：销售额、订单量、退款金额、推广费用、访客数
- **每日 8 项推广明细**：货品全站推广、关键词推广、人群推广、店铺直达、内容营销、淘宝客、税务、其它
- **月度 13 项成本录入**：货品成本、红包、人工、其它、消费者体验提升计划服务费、先用后付技术服务费、基础软件服务费、限时红包代商家垫付扣回、商家集运物流服务费、品牌新享淘宝礼金软件服务费、公益宝贝、淘宝极速回款手动回款服务费、营销平台
- **合计可手动覆盖**：填写明细自动汇总，或勾选"手动填写合计"直接输入
- **Excel 批量导入**：支持模板下载和批量导入
- **数据导出**：导出当前数据到 Excel

### 3. 产品中心
- 产品 CRUD（名称、SKU、分类、状态）
- 单品分析卡片（销售额、退款率、利润、利润率）
- 产品排行：🔥 热销榜、⚠️ 高退款榜、💎 高利润榜、📉 亏损榜

### 4. 店铺管理
- 多店铺管理（淘宝、天猫、拼多多、京东、抖音电商、其他）
- 店铺级数据汇总
- 一键同步数据（淘宝 API 或 Mock 演示数据）

### 5. AI 经营助手
- 自然语言查询："本月销售额多少？"、"哪个产品退款率最高？"
- 流式输出，实时显示回答

## 🛠 技术栈

| 层级 | 方案 |
|------|------|
| 前端 | React 19 + TypeScript + Vite 8 + Tailwind CSS 3 |
| 跨端 | Capacitor 8（一套代码 → PC Web + Android APK） |
| 后端 | Supabase（Auth + PostgreSQL + Realtime + RLS） |
| 同步 | IndexedDB 离线 + Realtime WebSocket + 30 秒轮询兜底 |
| AI | 前端直连 OpenAI 兼容接口（智谱 GLM / DeepSeek / Moonshot / OpenAI） |
| 图表 | ECharts 5 |
| 表格 | SheetJS (xlsx) |
| CI/CD | GitHub Actions（Web 自动部署 + APK 自动签名发布） |

## 📐 自动计算指标

| 指标 | 公式 |
|------|------|
| 累积销售额 | SUM(sales_amount) |
| 累积退款 | SUM(refund_amount) |
| 净销售额 | 销售额 - 退款金额 |
| 退款率 | 退款金额 / 销售额 × 100% |
| 同比去年 | (今年 - 去年同期) / 去年同期 × 100% |
| 推广占比 | 推广费 / 销售额 × 100% |
| 累积推广占比 | 累积推广费 / 累积销售额 × 100% |
| 累积净销售额 | 累积销售额 - 累积退款 |
| 累积净推广费率 | 累积推广费 / 累积净销售额 × 100% |
| 当日投产比 | 销售额 / 推广费 |
| 累积净投产比 | 累积净销售额 / 累积推广费 |
| 利润 | 净销售额 - 总成本 - 推广费用 |
| 利润率 | 利润 / 净销售额 × 100% |

## 📅 自然年 vs 季节年

- **自然年**：1月1日 - 12月31日
- **季节年**：7月1日 - 次年6月30日

## 🚀 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build

# 预览构建结果
npm run preview
```

## 📱 Android APP 构建

```bash
# 添加 Android 平台（首次）
npx cap add android

# 同步 Web 资源到 Android
npx cap sync android

# 在 Android Studio 中打开
npx cap open android

# 或使用 GitHub Actions 自动构建（推送 v* tag 触发）
git tag v1.0.0
git push origin v1.0.0
```

## 🔧 配置说明

### Supabase 配置
1. 在 Supabase 控制台创建新项目
2. 在 SQL Editor 中执行 `sql/schema.sql`
3. 在 `src/lib/supabase.ts` 中替换 URL 和 anon key

### AI 配置
- 普通用户：在 App 设置中填写自己的 API Key
- Pro 会员：使用内置云端 Key（通过 `app_config` 表配置）
- 推荐使用智谱 GLM-4-Flash（免费）：https://open.bigmodel.cn/

### 淘宝 API 配置
- 在 App 设置 → 淘宝 API 中填入 AppKey/AppSecret
- 未配置时使用 Mock 演示数据
- 真实对接需要在淘宝开放平台注册应用并通过审核

## 📁 项目结构

```
ecom-analytics/
├── src/
│   ├── components/      # 通用组件（Modal、Toast、EChart、AuthScreen 等）
│   ├── views/           # 5 个主视图（Analysis、Detail、Product、Shop、AI）
│   ├── lib/             # 核心库（auth、db、ai、calc、excel、supabase、taobao-api）
│   ├── types/           # TypeScript 类型定义
│   ├── App.tsx          # 主入口
│   ├── main.tsx         # React 入口
│   └── index.css        # Tailwind 样式
├── sql/
│   └── schema.sql       # 数据库建表脚本（含 RLS、触发器、Realtime）
├── .github/workflows/   # CI/CD 工作流
├── capacitor.config.ts  # Capacitor 配置
├── vite.config.ts       # Vite 配置
├── tailwind.config.mjs  # Tailwind 配置
└── package.json
```

## 📜 License

MIT
