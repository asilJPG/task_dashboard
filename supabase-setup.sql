-- ================================================
-- Task Dashboard — Supabase Database Setup (SHARED DB SAFE)
-- Run this SQL in your Supabase SQL Editor
-- ================================================

-- 1. Profiles table (custom authentication)
CREATE TABLE IF NOT EXISTS tb_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '🧑‍💻',
  color TEXT DEFAULT '#7c3aed',
  role TEXT DEFAULT 'employee',
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration for existing databases
ALTER TABLE tb_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'employee';

-- Seed default Administrator account
-- You can log in using: Login: admin, Password: adminpassword
INSERT INTO tb_profiles (username, password, name, avatar, color, role, is_admin)
VALUES ('admin', 'adminpassword', 'Администратор', '👑', '#f59e0b', 'admin', true)
ON CONFLICT (username) DO NOTHING;



-- 2. Tasks table
CREATE TABLE IF NOT EXISTS tb_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','stopped','done')),
  progress INT DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  created_by UUID NOT NULL REFERENCES tb_profiles(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES tb_profiles(id) ON DELETE CASCADE,
  assignees TEXT[] DEFAULT '{}',
  responsible_id UUID REFERENCES tb_profiles(id) ON DELETE CASCADE,
  stop_reason TEXT,
  deadline DATE,
  tags TEXT[] DEFAULT '{}',
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Migration for existing tb_tasks tables
ALTER TABLE tb_tasks ADD COLUMN IF NOT EXISTS assignees TEXT[] DEFAULT '{}';
ALTER TABLE tb_tasks ADD COLUMN IF NOT EXISTS responsible_id UUID;

-- 3. Comments table
CREATE TABLE IF NOT EXISTS tb_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tb_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tb_profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Task History table
CREATE TABLE IF NOT EXISTS tb_task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tb_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES tb_profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Notifications table
CREATE TABLE IF NOT EXISTS tb_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tb_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  task_id UUID REFERENCES tb_tasks(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ================================================
-- Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_tb_tasks_created_by ON tb_tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tb_tasks_assigned_to ON tb_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tb_tasks_status ON tb_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tb_comments_task_id ON tb_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_tb_task_history_task_id ON tb_task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_tb_notifications_user_id ON tb_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_tb_notifications_read ON tb_notifications(user_id, read);

-- ================================================
-- Disable Row Level Security (RLS)
-- Shared DB safe, application-level security used
-- ================================================
ALTER TABLE tb_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_task_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE tb_notifications DISABLE ROW LEVEL SECURITY;

-- ================================================
-- Auto-update updated_at on tasks
-- ================================================
CREATE OR REPLACE FUNCTION tb_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tb_tasks_updated_at ON tb_tasks;
CREATE TRIGGER tb_tasks_updated_at
  BEFORE UPDATE ON tb_tasks
  FOR EACH ROW EXECUTE FUNCTION tb_update_updated_at();

-- ================================================
-- Enable Realtime for tasks, comments, notifications
-- ================================================
ALTER PUBLICATION supabase_realtime ADD TABLE tb_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE tb_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE tb_notifications;
