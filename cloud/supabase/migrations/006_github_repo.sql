-- Add github_repo column to profiles for storing user's workspace repository
alter table public.profiles
  add column if not exists github_repo text;

-- Add github_username for convenience (populated from GitHub OAuth provider data)
alter table public.profiles
  add column if not exists github_username text;
