exports.handler = async (event, context) => {
  console.log('=== Claude API Function 開始 ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Body:', event.body);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      body: JSON.stringify({ error: 'POSTメソッドのみ許可されています' })
    };
  }

  try {
    const requestData = JSON.parse(event.body);
    console.log('Parsed request data:', requestData);

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('CLAUDE_API_KEY not found');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Claude APIリクエスト作成
    const claudeRequestBody = {
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `あなたは昼の月バーの専門ウィスキーソムリエです。以下の顧客の好みに基づいて、正確に3つのウィスキーを推薦してください：

【顧客の好み】
- 価格帯: ${requestData.minPrice}円 〜 ${requestData.maxPrice}円
- 味覚座標: X軸=${requestData.tasteX} (0=ライト, 1=ヘビー), Y軸=${requestData.tasteY} (0=フルーティー, 1=スモーキー)  
- 追加要望: ${requestData.additionalPreferences || 'なし'}

以下のJSONフォーマットで必ず回答してください：
{
  "recommendations": [
    {
      "name": "マッカラン 18年",
      "reason": "この顧客の好みに合う具体的な理由",
      "matchScore": 95,
      "tasteProfile": "味の特徴の詳細説明"
    },
    {
      "name": "タリスカー 10年", 
      "reason": "推薦理由2",
      "matchScore": 88,
      "tasteProfile": "味の特徴2"
    },
    {
      "name": "ボウモア 12年",
      "reason": "推薦理由3", 
      "matchScore": 82,
      "tasteProfile": "味の特徴3"
    }
  ],
  "summary": "総合的な推薦理由とコメント"
}`
      }]
    };

    console.log('Sending request to Claude API...');

    // 修正されたエンドポイント（複数試行）
    const endpoints = [
      'http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1/chat/completions',
      'http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/v1/messages',
      'http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1',
      'http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/'
    ];

    let claudeResponse;
    let lastError;

    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`);
        
        claudeResponse = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(claudeRequestBody)
        });

        console.log(`Response status for ${endpoint}:`, claudeResponse.status);
        
        if (claudeResponse.ok) {
          console.log('Success with endpoint:', endpoint);
          break;
        } else {
          const errorText = await claudeResponse.text();
          console.log(`Error response from ${endpoint}:`, errorText);
          lastError = `${endpoint}: ${claudeResponse.status} - ${errorText}`;
        }
      } catch (error) {
        console.log(`Network error with ${endpoint}:`, error.message);
        lastError = `${endpoint}: ${error.message}`;
      }
    }

    if (!claudeResponse || !claudeResponse.ok) {
      throw new Error(`All endpoints failed. Last error: ${lastError}`);
    }

    const claudeData = await claudeResponse.json();
    console.log('Claude API Success Response:', claudeData);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: claudeData
      })
    };

  } catch (error) {
    console.error('=== Error Details ===');
    console.error('Error message:', error.message);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'サーバーエラーが発生しました',
        details: error.message
      })
    };
  }
};
