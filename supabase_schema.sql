-- SIPAK Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color_code VARCHAR(20) DEFAULT '#4F46E5', -- Default indigo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Classes
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grade INTEGER NOT NULL CHECK (grade IN (7, 8, 9)),
  name VARCHAR(50) NOT NULL, -- e.g., '7A', '8B'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(name)
);

-- 4. Teaching Loads (Beban Mengajar: Guru mengajar Mapel apa di Kelas mana, berapa Jam)
CREATE TABLE IF NOT EXISTS public.teaching_loads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  hours_per_week INTEGER NOT NULL CHECK (hours_per_week > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(teacher_id, subject_id, class_id)
);

-- 5. Schedules (Jadwal Pelajaran Riil)
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  teaching_load_id UUID REFERENCES public.teaching_loads(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Monday, 6=Saturday
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 10), -- Jam ke-1 s/d Jam ke-10
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- ABSOLUTE ANTI-CONFLICT CONSTRAINTS
  -- Seorang guru tidak bisa mengajar di 2 kelas berbeda pada hari dan jam yang sama
  CONSTRAINT unique_teacher_schedule UNIQUE(teacher_id, day_of_week, period_number),
  -- Sebuah kelas tidak bisa diajar oleh 2 guru berbeda pada hari dan jam yang sama
  CONSTRAINT unique_class_schedule UNIQUE(class_id, day_of_week, period_number)
);

-- 6. Agendas (Real-time Tracker)
CREATE TABLE IF NOT EXISTS public.agendas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TIME,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Documents (Auto-Document Generator History)
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (Row Level Security) but allow all for this prototype
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to teachers" ON public.teachers FOR ALL USING (true);
CREATE POLICY "Allow all access to subjects" ON public.subjects FOR ALL USING (true);
CREATE POLICY "Allow all access to classes" ON public.classes FOR ALL USING (true);
CREATE POLICY "Allow all access to teaching_loads" ON public.teaching_loads FOR ALL USING (true);
CREATE POLICY "Allow all access to schedules" ON public.schedules FOR ALL USING (true);
CREATE POLICY "Allow all access to agendas" ON public.agendas FOR ALL USING (true);
CREATE POLICY "Allow all access to documents" ON public.documents FOR ALL USING (true);

-- Enable Realtime for Agendas
ALTER PUBLICATION supabase_realtime ADD TABLE public.agendas;
