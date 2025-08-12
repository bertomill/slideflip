-- Seed three example flows with high-quality PPTX-ready payloads
-- This migration is safe if no users exist; inserts will be no-ops because the CTE `u` yields 0 rows

begin;

with u as (
  select id as user_id from auth.users order by created_at limit 1
),
-- ==============================
-- Flow 1: Professional summary
-- ==============================
f1 as (
  insert into public.flows (user_id, status, current_step, description)
  select user_id, 'completed', 'download', 'Q2 Executive Summary'
  from u returning id
),
e1 as (
  insert into public.flow_events (flow_id, step, actor, event_type, payload, created_at)
  select id, 'upload',  'user',   'file_added',                   '{"count":0}'::jsonb, now() - interval '5 minutes' from f1
  union all select id, 'content', 'user',   'plan_requested',             '{"source":"seed"}'::jsonb, now() - interval '4 minutes' from f1
  union all select id, 'content', 'ai',     'plan_generated',             '{"length":120}'::jsonb,     now() - interval '3 minutes' from f1
  union all select id, 'preview', 'user',   'slide_generation_requested', '{"model":"schema"}'::jsonb, now() - interval '2 minutes' from f1
  union all select id, 'preview', 'ai',     'slide_generated',            '{"success":true}'::jsonb,   now() - interval '1 minutes' from f1
  union all select id, 'download','system', 'download_pptx_completed',    '{"format":"pptx"}'::jsonb, now() from f1
  returning 1
),
cp1 as (
  insert into public.flow_content_plans (flow_id, planning_context, ai_plan, user_edit, final_plan)
  select id,
    jsonb_build_object(
      'description','Executive summary: Q2 performance and priorities',
      'selectedTheme','professional-gradient',
      'hasResearch',false,
      'documentCount',0
    ),
    '• Revenue +18% YoY; +6% QoQ\n• Active users +12% QoQ; NPS 54\n• Launched 3 key features in June',
    null,
    '• Revenue +18% YoY; +6% QoQ\n• Active users +12% QoQ; NPS 54\n• Launched 3 key features in June'
  from f1 returning 1
),
pr1 as (
  insert into public.flow_previews (flow_id, request_payload, model, slide_html, success)
  select id,
    jsonb_build_object(
      'description','Executive summary: Q2 performance and priorities',
      'theme','professional-gradient',
      'contentPlan','Focus on topline growth, product adoption, and next quarter priorities.',
      'userFeedback','Keep it concise, highlight YoY.',
      'documents', jsonb_build_array(),
      'slideContent', jsonb_build_object(
        'title','Q2 Executive Summary',
        'subtitle','Growth, adoption, and what’s next',
        'bulletPoints', jsonb_build_array(
          'Revenue +18% YoY; +6% QoQ',
          'Active users +12% QoQ; NPS 54',
          'Launched 3 key features in June'
        ),
        'statistics', jsonb_build_array(
          jsonb_build_object('value','+18%','label','Revenue YoY'),
          jsonb_build_object('value','54','label','NPS'),
          jsonb_build_object('value','3','label','New Features')
        )
      )
    ),
    'schema:v1',
    null,
    true
  from f1 returning 1
),

-- ==============================
-- Flow 2: Product highlights (imported layout)
-- ==============================
f2 as (
  insert into public.flows (user_id, status, current_step, description)
  select user_id, 'completed', 'download', 'Product highlights for launch deck'
  from u returning id
),
e2 as (
  insert into public.flow_events (flow_id, step, actor, event_type, payload, created_at)
  select id, 'content', 'user', 'plan_requested', '{"source":"seed"}'::jsonb, now() - interval '4 minutes' from f2
  union all select id, 'content', 'ai', 'plan_generated', '{"length":98}'::jsonb, now() - interval '3 minutes' from f2
  union all select id, 'preview', 'user', 'slide_generation_requested', '{"model":"schema"}'::jsonb, now() - interval '2 minutes' from f2
  union all select id, 'preview', 'ai', 'slide_generated', '{"success":true}'::jsonb, now() - interval '1 minutes' from f2
  returning 1
),
cp2 as (
  insert into public.flow_content_plans (flow_id, planning_context, ai_plan, user_edit, final_plan)
  select id,
    jsonb_build_object(
      'description','Product highlights for launch deck',
      'selectedTheme','imported-02',
      'hasResearch',false,
      'documentCount',0
    ),
    '• SOC 2 Type II compliant\n• SSO + SCIM ready\n• 99.95% uptime last 12 months',
    null,
    '• SOC 2 Type II compliant\n• SSO + SCIM ready\n• 99.95% uptime last 12 months'
  from f2 returning 1
),
pr2 as (
  insert into public.flow_previews (flow_id, request_payload, model, slide_html, success)
  select id,
    jsonb_build_object(
      'description','Product highlights for launch deck',
      'theme','imported-02',
      'contentPlan','Three-column highlights with benefits and quick stats',
      'userFeedback','Keep headers short',
      'documents', jsonb_build_array(),
      'slideContent', jsonb_build_object(
        'title','Why Teams Choose Us',
        'subtitle','Fast setup, secure by design',
        'bulletPoints', jsonb_build_array(
          'SOC 2 Type II compliant',
          'SSO + SCIM ready',
          '99.95% uptime last 12 months'
        ),
        'statistics', jsonb_build_array(
          jsonb_build_object('value','2 wks','label','Avg. Time to Value'),
          jsonb_build_object('value','99.95%','label','Uptime')
        )
      )
    ),
    'schema:v1',
    null,
    true
  from f2 returning 1
),

-- ==============================
-- Flow 3: Marketing performance (modern clean)
-- ==============================
f3 as (
  insert into public.flows (user_id, status, current_step, description)
  select user_id, 'completed', 'download', 'Marketing performance snapshot'
  from u returning id
),
e3 as (
  insert into public.flow_events (flow_id, step, actor, event_type, payload, created_at)
  select id, 'content', 'user', 'plan_requested', '{"source":"seed"}'::jsonb, now() - interval '4 minutes' from f3
  union all select id, 'content', 'ai', 'plan_generated', '{"length":102}'::jsonb, now() - interval '3 minutes' from f3
  union all select id, 'preview', 'user', 'slide_generation_requested', '{"model":"schema"}'::jsonb, now() - interval '2 minutes' from f3
  union all select id, 'preview', 'ai', 'slide_generated', '{"success":true}'::jsonb, now() - interval '1 minutes' from f3
  returning 1
),
cp3 as (
  insert into public.flow_content_plans (flow_id, planning_context, ai_plan, user_edit, final_plan)
  select id,
    jsonb_build_object(
      'description','Marketing performance snapshot',
      'selectedTheme','modern-clean',
      'hasResearch',false,
      'documentCount',0
    ),
    '• Impressions +32% MoM\n• CPL -18%\n• Top channel: Organic',
    null,
    '• Impressions +32% MoM\n• CPL -18%\n• Top channel: Organic'
  from f3 returning 1
),
pr3 as (
  insert into public.flow_previews (flow_id, request_payload, model, slide_html, success)
  select id,
    jsonb_build_object(
      'description','Marketing performance snapshot',
      'theme','modern-clean',
      'contentPlan','KPI recap with bullets and simple stats',
      'userFeedback','Use blue accents',
      'documents', jsonb_build_array(),
      'slideContent', jsonb_build_object(
        'title','Marketing Performance',
        'subtitle','MoM growth and cost efficiency',
        'bulletPoints', jsonb_build_array(
          'Impressions +32% MoM',
          'CPL -18%',
          'Top channel: Organic'
        ),
        'statistics', jsonb_build_array(
          jsonb_build_object('value','32%','label','Impressions'),
          jsonb_build_object('value','-18%','label','CPL'),
          jsonb_build_object('value','1st','label','Organic Rank')
        )
      )
    ),
    'schema:v1',
    null,
    true
  from f3 returning 1
)
select 1;

commit;


