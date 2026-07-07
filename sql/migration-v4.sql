-- 运营笔记表
CREATE TABLE IF NOT EXISTS public.operation_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  title TEXT,
  content TEXT NOT NULL,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_notes_user_id ON public.operation_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_notes_shop_id ON public.operation_notes(shop_id);
CREATE INDEX IF NOT EXISTS idx_operation_notes_year_month ON public.operation_notes(year, month);

ALTER TABLE public.operation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户可读自己笔记" ON public.operation_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "用户可管理自己笔记" ON public.operation_notes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.operation_notes;

DROP TRIGGER IF EXISTS trigger_operation_notes_updated ON public.operation_notes;
CREATE TRIGGER trigger_operation_notes_updated BEFORE UPDATE ON public.operation_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
