exports.handler = async (event, context) => {
  console.log('=== 🔥 UPDATED カスタムプロキシ版 関数実行中 🔥 ===');
  console.log('HTTP Method:', event.httpMethod);

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
    console.log('📊 リクエストデータ受信:', requestData);

    // カスタムプロキシ設定
    const apiKey = "KLmy1EtC4jRcrlXSK2xPgesG5Hgc533A";
    const baseUrl = "http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1";
    const model = "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

    console.log('🎯 カスタムプロキシAPI使用:', baseUrl);
    console.log('🤖 モデル:', model);

    // メッセージ構築
    const messages = [];

    // チャット履歴追加
    if (requestData.chatHistory && Array.isArray(requestData.chatHistory)) {
      const recentHistory = requestData.chatHistory.slice(-10);
      messages.push(...recentHistory);
    }

    // 新しいユーザーメッセージ
    messages.push({
      role: 'user',
      content: `【昼の月バー AIソムリエ】
あなたは熟練のウィスキーソムリエです。

【顧客情報】
- 価格帯: ${requestData.minPrice}円〜${requestData.maxPrice}円
- 味覚座標: X=${requestData.tasteX}（ライト→ヘビー）, Y=${requestData.tasteY}（フルーティー→スモーキー）
- 質問: "${requestData.additionalPreferences}"

【在庫例】
- タリスカー44年 (¥80,400) - スモーキー・最高級
- マッカラン1990年 (¥12,200) - フルーティー・複雑
- GLENLIVET20年 (¥5,500) - スペイサイド・フルーティー
- キルホーマン2013 (¥2,000) - アイラ島・スモーキー

顧客の好みに最適な銘柄を1-2本、具体的な理由と共に200-300文字で推薦してください。`
    });

    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    console.log('📡 カスタムプロキシに送信中...');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 レスポンスステータス:', response.status);

    const responseText = await response.text();
    console.log('📜 レスポンス内容（最初の300文字）:', responseText.substring(0, 300));

    if (!response.ok) {
      throw new Error(`カスタムプロキシエラー: ${response.status} - ${responseText}`);
    }

    const responseData = JSON.parse(responseText);

    // レスポンス形式統一
    let formattedResponse;
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
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
      formattedResponse = {
        success: true,
        data: {
          content: responseData.content
        }
      };
    } else {
      formattedResponse = {
        success: true,
        data: responseData
      };
    }

    console.log('✅ カスタムプロキシ成功！');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedResponse)
    };

  } catch (error) {
    console.error('❌ カスタムプロキシエラー:', error.message);
    console.error('Stack trace:', error.stack);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'カスタムプロキシAPIエラー',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};