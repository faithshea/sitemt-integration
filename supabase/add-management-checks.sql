alter type public.check_area add value if not exists 'management';

alter table public.routine_tasks
  drop constraint if exists routine_tasks_area_check;

alter table public.routine_tasks
  add constraint routine_tasks_area_check
  check (area::text in ('opening', 'closing', 'safe', 'management'));
