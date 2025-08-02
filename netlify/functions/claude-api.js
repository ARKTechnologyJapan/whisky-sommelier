exports.handler = async (event, context) => {
  console.log('=== 🔥 昼の月AIソムリエ実行中 🔥 ===');
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

    // 🔒 環境変数からセキュアに取得
    const apiKey = process.env.CLAUDE_API_KEY;
    const baseUrl = process.env.CLAUDE_BASE_URL;
    const model = process.env.CLAUDE_MODEL;

    // 必須環境変数のチェック
    if (!apiKey || !baseUrl || !model) {
      throw new Error('必要な環境変数が設定されていません');
    }

    console.log('🎯 プロキシ使用中');
    console.log('🤖 モデル設定済み');
    console.log('🔑 認証設定済み:', !!apiKey);

    // 味覚プロファイルの分析
    const tasteProfile = analyzeTasteProfile(requestData.tasteX, requestData.tasteY);
    
    // チャット履歴の分析
    const conversationContext = analyzeConversationHistory(requestData.chatHistory);

    // 統合推薦メッセージの構築
    const enhancedPrompt = buildEnhancedSystemMessage(tasteProfile, conversationContext, requestData);

    // メッセージ構築（OpenAI形式）
    const messages = [
      {
        role: 'user',
        content: enhancedPrompt
      }
    ];

    const requestBody = {
      model: model,
      messages: messages,
      max_tokens: 1500,
      temperature: 0.7
    };

    console.log('📡 プロキシAPIに送信中...');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📥 レスポンスステータス:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ プロキシAPI成功！');

    // レスポンス形式の統一
    const formattedResponse = {
      success: true,
      data: responseData,
      tasteAnalysis: tasteProfile,
      conversationInsights: conversationContext,
      timestamp: new Date().toISOString()
    };

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

// 味覚プロファイルの詳細分析
function analyzeTasteProfile(tasteX, tasteY) {
  // デフォルト値設定
  const x = tasteX || 150;
  const y = tasteY || 150;
  
  const xNormalized = x / 300; // 0-1に正規化
  const yNormalized = y / 300;

  return {
    coordinates: { x, y },
    normalized: { x: xNormalized, y: yNormalized },
    bodyIntensity: xNormalized, // 0=ライト, 1=ヘビー
    flavorProfile: yNormalized, // 0=フルーティー, 1=スモーキー
    quadrant: getQuadrant(xNormalized, yNormalized),
    characteristics: getTasteCharacteristics(xNormalized, yNormalized)
  };
}

function getQuadrant(x, y) {
  if (x < 0.5 && y < 0.5) return "ライト&フルーティー";
  if (x >= 0.5 && y < 0.5) return "ヘビー&フルーティー";
  if (x < 0.5 && y >= 0.5) return "ライト&スモーキー";
  return "ヘビー&スモーキー";
}

function getTasteCharacteristics(x, y) {
  return {
    sweetness: Math.max(0.2, 1 - y), // スモーキーほど甘さ減少
    smokiness: y,
    richness: x,
    complexity: (x + y) / 2,
    approachability: Math.max(0.1, 1 - x) // ヘビーほど親しみやすさ減少
  };
}

// 会話履歴の分析
function analyzeConversationHistory(chatHistory) {
  if (!chatHistory || !Array.isArray(chatHistory) || chatHistory.length === 0) {
    return { 
      hasHistory: false, 
      insights: [],
      preferences: {
        mentionedRegions: [],
        mentionedFlavors: [],
        pricePreference: null,
        experienceLevel: 'beginner'
      }
    };
  }

  const insights = [];
  const preferences = {
    mentionedRegions: [],
    mentionedFlavors: [],
    pricePreference: null,
    experienceLevel: 'beginner',
    specificRequests: []
  };

  // 会話から嗜好を抽出
  chatHistory.forEach((message, index) => {
    if (message.role === 'user' && message.content) {
      const content = message.content.toLowerCase();
      
      // 地域の言及
      const regionKeywords = {
        'スコッチ': ['スコッチ', 'scotland', 'スコットランド'],
        '日本': ['日本', 'japanese', 'ジャパニーズ'],
        'アイラ島': ['アイラ', 'islay'],
        'スペイサイド': ['スペイサイド', 'speyside'],
        'キャンベルタウン': ['キャンベルタウン', 'campbeltown'],
        'ハイランド': ['ハイランド', 'highland']
      };

      Object.entries(regionKeywords).forEach(([region, keywords]) => {
        if (keywords.some(keyword => content.includes(keyword))) {
          if (!preferences.mentionedRegions.includes(region)) {
            preferences.mentionedRegions.push(region);
          }
        }
      });
      
      // フレーバーの言及
      const flavorKeywords = {
        'スモーキー': ['スモーキー', 'smoky', 'ピート', 'peat'],
        '甘い': ['甘い', 'sweet', 'はちみつ', 'honey'],
        'フルーティー': ['フルーティー', 'fruity', '果実', 'apple', 'りんご'],
        'スパイシー': ['スパイシー', 'spicy', '辛い', 'pepper'],
        'ナッツ': ['ナッツ', 'nutty', 'アーモンド'],
        'チョコレート': ['チョコレート', 'chocolate', 'ココア']
      };

      Object.entries(flavorKeywords).forEach(([flavor, keywords]) => {
        if (keywords.some(keyword => content.includes(keyword))) {
          if (!preferences.mentionedFlavors.includes(flavor)) {
            preferences.mentionedFlavors.push(flavor);
          }
        }
      });

      // 経験レベルの推定
      if (content.includes('初心者') || content.includes('初めて') || content.includes('わからない')) {
        preferences.experienceLevel = 'beginner';
      } else if (content.includes('詳しく') || content.includes('専門') || content.includes('マニア')) {
        preferences.experienceLevel = 'advanced';
      } else if (preferences.mentionedRegions.length > 2 || preferences.mentionedFlavors.length > 3) {
        preferences.experienceLevel = 'intermediate';
      }

      // 具体的なリクエストを記録
      if (content.length > 10) {
        preferences.specificRequests.push({
          message: message.content,
          index: index
        });
      }
    }
  });

  return {
    hasHistory: true,
    preferences: preferences,
    insights: insights,
    messageCount: chatHistory.length,
    recentMessages: chatHistory.slice(-3) // 直近3メッセージ
  };
}

// 統合推薦システムメッセージの構築
function buildEnhancedSystemMessage(tasteProfile, conversationContext, requestData) {
  const minPrice = requestData.minPrice || 5000;
  const maxPrice = requestData.maxPrice || 50000;
  const question = requestData.additionalPreferences || '';

  let systemMessage = `【昼の月バー AIソムリエ - 統合分析システム】

あなたは昼の月バーの熟練したウィスキーソムリエです。お客様の味覚プロファイルと会話履歴を総合的に分析し、最適なウィスキーを心を込めて推薦してください。

【お客様の味覚プロファイル詳細分析】
- 四象限位置: ${tasteProfile.quadrant}
- X軸座標: ${tasteProfile.coordinates.x}/300 (ライト → ヘビー)
- Y軸座標: ${tasteProfile.coordinates.y}/300 (フルーティー → スモーキー)
- ボディの好み: ${(tasteProfile.bodyIntensity * 100).toFixed(0)}%
- スモーキー度の好み: ${(tasteProfile.flavorProfile * 100).toFixed(0)}%
- 複雑性への嗜好: ${(tasteProfile.characteristics.complexity * 100).toFixed(0)}%
- 親しみやすさ重視度: ${(tasteProfile.characteristics.approachability * 100).toFixed(0)}%

【ご予算】
${minPrice.toLocaleString()}円 ～ ${maxPrice.toLocaleString()}円

【今回のご質問・ご要望】
"${question}"

`;

  // 会話履歴がある場合の詳細分析
  if (conversationContext.hasHistory) {
    systemMessage += `
【これまでの会話から読み取れるお客様の嗜好】
- 会話回数: ${conversationContext.messageCount}回
- 推定経験レベル: ${conversationContext.preferences.experienceLevel}
- 興味をお持ちの地域: ${conversationContext.preferences.mentionedRegions.join('、') || 'まだ特定なし'}
- 言及されたフレーバー: ${conversationContext.preferences.mentionedFlavors.join('、') || 'まだ特定なし'}

`;

    if (conversationContext.recentMessages.length > 0) {
      systemMessage += `【直近のやり取り】\n`;
      conversationContext.recentMessages.forEach((msg, idx) => {
        if (msg.role === 'user') {
          systemMessage += `- お客様: "${msg.content}"\n`;
        }
      });
      systemMessage += '\n';
    }
  }

  systemMessage += `
【昼の月バー 厳選ウィスキーコレクション】
🏆 プレミアムコレクション:
- タリスカー44年 (¥80,400) - アイラ島の至宝、極上スモーキー、複雑性最高級
- マッカラン1990年SAMAROLI (¥12,200) - シェリー樽熟成、リッチ&フルーティー
- 軽井沢25年 (¥13,200) - 日本ウィスキーの傑作、エレガント&フルーティー
- ポートエレン25年 (¥15,000) - 閉鎖蒸溜所の伝説、極スモーキー&希少

🌟 おすすめセレクション:
- スプリングバンク21年2022 (¥8,800) - キャンベルタウン、スパイシー&複雑
- グレンリベット20年 (¥5,500) - スペイサイド、フルーティー&バランス良好
- キルホーマン2013 信濃屋 (¥2,000) - アイラ島、スモーキー&コストパフォーマンス抜群

【推薦のお願い】
1. 味覚座標、会話履歴、ご予算を総合的に考慮
2. お客様の成長や新しい発見も視野に入れた提案
3. 選択理由を感情に響く形で説明
4. 価格帯内での最高の価値を提供
5. 温かみのある、親しみやすい口調で
6. 250-350文字程度で魅力的に

お客様との素敵なウィスキーの出会いをプロデュースする気持ちで、心のこもった推薦をお願いいたします。`;

  return systemMessage;
}