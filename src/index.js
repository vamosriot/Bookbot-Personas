/**
 * Bookbot OpenAI Proxy Worker
 * Securely proxies requests to OpenAI API with CORS support
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// CORS headers for frontend requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, replace with your domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      // Check if OpenAI API key is configured
      if (!env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not configured');
        return new Response(JSON.stringify({
          error: 'OpenAI API key not configured',
          code: 'API_KEY_MISSING'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Parse the request body
      const requestBody = await request.json();
      
      // Validate required fields
      if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
        return new Response(JSON.stringify({
          error: 'Invalid request: messages array is required',
          code: 'INVALID_REQUEST'
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Prepare the OpenAI request
      const openAiRequest = {
        model: requestBody.model || 'gpt-4-turbo-preview',
        messages: requestBody.messages,
        max_tokens: requestBody.max_tokens || 4096,
        temperature: requestBody.temperature || 0.7,
        stream: requestBody.stream || false,
      };

      console.log('Sending request to OpenAI:', {
        model: openAiRequest.model,
        messageCount: openAiRequest.messages.length,
        stream: openAiRequest.stream
      });

      // Make request to OpenAI
      const openAiResponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(openAiRequest),
      });

      // Handle OpenAI API errors
      if (!openAiResponse.ok) {
        const errorData = await openAiResponse.json().catch(() => ({}));
        console.error('OpenAI API error:', {
          status: openAiResponse.status,
          statusText: openAiResponse.statusText,
          error: errorData
        });

        return new Response(JSON.stringify({
          error: errorData.error?.message || 'OpenAI API request failed',
          code: 'OPENAI_API_ERROR',
          status: openAiResponse.status
        }), {
          status: openAiResponse.status,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Handle streaming responses
      if (requestBody.stream) {
        return new Response(openAiResponse.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            ...corsHeaders,
          },
        });
      }

      // Handle regular responses
      const responseData = await openAiResponse.json();
      
      console.log('OpenAI response received:', {
        id: responseData.id,
        model: responseData.model,
        usage: responseData.usage
      });

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Internal server error',
        code: 'WORKER_ERROR',
        message: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
  },
}; 