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

    // リクエストタイプの判定（チャット or 推薦リスト）
    const isFullRecommendation = requestData.requestType === "full_recommendation";
    const outputFormat = requestData.outputFormat || "text";

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('CLAUDE_API_KEY not found');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // メッセージの処理
    const messages = [];

    // システムプロンプト - リクエストタイプによって変更
    if (isFullRecommendation) {
      messages.push({
        role: 'system',
        content: `あなたは「昼の月バー」の熟練ウィスキーソムリエです。以下の形式でJSON出力を生成してください:
        {
          "summary": "短い要約文（1-2文）",
          "recommendations": [
            {
              "name": "ウィスキー銘柄名（完全な名称）",
              "price": "価格（円表記）",
              "region": "地域名",
              "type": "タイプ（シングルモルト等）",
              "abv": "アルコール度数（数値のみ）",
              "description": "100文字程度の説明文",
              "taste_profile": {
                "fruity": 0-5の数値,
                "smoky": 0-5の数値,
                "complexity": 0-5の数値,
                "body": 0-5の数値,
                "spicy": 0-5の数値,
                "sweetness": 0-5の数値
              },
              "distillery_info": {
                "name": "蒸溜所名",
                "location": "場所",
                "founded": "設立年",
                "status": "稼働状況",
                "latitude": 緯度（数値）,
                "longitude": 経度（数値）,
                "description": "蒸溜所の簡単な説明"
              }
            },
            // 2つ目と3つ目のおすすめ...
          ]
        }
        
        必ず3つのウィスキーを推薦し、JSONとして有効な形式で出力してください。`
      });
    } else {
      messages.push({
        role: 'system',
        content: `あなたは「昼の月バー」の熟練ウィスキーソムリエです。常に温かく専門的に応答し、具体的な銘柄名と価格を含め、なぜその銘柄がおすすめかの理由を明確に説明してください。`
      });
    }

    // 過去のチャット履歴があれば追加
    if (requestData.chatHistory && Array.isArray(requestData.chatHistory) && requestData.chatHistory.length > 0) {
      // チャット履歴の最大数を制限（例：直近10件）
      const recentHistory = requestData.chatHistory.slice(-10);
      messages.push(...recentHistory);
    }

    // 最新のユーザーメッセージを追加（在庫情報と顧客分析を含む）
    messages.push({
      role: 'user',
      content: `【当店の在庫情報（150銘柄）】
      ■最高額銘柄: タリスカー44年 オフィシャルボトル（¥80,400）
      ■価格帯: ¥1,000台〜¥80,400まで幅広く在庫
      
      【味覚プロファイル別 個性的銘柄】
      ▼fruity最高（4点）: マッカラン1990年SAMAROLI、ABERFELDY18年1999、軽井沢25年、GLENLIVET20年など24銘柄
      ▼spicy最高（4点）: タリスカー44年、SPRINGBANK21年2022、GLENGLASSAUGH1973、ARDBEG9年1990など13銘柄  
      ▼body最高（5点）: タリスカー44年、マッカラン1990年SAMAROLI、BAR BARNS50年、MORTLACH各種など8銘柄
      ▼smoky最高（5点）: ポートエレン25年、アードベッグ各種、CAOL ILA各種、KILCHOMAN各種など11銘柄
      ▼sweetness最高（5点）: DAILUAINE RUM10年2012-2022（唯一の5点）
      ▼complexity最高（5点）: タリスカー44年、ポートエレン25年、マッカラン1990年、軽井沢25年など30銘柄
      
      【最近追加された銘柄】
      • ポウモア18年 ディープ&コンプレックス（¥8,200）: Body:4、Smoky:4、Complexity:4のプロファイル。アイラモルトの重厚さ、スモーキーさを持ち、熟成による複雑な味わいが特徴です。
      • ボウモアIsBS ディープコンプレックス（¥8,200）: Body:4、Smoky:4、Complexity:4のプロファイル、ヘビーでスモーキーなプロファイルをお探しの方におすすめです。18年熟成により、アイラモルトの特有の海の香りや、複雑な味の展開が楽しめます。
      • アードベッグ 10年（¥5,100）: スモーキーさが特徴的な定番アイラモルト。
      • 山崎蒸留所限定（¥7,500）: 日本を代表するウィスキーで、蜂蜜のような甘さとフルーティーさが特徴。
      
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
      - 価格帯: ${requestData.minPrice || 5000}円〜${requestData.maxPrice || 50000}円
      - 味覚座標: X軸=${requestData.tasteX || 0.5}（0=ライト→1=ヘビー）, Y軸=${requestData.tasteY || 0.5}（0=フルーティー→1=スモーキー）
      - 複雑さ座標: X軸=${requestData.complexityX || 0.5}（0=若い→1=熟成）, Y軸=${requestData.complexityY || 0.5}（0=まろやか→1=強烈）
      - 追加要望: ${requestData.additionalPreferences || 'なし'}
      
      ${isFullRecommendation ? 
        `【リクエスト】
        顧客の好みに合わせた最適なウィスキー3本を選んでください。最もマッチする1本を最初に、次点2本を続けて提案してください。
        必ず上記「最近追加された銘柄」も考慮に含め、顧客の好みに合っていればポウモア18年やボウモアIsBS ディープコンプレックスなども候補に入れてください。
        回答は指定されたJSON形式で出力してください。` :
        
        `【顧客からの質問】
        "${requestData.additionalPreferences || ''}"
        
        【応答指示】
        1. 上記の会話履歴を踏まえて回答すること
        2. ベテランバーテンダーとして、温かく専門的に応答
        3. 具体的な銘柄名と価格を含める（在庫から選択）
        4. なぜその銘柄がおすすめかの理由を明確に
        5. 味覚プロファイルの数値的根拠も提示
        6. 200-300文字程度で完結に
        7. 顧客の価格帯・味覚座標に最適化した提案
        8. 季節感や飲み方の提案も含める`
      }`
    });

    // Claude APIリクエストボディの更新
    const claudeRequestBody = {
      model: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', // モデル名を適切に変更
      max_tokens: 2000,
      temperature: 0.7,
      messages: messages
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
    
    // JSON出力要求の場合、整形する
    if (isFullRecommendation && outputFormat === "json" && claudeData.content && claudeData.content[0].text) {
      try {
        // APIからのテキスト応答をJSONに変換
        const responseText = claudeData.content[0].text;
        let jsonStartIndex = responseText.indexOf('{');
        let jsonEndIndex = responseText.lastIndexOf('}') + 1;
        
        if (jsonStartIndex >= 0 && jsonEndIndex > jsonStartIndex) {
          const jsonString = responseText.substring(jsonStartIndex, jsonEndIndex);
          const parsedJson = JSON.parse(jsonString);
          
          // JSON構造を検証
          if (parsedJson && parsedJson.recommendations && Array.isArray(parsedJson.recommendations)) {
            claudeData.content[0].text = JSON.stringify(parsedJson);
          }
        }
      } catch (error) {
        console.error('JSON解析エラー:', error);
        // エラーが発生しても元のテキストを使用
      }
    }
    
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