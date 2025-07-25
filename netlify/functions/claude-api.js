exports.handler = async (event, context) => {
  console.log('=== Claude API Function 開始 ===');
  console.log('HTTP Method:', event.httpMethod);
  console.log('Headers:', event.headers);
  console.log('Body:', event.body);

  // CORS対応ヘッダー
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONSリクエスト（プリフライト）の処理
  if (event.httpMethod === 'OPTIONS') {
    console.log('OPTIONS request received');
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    console.log('Invalid method:', event.httpMethod);
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'POSTメソッドのみ許可されています' })
    };
  }

  try {
    // リクエストデータの解析
    let requestData;
    try {
      requestData = JSON.parse(event.body);
      console.log('Parsed request data:', requestData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON format' })
      };
    }

    // 環境変数の確認
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('CLAUDE_API_KEY not found');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }
    console.log('API Key available:', apiKey ? 'Yes' : 'No');

    // Claude APIリクエスト作成
    const claudeRequestBody = {
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `あなたは昼の月バーの専門ウィスキーソムリエです。以下の顧客の好みに基づいて、正確に3つのウィスキーを推薦してください：

【顧客の好み】
- 価格帯: ${requestData.minPrice || 1000}円 〜 ${requestData.maxPrice || 10000}円
- 味覚座標: X軸=${requestData.tasteX || 0.5} (0=ライト, 1=ヘビー), Y軸=${requestData.tasteY || 0.5} (0=フルーティー, 1=スモーキー)  
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

    // Claude APIへのリクエスト
    const claudeResponse = await fetch('http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeRequestBody)
    });

    console.log('Claude API Response Status:', claudeResponse.status);
    console.log('Claude API Response Headers:', claudeResponse.headers);

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API Error Response:', errorText);
      throw new Error(`Claude API Error: ${claudeResponse.status} - ${errorText}`);
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
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'サーバーエラーが発生しました',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};
