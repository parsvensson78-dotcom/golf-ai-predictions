import Anthropic from '@anthropic-ai/sdk';

export const handler = async (event) => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // Only run on Wednesdays (3) or when manually triggered
  if (dayOfWeek !== 3 && !event.queryStringParameters?.force) {
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Not Wednesday - skipping',
        day: dayOfWeek,
        date: today.toISOString()
      })
    };
  }

  try {
    console.log('Starting weekly predictions email...');
    
    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Get today's date formatted
    const formattedDate = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // Fetch PGA Tour predictions
    console.log('Fetching PGA Tour predictions...');
    const pgaPredictions = await fetchPredictions(anthropic, 'pga', formattedDate);
    
    // Fetch DP World Tour predictions
    console.log('Fetching DP World Tour predictions...');
    const dpPredictions = await fetchPredictions(anthropic, 'dp', formattedDate);

    // Generate email HTML
    const emailHTML = generateEmailHTML(pgaPredictions, dpPredictions, formattedDate);

    // Send email via Resend
    console.log('Sending email...');
    await sendEmail(emailHTML, formattedDate);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        message: 'Predictions email sent successfully',
        date: formattedDate
      })
    };

  } catch (error) {
    console.error('Error in scheduled function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack
      })
    };
  }
};

// Fetch predictions for a specific tour
async function fetchPredictions(anthropic, tour, date) {
  const tourName = tour === 'pga' ? 'PGA Tour' : 'DP World Tour';
  const tourSite = tour === 'pga' ? 'pgatour.com' : 'europeantour.com';
  const statsSite = tour === 'pga' ? 'datagolf.com pgatour.com' : 'datagolf.com europeantour.com';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `${date}. ${tourName} this week.

Sources: ${tourSite} ${statsSite} oddschecker weather.com

5 value picks 20/1+ matching course.

JSON:
{"tournament":"","course":"","location":"","dates":"","courseProfile":{"length":"","par":"","keyFeatures":[""],"favoredSkills":[""]},"weather":"","valuePicks":[{"rank":1,"player":"","odds":"","why":"","coursefit":"","stats":{"drivingAcc":"","gir":"","sgApproach":"","sgPutting":"","recentForm":""}}]}`
    }],
    tools: [{
      type: "web_search_20250305",
      name: "web_search"
    }]
  });

  // Extract JSON from response
  const text = message.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const jsonStr = cleaned.substring(start, end + 1);
  
  return JSON.parse(jsonStr);
}

// Send email via Resend
async function sendEmail(htmlContent, date) {
  const recipients = process.env.EMAIL_RECIPIENTS.split(',').map(e => e.trim());
  
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev', // Resend test domain
      to: recipients,
      subject: `⛳ Golf AI Weekly Predictions - ${date}`,
      html: htmlContent
    })
  });
