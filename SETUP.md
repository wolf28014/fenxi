# 电商数据分析软件 - 启用指南

## 🎉 部署完成！

✅ Web 版已上线：https://wolf28014.github.io/fenxi/
✅ GitHub 仓库：https://github.com/wolf28014/fenxi
✅ CI/CD 已配置：push 即自动部署 Web，打 tag 即构建 APK

---

## ⚠️ 首次使用前必须完成 2 步配置

### 步骤 1：在 Supabase 控制台执行数据库 Schema

1. 访问 https://supabase.com/dashboard 登录（用你的 GitHub 账号）
2. 选择项目 `kptggyteoejqrwzwzomx`
3. 左侧菜单点击 **SQL Editor**
4. 点击 **New query**
5. 打开本仓库的 `sql/schema.sql` 文件，复制全部内容粘贴到 SQL Editor
6. 点击 **Run**（运行）
7. 看到成功提示即可

这一步会创建 11 张数据表、RLS 安全策略、触发器、Realtime 实时同步订阅、Pro 会员兑换函数。

### 步骤 2：关闭邮箱验证（推荐）或验证邮箱

**方案 A：关闭邮箱验证（开发阶段推荐）**
1. Supabase 控制台 → **Authentication** → **Providers** → **Email**
2. 关闭 **Confirm email** 开关
3. 点击 **Save**

**方案 B：保留邮箱验证**
- 注册后在邮箱中找到 Supabase 发的激活邮件，点击激活链接即可

---

## 🚀 使用流程

### 1. 注册账号
- 访问 https://wolf28014.github.io/fenxi/
- 注册账号（邮箱 + 密码）

### 2. 配置 AI（可选，但推荐）
登录后点击右上角 **⚙ 设置** → **AI 配置**
- 推荐：智谱 GLM-4-Flash（免费）
- 申请地址：https://open.bigmodel.cn/
- 注册后在「API Keys」页面创建 Key，复制粘贴到设置中

### 3. 添加店铺
- 进入 **店铺管理** 菜单
- 点击 **+ 添加店铺**
- 选择平台（淘宝/天猫/拼多多/京东/抖音电商/其他）
- 填写店铺名称
- 保存后点击 **同步数据** 可一键生成 7 天 Mock 演示数据

### 4. 添加产品
- 进入 **产品中心** 菜单
- 点击 **+ 添加产品**
- 填写产品名称、SKU、分类

### 5. 录入数据
- 进入 **数据明细** 菜单
- 三个子标签：
  - **每日指标**：销售额/订单量/退款金额/访客数（4 项，推广费用在推广 tab 录入）
  - **每日推广**：8 项推广明细，可勾选「手动填写合计」直接覆盖汇总
  - **月度成本**：13 项成本明细，可勾选「手动填写合计」直接覆盖汇总
- 也可点击 **📥 Excel 导入** 批量导入历史数据

### 6. 查看分析
- 进入 **经营分析中心** 菜单
- 7 个子标签：总览/趋势分析/结构分析/同比分析/投产比/利润计算/AI 分析
- 顶部选择日期范围（今日/昨日/本周/上周/本月/上月/近30天/近90天/本自然年/本季节年/自定义）
- 切换自然年/季节年（季节年 = 7月1日 - 次年6月30日）

### 7. AI 助手
- 进入 **AI 助手** 菜单
- 可直接用自然语言提问："本月销售额多少？"、"哪个产品退款率最高？"、"给我一些优化建议"
- 或在 **经营分析中心 → AI 分析** 中点击 4 个 AI 功能卡片：
  - 💡 智能洞察：自动扫描异常和趋势
  - 🎯 经营建议：分析各渠道投产比给建议
  - 🔮 销售预测：基于历史预测下月销售额
  - 📄 智能报表：一键生成 Markdown 经营报告

---

## 📱 Android APK 构建

1. 在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加以下 Secrets（可选，用于 APK 签名）：
   - `SIGNING_KEY`：keystore 文件的 base64 编码
   - `ALIAS`：签名别名
   - `KEY_STORE_PASSWORD`：keystore 密码
   - `KEY_PASSWORD`：key 密码

2. 打 tag 触发 APK 构建：
```bash
git tag v1.0.0
git push origin v1.0.0
```

3. 在 GitHub Actions 页面查看构建进度
4. 构建完成后在 Releases 页面下载 APK

---

## 🔧 后续可调整

- 修改 Supabase 项目：编辑 `src/lib/supabase.ts`
- 修改 AI 模型：在 App 设置 → AI 配置中切换
- 配置淘宝开放平台 API：在 App 设置 → 淘宝 API 中填入 AppKey/AppSecret
- 升级 Pro 会员：在 App 设置 → Pro 会员中输入兑换码（需先在 Supabase 的 `license_codes` 表插入兑换码）

---

## 🆘 常见问题

**Q: 登录提示 "Email not confirmed"**
A: 按上面步骤 2 处理，或在邮箱中点击激活链接

**Q: AI 不工作**
A: 检查设置 → AI 配置中的 API Key 是否正确

**Q: 同步 Mock 数据没有反应**
A: Mock 数据是基于当天的，请确认你的浏览器时间正常

**Q: 想要内置 Pro Key**
A: 在 Supabase 控制台 → Table Editor → `app_config` 表 → 修改 `ai_api_key` 字段为你自己的 Key
