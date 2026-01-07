import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const apiKey = req.headers.get('x-api-key')
    
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Validate API key and get employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { app_name, status, duration_seconds = 0 } = body

    if (!app_name || !status) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: app_name, status' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['working', 'idle'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'Status must be "working" or "idle"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert activity log
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        employee_id: employee.id,
        app_name,
        status,
        duration_seconds
      })

    if (logError) {
      throw logError
    }

    // Determine employee status based on activity
    const employeeStatus = status === 'idle' ? 'idle' : 'online'

    // Update employee status
    const { error: updateError } = await supabase
      .from('employees')
      .update({
        status: employeeStatus,
        current_app: app_name,
        last_seen: new Date().toISOString()
      })
      .eq('id', employee.id)

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
