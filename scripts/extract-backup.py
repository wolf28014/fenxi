#!/usr/bin/env python3
"""
从 Supabase 备份文件中提取 public 表数据，生成 INSERT SQL
用法: python3 scripts/extract-backup.py
"""
import re
import sys

backup_file = '/tmp/backup'
output_file = '/tmp/restore_data.sql'

# 需要提取的表（按依赖顺序）
tables = [
    'user_settings',
    'shops', 
    'products',
    'daily_metrics',
    'daily_promotion',
    'monthly_cost',
    'operation_notes',
    'license_codes',
    'app_config',
]

with open(backup_file, 'r', encoding='utf-8') as f:
    content = f.read()

with open(output_file, 'w', encoding='utf-8') as out:
    out.write("-- 数据恢复脚本（从备份提取）\n")
    out.write("-- 在新 Supabase 项目 SQL Editor 中执行\n\n")
    
    for table in tables:
        # 找 COPY public.{table} ... FROM stdin; 到 \. 的数据块
        pattern = rf'COPY public\.{table} \(([^)]+)\) FROM stdin;\n(.*?)\n\\\.'
        match = re.search(pattern, content, re.DOTALL)
        
        if match:
            columns = match.group(1)
            data_lines = match.group(2).strip().split('\n')
            
            if not data_lines or (len(data_lines) == 1 and data_lines[0] == ''):
                out.write(f"-- {table}: 无数据\n\n")
                continue
            
            out.write(f"-- {table}: {len(data_lines)} 条记录\n")
            out.write(f"-- 先清空旧数据（如果有）\n")
            out.write(f"DELETE FROM public.{table};\n\n")
            
            for line in data_lines:
                fields = line.split('\t')
                # 转义单引号，处理 \N (NULL)
                values = []
                for f in fields:
                    if f == '\\N':
                        values.append('NULL')
                    else:
                        escaped = f.replace("'", "''")
                        values.append(f"'{escaped}'")
                
                out.write(f"INSERT INTO public.{table} ({columns}) VALUES ({', '.join(values)});\n")
            
            out.write(f"\n")
        else:
            out.write(f"-- {table}: 未找到数据\n\n")
    
    # 修复 auth.users 中的用户（需要手动创建）
    out.write("-- ⚠️ 注意：auth.users 表的数据无法通过 SQL 直接恢复\n")
    out.write("-- 用户需要在新项目重新注册账号\n")
    out.write("-- 注册后，上面的 user_settings 记录的 user_id 会不匹配\n")
    out.write("-- 需要在新注册后，用新 user_id 更新所有表中的 user_id\n\n")
    
    # 提取旧 user_id 映射
    user_match = re.search(r'COPY public\.user_settings \(user_id, display_name.*?\) FROM stdin;\n(.*?)\n\\\.', content, re.DOTALL)
    if user_match:
        out.write("-- 旧用户列表（注册新账号后，用以下 SQL 更新 user_id）:\n")
        for line in user_match.group(1).strip().split('\n'):
            fields = line.split('\t')
            if len(fields) >= 2:
                out.write(f"-- 旧 user_id: {fields[0]} | 用户名: {fields[1]}\n")
        out.write("\n")

print(f"✅ 数据提取完成！输出文件: {output_file}")
print(f"请在新 Supabase SQL Editor 中执行此文件的内容")
print(f"\n⚠️ 重要提示:")
print(f"1. auth.users 无法通过 SQL 恢复，用户需要重新注册")
print(f"2. 注册后需要用新 user_id 更新数据中的旧 user_id")
print(f"3. 或者：先注册新账号，获取新 user_id，然后批量替换")
