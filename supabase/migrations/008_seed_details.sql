-- Seed additional artifacts for the 3 example flows: research runs, documents, downloads, and events

begin;

with u as (
  select id as user_id from auth.users order by created_at limit 1
),
f1 as (
  select fl.id from public.flows fl
  join u on u.user_id = fl.user_id
  where fl.description = 'Q2 Executive Summary' limit 1
),
f2 as (
  select fl.id from public.flows fl
  join u on u.user_id = fl.user_id
  where fl.description = 'Product highlights for launch deck' limit 1
),
f3 as (
  select fl.id from public.flows fl
  join u on u.user_id = fl.user_id
  where fl.description = 'Marketing performance snapshot' limit 1
),

-- Documents (simple text examples) ----------------------------------------
docs as (
  select * from (
    select (select id from f1) as flow_id, 'q2-notes.txt' as filename, 'text/plain' as file_type, 5120::bigint as file_size,
           true as parse_success, null::text as parse_error,
           'Revenue accelerated in Q2 with strong product adoption. Focus on YoY highlights and new features.' as content
    union all
    select (select id from f2), 'security-summary.md', 'text/markdown', 4096,
           true, null,
           '# Compliance\n\n- SOC 2 Type II\n- SSO\n- SCIM\n- Uptime: 99.95%'
    union all
    select (select id from f3), 'marketing-kpis.csv', 'text/plain', 3584,
           true, null,
           'metric,value\nImpressions,32%\nCPL,-18%\nTopChannel,Organic'
  ) d where d.flow_id is not null
),
ins_docs as (
  insert into public.flow_documents (flow_id, filename, file_type, file_size, parse_success, parse_error, content)
  select flow_id, filename, file_type, file_size, parse_success, parse_error, content from docs returning 1
),

-- Research runs ------------------------------------------------------------
rr as (
  select * from (
    select (select id from f1) as flow_id,
           'q2 performance kpis' as query,
           jsonb_build_object('maxResults',4,'includeAnswer',true,'excludeSocial',true) as options,
           'AI Summary: Q2 shows double-digit revenue growth and solid user adoption.\n\n• Revenue +18% YoY\n• Active users +12% QoQ\n• NPS 54' as result,
           jsonb_build_array(jsonb_build_object('title','Earnings','url','https://example.com/earnings','score',0.86)) as sources,
           'Positive momentum with clear KPIs' as answer,
           'success'::text as status,
           620 as duration_ms
    union all
    select (select id from f2), 'saas security checklist',
           jsonb_build_object('maxResults',4,'includeAnswer',true,'excludeSocial',true),
           'Security highlights collected for deck.\n\n• SOC 2 Type II\n• SSO + SCIM\n• 99.95% uptime',
           jsonb_build_array(jsonb_build_object('title','Security','url','https://example.com/security','score',0.74)),
           'Meets enterprise expectations',
           'success',
           540
    union all
    select (select id from f3), 'marketing kpi monthly trends',
           jsonb_build_object('maxResults',4,'includeAnswer',true,'excludeSocial',true),
           'Limited public data found. Using provided KPIs from documents.',
           jsonb_build_array(),
           null,
           'no_results',
           480
  ) r where r.flow_id is not null
),
ins_rr as (
  insert into public.flow_research_runs (flow_id, query, options, result, sources, answer, status, duration_ms)
  select flow_id, query, options, result, sources, answer, status, duration_ms from rr returning 1
),

-- Downloads (pptx success) -------------------------------------------------
dl as (
  select * from (
    select (select id from f1) as flow_id, 'pptx'::text as format, null::text as url, true as success
    union all
    select (select id from f2), 'pptx', null, true
    union all
    select (select id from f3), 'pptx', null, true
  ) d where d.flow_id is not null
),
ins_dl as (
  insert into public.flow_downloads (flow_id, format, url, success)
  select flow_id, format, url, success from dl returning 1
),

-- Events to reflect documents and research --------------------------------
ins_events as (
  insert into public.flow_events (flow_id, step, actor, event_type, payload, created_at)
  select (select id from f1), 'upload','user','file_added', '{"filename":"q2-notes.txt"}'::jsonb, now() - interval '6 minutes'
  union all select (select id from f2), 'upload','user','file_added', '{"filename":"security-summary.md"}'::jsonb, now() - interval '6 minutes'
  union all select (select id from f3), 'upload','user','file_added', '{"filename":"marketing-kpis.csv"}'::jsonb, now() - interval '6 minutes'
  union all select (select id from f1), 'research','user','research_requested', '{"query":"q2 performance kpis"}'::jsonb, now() - interval '5 minutes'
  union all select (select id from f1), 'research','ai','research_completed', '{"status":"success"}'::jsonb, now() - interval '4 minutes'
  union all select (select id from f2), 'research','user','research_requested', '{"query":"saas security checklist"}'::jsonb, now() - interval '5 minutes'
  union all select (select id from f2), 'research','ai','research_completed', '{"status":"success"}'::jsonb, now() - interval '4 minutes'
  union all select (select id from f3), 'research','user','research_requested', '{"query":"marketing kpi monthly trends"}'::jsonb, now() - interval '5 minutes'
  union all select (select id from f3), 'research','ai','research_completed', '{"status":"no_results"}'::jsonb, now() - interval '4 minutes'
  returning 1
)
select 1;

commit;


