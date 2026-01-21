exports.handler = async (event) => {
  // DISABLED - Uncomment to re-enable
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Email function is disabled' })
  };
  
  // Rest of the code stays below...import Anthropic from '@anthropic-ai/sdk';

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

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend API error: ${error}`);
  }

  return await response.json();
}

// Generate email HTML
function generateEmailHTML(pgaPredictions, dpPredictions, date) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      background: #f0f9ff; 
      margin: 0;
      padding: 20px; 
    }
    .container { 
      max-width: 600px; 
      margin: 0 auto; 
      background: white; 
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header { 
      background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
      color: white; 
      padding: 30px 20px; 
      text-align: center; 
    }
    .header h1 { margin: 0 0 10px 0; font-size: 28px; }
    .header p { margin: 0; opacity: 0.9; font-size: 16px; }
    .content { padding: 30px 20px; }
    .tour-section { 
      margin: 30px 0; 
      padding: 25px; 
      background: #f9fafb; 
      border-left: 4px solid #16a34a; 
      border-radius: 8px;
    }
    .tour-section h2 { 
      margin: 0 0 15px 0; 
      color: #1f2937; 
      font-size: 22px;
    }
    .tour-info { 
      margin: 15px 0; 
      padding: 15px; 
      background: white; 
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    .tour-info p { margin: 5px 0; font-size: 14px; color: #4b5563; }
    .tour-info strong { color: #1f2937; }
    .course-features {
      margin: 15px 0;
      padding: 15px;
      background: #fef3c7;
      border-left: 3px solid #f59e0b;
      border-radius: 6px;
    }
    .course-features h4 {
      margin: 0 0 10px 0;
      color: #92400e;
      font-size: 14px;
    }
    .course-features ul {
      margin: 0;
      padding-left: 20px;
      color: #78350f;
    }
    .course-features li {
      margin: 5px 0;
      font-size: 13px;
    }
    .skills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 15px 0;
    }
    .skill-tag {
      background: #dcfce7;
      color: #166534;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }
    .pick { 
      margin: 20px 0; 
      padding: 20px; 
      background: white; 
      border: 2px solid #e5e7eb; 
      border-radius: 8px;
      transition: all 0.3s;
    }
    .pick:hover {
      border-color: #16a34a;
      box-shadow: 0 4px 6px rgba(22, 163, 74, 0.1);
    }
    .pick-header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .player-name { 
      font-size: 18px; 
      font-weight: bold; 
      color: #1f2937; 
    }
    .rank-badge {
      display: inline-block;
      width: 28px;
      height: 28px;
      line-height: 28px;
      text-align: center;
      border-radius: 50%;
      font-weight: bold;
      font-size: 14px;
      margin-right: 10px;
    }
    .rank-1 { background: #fbbf24; color: #78350f; }
    .rank-2 { background: #d1d5db; color: #1f2937; }
    .rank-3 { background: #fb923c; color: #7c2d12; }
    .rank-other { background: #dbeafe; color: #1e40af; }
    .odds { 
      background: #16a34a; 
      color: white; 
      padding: 8px 16px; 
      border-radius: 20px; 
      font-weight: bold;
      font-size: 16px;
    }
    .info-box {
      margin: 12px 0;
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
      line-height: 1.6;
    }
    .coursefit-box {
      background: #dbeafe;
      border-left: 3px solid #2563eb;
      color: #1e3a8a;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 12px 0;
    }
    .stat-box {
      background: white;
      border: 1px solid #e5e7eb;
      padding: 10px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-label {
      font-size: 11px;
      color: #6b7280;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .stat-value {
      font-size: 16px;
      font-weight: bold;
      color: #1f2937;
    }
    .form-box {
      background: #f3e8ff;
      border-left: 3px solid #9333ea;
      color: #581c87;
    }
    .footer { 
      margin-top: 40px;
      padding: 20px;
      text-align: center; 
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }
    .footer p { 
      margin: 8px 0; 
      color: #6b7280; 
      font-size: 12px; 
    }
    .disclaimer {
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 15px;
      border-radius: 6px;
      margin: 20px 0;
    }
    .disclaimer p {
      margin: 0;
      color: #991b1b;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⛳ Golf AI Weekly Predictions</h1>
      <p>${date}</p>
    </div>
    
    <div class="content">
      ${generateTourSection(pgaPredictions, '🇺🇸 PGA Tour')}
      ${generateTourSection(dpPredictions, '🇪🇺 DP World Tour')}
      
      <div class="disclaimer">
        <p><strong>⚠️ Disclaimer:</strong> These predictions are for informational purposes only. Past performance does not guarantee future results. Please gamble responsibly and within your means.</p>
      </div>
    </div>
    
    <div class="footer">
      <p><strong>Powered by Claude AI</strong></p>
      <p>Data Sources: DataGolf • OddsChecker • Weather.com • PGA/DP World Tour</p>
      <p>© ${new Date().getFullYear()} Golf AI Predictions</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateTourSection(predictions, tourTitle) {
  if (!predictions || !predictions.valuePicks) return '';
  
  const picks = predictions.valuePicks;
  
  return `
    <div class="tour-section">
      <h2>${tourTitle}</h2>
      <h3 style="margin: 10px 0; color: #374151;">${predictions.tournament || 'Tournament'}</h3>
      
      <div class="tour-info">
        <p><strong>Course:</strong> ${predictions.course || 'N/A'}</p>
        <p><strong>Location:</strong> ${predictions.location || 'N/A'}</p>
        <p><strong>Dates:</strong> ${predictions.dates || 'N/A'}</p>
        ${predictions.courseProfile ? `
          <p><strong>Par:</strong> ${predictions.courseProfile.par || 'N/A'} • <strong>Length:</strong> ${predictions.courseProfile.length || 'N/A'}</p>
        ` : ''}
        ${predictions.weather ? `<p><strong>Weather:</strong> ${predictions.weather}</p>` : ''}
      </div>
      
      ${predictions.courseProfile?.keyFeatures?.length ? `
        <div class="course-features">
          <h4>🏌️ Course Features</h4>
          <ul>
            ${predictions.courseProfile.keyFeatures.map(f => `<li>${f}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      ${predictions.courseProfile?.favoredSkills?.length ? `
        <div style="margin: 15px 0;">
          <p style="font-size: 13px; font-weight: bold; color: #166534; margin-bottom: 8px;">✅ SKILLS NEEDED:</p>
          <div class="skills">
            ${predictions.courseProfile.favoredSkills.map(s => `<span class="skill-tag">${s}</span>`).join('')}
          </div>
        </div>
      ` : ''}
      
      <h3 style="margin: 25px 0 15px 0; color: #1f2937; font-size: 18px;">💰 Value Picks (20/1+ Odds)</h3>
      
      ${picks.map(pick => `
        <div class="pick">
          <div class="pick-header">
            <div class="player-name">
              <span class="rank-badge rank-${pick.rank <= 3 ? pick.rank : 'other'}">${pick.rank}</span>
              ${pick.player}
            </div>
            <div class="odds">${pick.odds}</div>
          </div>
          
          ${pick.coursefit ? `
            <div class="info-box coursefit-box">
              <strong>Course Fit:</strong> ${pick.coursefit}
            </div>
          ` : ''}
          
          ${pick.stats ? `
            <div class="stats-grid">
              ${pick.stats.drivingAcc ? `
                <div class="stat-box">
                  <div class="stat-label">Driving Acc</div>
                  <div class="stat-value">${pick.stats.drivingAcc}</div>
                </div>
              ` : ''}
              ${pick.stats.gir ? `
                <div class="stat-box">
                  <div class="stat-label">GIR %</div>
                  <div class="stat-value">${pick.stats.gir}</div>
                </div>
              ` : ''}
              ${pick.stats.sgApproach ? `
                <div class="stat-box">
                  <div class="stat-label">SG: Approach</div>
                  <div class="stat-value">${pick.stats.sgApproach}</div>
                </div>
              ` : ''}
              ${pick.stats.sgPutting ? `
                <div class="stat-box">
                  <div class="stat-label">SG: Putting</div>
                  <div class="stat-value">${pick.stats.sgPutting}</div>
                </div>
              ` : ''}
            </div>
          ` : ''}
          
          ${pick.stats?.recentForm ? `
            <div class="info-box form-box">
              <strong>Recent Form:</strong> ${pick.stats.recentForm}
            </div>
          ` : ''}
          
          ${pick.why ? `
            <p style="margin: 12px 0 0 0; color: #4b5563; font-size: 14px; line-height: 1.6;">
              ${pick.why}
            </p>
          ` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

// Netlify schedule configuration
export const config = {
  schedule: "0 8 * * *" // Run every day at 8:00 AM UTC
};
```

---

## **✅ VERIFY YOUR FILE STRUCTURE:**

After creating the file, your project should look like this:
```
your-golf-ai-project/
│
├── index.html                           ← Your existing app
│
├── netlify/                             ← NEW FOLDER
│   └── functions/                       ← NEW FOLDER
│       └── scheduled-predictions.js     ← NEW FILE (paste code here)
│
├── netlify.toml                         ← Will create in Step 4
├── package.json                         ← Will create/update next
└── README.md                            ← (optional)
