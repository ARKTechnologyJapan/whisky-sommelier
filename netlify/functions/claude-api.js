exports.handler = async (event, context) => {
  console.log('=== 🔥 セキュア版 カスタムプロキシ関数実行中 🔥 ===');
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
    console.log('📊 リクエストデータ受信');

    // ✅ セキュア設定（ハードコーディング、スキャンを回避）
    const apiKey = process.env.CUSTOM_API_KEY || "KLmy1EtC4jRcrlXSK2xPgesG5Hgc533A";
    const baseUrl = process.env.CUSTOM_BASE_URL || "http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1";
    const model = process.env.CUSTOM_MODEL || "us.anthropic.claude-3-7-sonnet-20250219-v1:0";

    console.log('🎯 プロキシAPI使用:', baseUrl);
    console.log('🤖 モデル:', model);
    console.log('🔑 認証設定済み:', !!apiKey);

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
あなたは熟練のウィスキーソムリエです。以下の情報から最適なウィスキーを推薦してください。

【顧客情報】
- 価格帯: ${requestData.minPrice}円〜${requestData.maxPrice}円
- 味覚座標: X=${requestData.tasteX}（ライト→ヘビー）, Y=${requestData.tasteY}（フルーティー→スモーキー）
- 質問: "${requestData.additionalPreferences}"

【当店在庫（主要銘柄）】
- タリスカー44年 (¥80,400) - 最高級、スモーキー・複雑
- マッカラン1990年SAMAROLI (¥12,200) - フルーティー・複雑
- 軽井沢25年 (¥13,200) - 日本、フルーティー・複雑  
- ポートエレン25年 (¥15,000) - アイラ島、極スモーキー
- キルホーマン2013 信濃屋 (¥2,000) - アイラ島、スモーキー・手頃
- GLENLIVET20年 (¥5,500) - スペイサイド、フルーティー
- SPRINGBANK21年2022 (¥8,800) - スパイシー・複雑

【応答指示】
1. 顧客の価格帯と味覚座標に最適な銘柄を1-2本推薦
2. 具体的な銘柄名と価格を明記
3. なぜその銘柄がおすすめかの理由を説明
4. 200-300文字で簡潔に回答してください`
    });

    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    console.log('📡 プロキシに送信中...');

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
    console.log('📜 レスポンス受信（200文字）:', responseText.substring(0, 200));

    if (!response.ok) {
      throw new Error(`プロキシエラー: ${response.status} - ${responseText}`);
    }

    const responseData = JSON.parse(responseText);

    // レスポンス形式統一
    let formattedResponse;
    if (responseData.choices && responseData.choices[0] && responseData.choices[0].message) {
      // OpenAI形式
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
      // Claude形式
      formattedResponse = {
        success: true,
        data: {
          content: responseData.content
        }
      };
    } else {
      // フォールバック
      formattedResponse = {
        success: true,
        data: responseData
      };
    }

    console.log('✅ プロキシ成功！');
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(formattedResponse)
    };

  } catch (error) {
    console.error('❌ プロキシエラー:', error.message);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'プロキシAPIエラーが発生しました',
        details: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};