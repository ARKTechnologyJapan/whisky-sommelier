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

    // メッセージ構築
    const messages = [];

    // 過去のチャット履歴があれば追加
    if (requestData.chatHistory && Array.isArray(requestData.chatHistory) && requestData.chatHistory.length > 0) {
      const recentHistory = requestData.chatHistory.slice(-10);
      messages.push(...recentHistory);
    }

    // 最新のユーザーメッセージを追加
    messages.push({
      role: 'user',
      content: `【昼の月バー AIソムリエ】
あなたは熟練のウィスキーソムリエです。以下の情報から最適なウィスキーを推薦してください。

【顧客情報】
- 価格帯: ${requestData.minPrice}円〜${requestData.maxPrice}円
- 味覚座標: X軸=${requestData.tasteX}（0=ライト→1=ヘビー）, Y軸=${requestData.tasteY}（0=フルーティー→1=スモーキー）
- 質問: "${requestData.additionalPreferences}"

【当店在庫（一部抜粋）】
- タリスカー44年 (¥80,400) - 最高級、スモーキー・複雑
- マッカラン1990年SAMAROLI (¥12,200) - フルーティー・複雑
- 軽井沢25年 (¥13,200) - 日本、フルーティー・複雑  
- ポートエレン25年 (¥15,000) - アイラ島、極スモーキー
- キルホーマン2013 信濃屋 (¥2,000) - アイラ島、スモーキー・手頃
- GLENLIVET20年 (¥5,500) - スペイサイド、フルーティー
- SPRINGBANK21年2022 (¥8,800) - スパイシー・複雑

【指示】
1. 顧客の価格帯と味覚座標に最適な銘柄を1-2本推薦
2. 具体的な銘柄名と価格を明記
3. なぜその銘柄がおすすめかの理由を説明
4. 200-300文字で簡潔に回答`
    });

    // ✅ 修正されたAPIリクエスト
    const claudeRequestBody = {
      model: 'claude-3-sonnet-20240229',  // 正しいモデル名
      max_tokens: 1000,
      temperature: 0.7,
      messages: messages  // 修正：messagesは一つだけ
    };

    console.log('Sending request to Claude API...');

    // ✅ 正しいAPIエンドポイントとヘッダー
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,  // 修正：Authorizationではなくx-api-key
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(claudeRequestBody)
    });

    console.log('Response status:', claudeResponse.status);

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API Error:', errorText);
      throw new Error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
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