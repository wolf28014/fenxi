#!/usr/bin/env node
// 兑换码生成器
// 用法: node scripts/gen-license.js <数量> <套餐类型>
// 套餐类型: pro_monthly | pro_yearly | pro_lifetime
// 示例: node scripts/gen-license.js 10 pro_yearly

const https = require('https');

// Supabase 配置
const SUPABASE_URL = 'https://kptggyteoejqrwzwzomx.supabase.co';
const SUPABASE_SERVICE_KEY = ''; // 在这里填入你的 service_role key

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (i < 3) code += '-';
  }
  return code;
}

async function main() {
  const count = parseInt(process.argv[2]) || 1;
  const plan = process.argv[3] || 'pro_monthly';

  if (!['pro_monthly', 'pro_yearly', 'pro_lifetime'].includes(plan)) {
    console.error('套餐类型必须是: pro_monthly / pro_yearly / pro_lifetime');
    process.exit(1);
  }

  if (!SUPABASE_SERVICE_KEY) {
    // 不写数据库，只生成码
    console.log(`\n生成 ${count} 个兑换码（套餐: ${plan}）:\n`);
    console.log('兑换码列表:');
    console.log('='.repeat(50));
    for (let i = 0; i < count; i++) {
      console.log(`${i + 1}. ${generateCode()}`);
    }
    console.log('='.repeat(50));
    console.log('\n⚠️ 未配置 SERVICE_KEY，以上兑换码未写入数据库。');
    console.log('请手动到 Supabase Dashboard > Table Editor > license_codes 插入。');
    console.log('或填入 SERVICE_KEY 后重新运行自动写入。');
    return;
  }

  const codes = [];
  for (let i = 0; i < count; i++) codes.push(generateCode());

  const payload = codes.map(code => ({ code, plan }));
  const url = `${SUPABASE_URL}/rest/v1/license_codes`;
  const body = JSON.stringify(payload);

  const req = https.request(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 201) {
        console.log(`\n✅ 成功生成 ${count} 个兑换码并写入数据库！\n`);
        console.log('兑换码列表:');
        console.log('='.repeat(50));
        codes.forEach((code, i) => {
          const label = plan === 'pro_monthly' ? '月度' : plan === 'pro_yearly' ? '年度' : '终身';
          console.log(`${i + 1}. ${code}  (${label}Pro)`);
        });
        console.log('='.repeat(50));
      } else {
        console.error('❌ 写入失败:', res.statusCode, data);
      }
    });
  });
  req.on('error', console.error);
  req.write(body);
  req.end();
}

main();
