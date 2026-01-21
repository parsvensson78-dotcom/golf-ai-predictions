// Netlify function configuration
exports.config = {
  timeout: 60  // 60 seconds for Netlify function
};

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    const { api_key, messages, max_tokens, tools } = JSON.parse(event.body);
    
    if (!api_key) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'API key is required' })
      };
    }
    
    const requestBody = {
      model: 'claude-sonnet-4-20250514',
      max_tokens: max_tokens || 1000,
      messages: messages
    };
    
    // Only use web_search tool
    if (tools && tools.length > 0) {
      requestBody.tools = [
        {
          "type": "web_search_20250305",
          "name": "web_search"
        }
      ];
    }
    
    console.log('Making request to Anthropic API...');
    
    // Create AbortController for 90-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log('Request aborted after 90 seconds');
    }, 90000); // 90 seconds
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': api_key,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal  // Add abort signal
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes
      
      console.log('Response status:', response.status);
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('API Error:', data);
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ 
            error: data.error?.message || 'API request failed',
            details: data
          })
        };
      }
      
      console.log('Success!');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
      
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Check if error was due to timeout/abort
      if (fetchError.name === 'AbortError') {
        console.error('Request timed out after 90 seconds');
        return {
          statusCode: 504,
          headers,
          body: JSON.stringify({ 
            error: 'Request timed out after 90 seconds. The API response took too long.',
            type: 'timeout'
          })
        };
      }
      
      throw fetchError; // Re-throw other fetch errors
    }
    
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack
      })
    };
  }
};
