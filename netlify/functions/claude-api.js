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

    // カスタムAPI設定
    const apiKey = "KLmy1EtC4jRcrlXSK2xPgesG5Hgc533A";
    const baseUrl = "http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1";
    const model = "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

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

    // APIリクエストボディ（OpenAI ChatCompletion形式）
    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    console.log('Sending request to Custom API...');
    console.log('Endpoint:', `${baseUrl}/chat/completions`);

    // カスタムAPIエンドポイントに送信
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('API Success Response:', JSON.stringify(responseData, null, 2));

    // レスポンス形式を統一（OpenAI形式をClaude形式にマッピング）
    let formattedResponse;
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
      // OpenAI形式のレスポンス
      formattedResponse = {
        success: true,
        data: {
          choices: [{
            message: {
              content: responseData.choices[0].message.content
            }
          }]
        }
      };
    } else if (responseData.content && responseData.content[0]) {
      // Claude形式のレスポンス
      formattedResponse = {
        success: true,
        data: {
          content: responseData.content
        }
      };
    } else {
      // その他の形式への対応
      formattedResponse = {
        success: true,
        data: responseData
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedResponse)
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
        details: error.message
      })
    };
  }
};