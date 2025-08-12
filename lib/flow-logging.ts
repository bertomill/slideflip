import { createClient } from '@/lib/supabase/server';

// Flow step types representing different stages in the presentation creation process
export type FlowStep = 'upload' | 'theme' | 'research' | 'content' | 'preview' | 'download';

// Actor types that can trigger flow events
export type FlowActor = 'user' | 'ai' | 'system';

// Generic JSON type for flexible payload data
type Json = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

// Helper function to get Supabase client instance
async function getSupabase() {
  return await createClient();
}

// Logs a generic flow event with metadata
export async function logEvent(params: {
  flowId?: string | null;
  step: FlowStep;
  actor: FlowActor;
  eventType: string;
  payload?: Json;
  correlationId?: string;
}) {
  try {
    if (!params.flowId) return; // no-op if not provided
    const supabase = await getSupabase();
    await supabase.from('flow_events').insert({
      flow_id: params.flowId,
      step: params.step,
      actor: params.actor,
      event_type: params.eventType,
      payload: params.payload ?? null,
      correlation_id: params.correlationId ?? null,
    });
  } catch (e) {
    console.error('flow logEvent failed', e);
  }
}

// Saves details about an AI research query and its results
export async function saveResearchRun(params: {
  flowId?: string | null;
  query: string;
  options?: Json;
  result?: string | null;
  sources?: Json;
  answer?: string | null;
  status: 'success' | 'no_results' | 'error';
  durationMs?: number | null;
}) {
  try {
    if (!params.flowId) return;
    const supabase = await getSupabase();
    await supabase.from('flow_research_runs').insert({
      flow_id: params.flowId,
      query: params.query,
      options: params.options ?? null,
      result: params.result ?? null,
      sources: params.sources ?? null,
      answer: params.answer ?? null,
      status: params.status,
      duration_ms: params.durationMs ?? null,
    });
  } catch (e) {
    console.error('flow saveResearchRun failed', e);
  }
}

// Saves the content planning details including AI suggestions and user edits
export async function saveContentPlan(params: {
  flowId?: string | null;
  planningContext: Json;
  aiPlan: string;
  userEdit?: string | null;
  finalPlan?: string | null;
}) {
  try {
    if (!params.flowId) return;
    const supabase = await getSupabase();
    await supabase.from('flow_content_plans').insert({
      flow_id: params.flowId,
      planning_context: params.planningContext,
      ai_plan: params.aiPlan,
      user_edit: params.userEdit ?? null,
      final_plan: params.finalPlan ?? params.userEdit ?? params.aiPlan,
    });
  } catch (e) {
    console.error('flow saveContentPlan failed', e);
  }
}

// Saves preview generation attempts and results
export async function savePreview(params: {
  flowId?: string | null;
  requestPayload: Json;
  model?: string | null;
  slideHtml?: string | null;
  success: boolean;
}) {
  try {
    if (!params.flowId) return;
    const supabase = await getSupabase();
    await supabase.from('flow_previews').insert({
      flow_id: params.flowId,
      request_payload: params.requestPayload,
      model: params.model ?? null,
      slide_html: params.slideHtml ?? null,
      success: params.success,
    });
  } catch (e) {
    console.error('flow savePreview failed', e);
  }
}

// Logs presentation download events with format and status
export async function saveDownload(params: {
  flowId?: string | null;
  format: 'pptx' | 'google_slides' | 'html';
  url?: string | null;
  success?: boolean;
}) {
  try {
    if (!params.flowId) return;
    const supabase = await getSupabase();
    await supabase.from('flow_downloads').insert({
      flow_id: params.flowId,
      format: params.format,
      url: params.url ?? null,
      success: params.success ?? true,
    });
  } catch (e) {
    console.error('flow saveDownload failed', e);
  }
}

// Records theme selection details including color palette and source
export async function saveThemeChoice(params: {
  flowId?: string | null;
  templateId?: string | null;
  palette?: string[] | null;
  source: 'curated' | 'logo' | 'ai' | 'manual';
  prompt?: string | null;
  logoUrl?: string | null;
}) {
  try {
    if (!params.flowId) return;
    const supabase = await getSupabase();
    await supabase.from('flow_theme_choices').insert({
      flow_id: params.flowId,
      template_id: params.templateId ?? null,
      palette: params.palette ? (params.palette as unknown as Json) : null,
      palette_source: params.source,
      prompt: params.prompt ?? null,
      logo_url: params.logoUrl ?? null,
    });
  } catch (e) {
    console.error('flow saveThemeChoice failed', e);
  }
}
