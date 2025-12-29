import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  console.log(`[DATA-INTEGRITY] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logStep('Starting data integrity sync');

    const corrections: { type: string; count: number; details?: unknown }[] = [];

    // 1. Sync leads_purchased counter with actual lead counts
    logStep('Checking leads_purchased counters...');
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('user_id, leads_purchased');

    if (profilesError) throw profilesError;

    for (const profile of profiles || []) {
      const { count, error: countError } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('unlocked_by', profile.user_id)
        .eq('is_unlocked', true);

      if (countError) continue;

      const actualCount = count || 0;
      if (actualCount !== profile.leads_purchased) {
        logStep(`Correcting leads_purchased for user ${profile.user_id}`, {
          stored: profile.leads_purchased,
          actual: actualCount
        });

        await supabase
          .from('profiles')
          .update({ leads_purchased: actualCount })
          .eq('user_id', profile.user_id);

        corrections.push({
          type: 'leads_purchased_sync',
          count: 1,
          details: { user_id: profile.user_id, from: profile.leads_purchased, to: actualCount }
        });
      }
    }

    // 2. Fix outcome_status for unpurchased leads that incorrectly show 'purchased' or 'pending'
    logStep('Checking outcome_status consistency...');

    const { data: inconsistentLeads, error: leadsError } = await supabase
      .from('leads')
      .select('id, outcome_status, is_unlocked, lead_status')
      .eq('is_unlocked', false)
      .eq('lead_status', 'published')
      .in('outcome_status', ['purchased', 'pending']);

    if (!leadsError && inconsistentLeads && inconsistentLeads.length > 0) {
      for (const lead of inconsistentLeads) {
        await supabase
          .from('leads')
          .update({ outcome_status: 'available' })
          .eq('id', lead.id);
      }
      corrections.push({
        type: 'outcome_status_fix',
        count: inconsistentLeads.length,
        details: { fixed_to: 'available' }
      });
      logStep(`Fixed ${inconsistentLeads.length} leads with incorrect outcome_status`);
    }

    // 3. Ensure refunded leads have correct outcome_status
    const { data: refundedLeads, error: refundError } = await supabase
      .from('leads')
      .select('id, outcome_status')
      .not('refunded_at', 'is', null)
      .neq('outcome_status', 'refunded');

    if (!refundError && refundedLeads && refundedLeads.length > 0) {
      for (const lead of refundedLeads) {
        await supabase
          .from('leads')
          .update({ outcome_status: 'refunded' })
          .eq('id', lead.id);
      }
      corrections.push({
        type: 'refunded_status_fix',
        count: refundedLeads.length,
        details: { fixed_to: 'refunded' }
      });
      logStep(`Fixed ${refundedLeads.length} refunded leads with incorrect outcome_status`);
    }

    // 4. Check for purchased leads without unlocked_at timestamp
    const { data: missingTimestamp, error: timestampError } = await supabase
      .from('leads')
      .select('id')
      .eq('is_unlocked', true)
      .is('unlocked_at', null);

    if (!timestampError && missingTimestamp && missingTimestamp.length > 0) {
      corrections.push({
        type: 'warning_missing_unlocked_at',
        count: missingTimestamp.length,
        details: { lead_ids: missingTimestamp.map(l => l.id).slice(0, 10) }
      });
      logStep(`Warning: ${missingTimestamp.length} purchased leads missing unlocked_at timestamp`);
    }

    logStep('Data integrity sync completed', { corrections });

    return new Response(JSON.stringify({
      success: true,
      message: 'Data integrity sync completed',
      corrections,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error during data integrity sync', { error: errorMessage });
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
