import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
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
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id, name')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (employeeError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { request_type } = await req.json()

    if (!request_type || !['close', 'uninstall'].includes(request_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request type. Must be "close" or "uninstall"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if there's already a pending request
    const { data: existingRequest } = await supabase
      .from('agent_requests')
      .select('id, status')
      .eq('employee_id', employee.id)
      .eq('request_type', request_type)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingRequest) {
      return new Response(
        JSON.stringify({ 
          request_id: existingRequest.id,
          status: 'pending',
          message: 'Request already pending'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create new request
    const { data: newRequest, error: insertError } = await supabase
      .from('agent_requests')
      .insert({
        employee_id: employee.id,
        request_type: request_type,
        status: 'pending'
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to create request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Agent request created: ${request_type} for employee ${employee.name}`)

    return new Response(
      JSON.stringify({ 
        request_id: newRequest.id,
        status: 'pending',
        message: 'Request submitted. Waiting for admin approval.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
