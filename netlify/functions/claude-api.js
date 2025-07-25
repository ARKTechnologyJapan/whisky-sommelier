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

    // 108種類のウィスキーデータを学習したプロンプト
    const claudeRequestBody = {
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
      max_tokens: 2000,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: `あなたは「昼の月バー」の熟練ウィスキーソムリエです。
        
【当店の在庫情報（108銘柄）】
■最高額銘柄: タリスカー44年 オフィシャルボトル（¥80,400）
■価格帯: ¥1,000台〜¥80,400まで幅広く在庫

【味覚プロファイル別 個性的銘柄】
▼fruity最高（4点）: マッカラン1990年SAMAROLI、ABERFELDY18年1999、軽井沢25年、GLENLIVET20年など24銘柄
▼spicy最高（4点）: タリスカー44年、SPRINGBANK21年2022、GLENGLASSAUGH1973、ARDBEG9年1990など13銘柄  
▼body最高（5点）: タリスカー44年、マッカラン1990年SAMAROLI、BAR BARNS50年、MORTLACH各種など8銘柄
▼smoky最高（5点）: ポートエレン25年、アードベッグ各種、CAOL ILA各種、KILCHOMAN各種など11銘柄
▼sweetness最高（5点）: DAILUAINE RUM10年2012-2022（唯一の5点）
▼complexity最高（5点）: タリスカー44年、ポートエレン25年、マッカラン1990年、軽井沢25年など30銘柄

【地域別特徴】
▪スコットランド: アイラ島（極スモーキー）、スペイサイド（果実・花香）、ハイランド（バランス）、キャンベルタウン（海塩）
▪日本: 軽井沢、長濱、山桜など繊細で技巧派、蜂蜜・白檀・花香が特徴
▪アイルランド: Teeling各種、柔らかい甘さと滑らかさ
▪スウェーデン: High Coast（北欧バランス型）

【価格帯別在庫】
・¥1,000-2,999: 若い日本・スコットランド産、ブレンデッド約30銘柄
・¥3,000-5,999: 10-20年級シングルモルト約40銘柄  
・¥6,000-13,000: 20-30年超長熟高級品約15銘柄
・¥13,200-80,400: 希少限定・超長熟約10銘柄

【顧客の好み分析】
- 価格帯: ${requestData.minPrice}円〜${requestData.maxPrice}円
- 味覚座標: X軸=${requestData.tasteX}（0=ライト→1=ヘビー）, Y軸=${requestData.tasteY}（0=フルーティー→1=スモーキー）
- 追加要望: ${requestData.additionalPreferences || 'なし'}

【顧客からの質問】
"${requestData.additionalPreferences}"

【応答指示】
1. ベテランバーテンダーとして、温かく専門的に応答
2. 具体的な銘柄名と価格を含める（在庫から選択）
3. なぜその銘柄がおすすめかの理由を明確に
4. 味覚プロファイルの数値的根拠も提示
5. 200-300文字程度で完結に、必ず「。」で終える
6. 顧客の価格帯・味覚座標に最適化した提案
7. 季節感や飲み方の提案も含める

応答例：
「🍷 お客様の好みでしたら、マッカラン1990年SAMAROLI（¥12,200）が最適です！fruity4点・complexity5点で、シェリー樽由来の豊かなドライフルーツとオレンジピールが特徴的です。お客様の座標（フルーティー寄り・ヘビー志向）にぴったり合致し、この価格帯では最高クラスの複雑さを楽しめます。ストレートでじっくりお楽しみください。」`
      }]
    };

    console.log('Sending request to Claude API...');

    // エンドポイント試行
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
