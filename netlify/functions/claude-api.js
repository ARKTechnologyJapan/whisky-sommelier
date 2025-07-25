exports.handler = async (event, context) => {
  // CORS対応
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // OPTIONSリクエストの処理
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
    const { preferences } = JSON.parse(event.body);
    
    const claudeResponse = await fetch('http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLAUDE_API_KEY}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `ウィスキーソムリエとして、以下の好みに基づいて3つのウィスキーを推薦してください：
          
価格帯: ${preferences.minPrice}円 - ${preferences.maxPrice}円
味覚座標: X=${preferences.tasteX}, Y=${preferences.tasteY}
追加要望: ${preferences.additionalPreferences}

以下のJSONフォーマットで回答してください：
{
  "recommendations": [
    {
      "name": "ウィスキー名",
      "reason": "推薦理由",
      "price": "価格",
      "tasteProfile": "味の特徴"
    }
  ]
}`
        }]
      })
    });

    const claudeData = await claudeResponse.json();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(claudeData)
    };

  } catch (error) {
    console.error('Claude API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
