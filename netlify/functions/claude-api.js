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

    // チャット履歴から言及された銘柄を抽出する関数
    function extractMentionedWhiskies(chatHistory) {
      const mentionedWhiskies = new Set();
      const knownBrands = [
        'ボウモア', 'bowmore', 'マッカラン', 'タリスカー', 'アードベッグ',
        'カリラ', 'キルホーマン', '山崎', '白州', '響', '軽井沢', 'ポートエレン',
        'CAOL ILA', 'カオルアイラ', 'GLENLIVET', 'グレンリベット',
        'SPRINGBANK', 'スプリングバンク', 'ABERFELDY', 'アベラフェルディ', 'アバフェルディ',
        'MORTLACH', 'モートラック', 'KILCHOMAN', 'キルホーマン',
        'DAILUAINE', 'デイルアイン', 'ダリュイン', 'BRUICHLADDICH', 'ブルックラディ',
        'GLENGLASSAUGH', 'グレングラッサ', 'ARDBEG', 'アードベック',
        'ジュラ', 'Jura', 'ハイランドパーク', 'HIGHLAND PARK', 'Orkney',
        'ローズバンク', 'BUNNAHABHAIN', 'ブナハーブン', 'GLENTAUCHERS', 'グレンタウチャーズ',
        'BEN NEVIS', 'ベンネビス', 'High Coast', 'ハイコースト',
        'Benromach', 'ベンロマック', '長濱', 'NAGAHAMA', 'クライヌリッシュ',
        'glengarioch', 'GlenGarioch', 'グレンギリー', 'BLAIR ATHOL', 'ブレアアソル',
        'FETTERCAIRN', 'フェッターケアン', 'Glenfarclas', 'グレンファークラス',
        'Linkwood', 'リンクウッド', '津貫', 'MARS', 'マルス',
        'GLEN GLASSAUGH', 'グレングラッサウ', 'GLEN GRANT', 'グレングラント',
        'イチローズモルト', '秩父', 'LEDAIG', 'レダイグ', 'トバモリー',
        'GLEN ORD', 'グレンオード', '桜尾', 'Royal Brackla', 'ロイヤルブラックラ',
        'TAMDHU', 'タムドゥ', 'Glentauchers', 'グレントファース', 
        'Invergoroon', 'インヴァーゴードン', '安積', 'YAMAZAKURA',
        'TOMINTOUL', 'トミントウル', 'TEANINICH', 'ティーニニック', 
        'PITTYVAICH', 'ピティヴァイク', 'GLENMORANGIE', 'グレンモーレンジー',
        'YUZA', '游佐', '明石', '三郎丸', 'ダルウィニー', '厚岸',
        'Teeling', 'ティーリング'
      ];
      
      if (chatHistory && Array.isArray(chatHistory)) {
        chatHistory.forEach(message => {
          if (message.content) {
            knownBrands.forEach(brand => {
              if (message.content.toLowerCase().includes(brand.toLowerCase())) {
                mentionedWhiskies.add(brand);
              }
            });
          }
        });
      }

      // additionalPreferences からも銘柄を検索（チャット履歴がない場合）
      if (requestData.additionalPreferences) {
        knownBrands.forEach(brand => {
          if (requestData.additionalPreferences.toLowerCase().includes(brand.toLowerCase())) {
            mentionedWhiskies.add(brand);
          }
        });
      }
      
      return Array.from(mentionedWhiskies);
    }

    // メッセージの処理
    const messages = [];

    // 在庫している主要銘柄リストと蒸留所情報（システムプロンプトに統合）
    const whiskyCatalog = `
    【当店の取り扱い主要銘柄と蒸留所リスト】
    
    ■ スコットランド - アイラ島
    - タリスカー44年 オフィシャルボトル (¥80,400) - タリスカー蒸溜所
    - タリスカー11年 - タリスカー蒸溜所
    - ポートエレン25年 one of only bottles - ポートエレン蒸溜所
    - ボウモア26年 ダンカンテイラー - ボウモア蒸溜所
    - ボウモア15年 マリナー (¥4,800) - ボウモア蒸溜所
    - ボウモア13年 1998-2011 - ボウモア蒸溜所
    - ボウモア12年 (¥3,500) - ボウモア蒸溜所
    - ブナハーブン12年 80年代 (BUNNAHABHAIN) - ブナハーブン蒸溜所
    - アードベッグ10年 (¥5,100) - アードベッグ蒸溜所
    - アードベッグ19年 バッチ2 - アードベッグ蒸溜所
    - アードベッグ9年 1990-2000 - アードベッグ蒸溜所
    - ISLAY KILDALTON13年 2009-2022 (アードベッグ) - アードベッグ蒸溜所
    - キルホーマン マキヤーベイ (¥4,200) - キルホーマン蒸溜所
    - キルホーマン2022 - キルホーマン蒸溜所
    - キルホーマン2021 - キルホーマン蒸溜所
    - キルホーマン2013-2021 信濃屋 - キルホーマン蒸溜所
    - キルホーマン2013-2021 - キルホーマン蒸溜所
    - キルホーマン2010 シェリーカスク (¥5,200) - キルホーマン蒸溜所
    - カリラ (CAOL ILA) 18年 1974-1993 - カリラ蒸溜所
    - カリラ (CAOL ILA) 14年 2008-2023 - カリラ蒸溜所
    - カリラ (CAOL ILA) 2003-2017 - カリラ蒸溜所
    - ブルックラディ (ASTER11年BRUICHLADDICH) 2012 - ブルックラディ蒸溜所
    - レダイグ (LEDAIG) 1992-1999 - トバモリー蒸溜所（レダイグ）
    
    ■ スコットランド - スペイサイド/ハイランド
    - マッカラン1990年 SAMAROLI - マッカラン蒸溜所
    - マッカラン22年 1985-2007 - マッカラン蒸溜所
    - マッカラン7年 - マッカラン蒸溜所
    - グレンリベット (GLENLIVET) 20年 2003-2023 - グレンリベット蒸溜所
    - アバフェルディ (ABERFELDY) 18年 1999 - アバフェルディ蒸溜所
    - モートラック (MORTLACH) 14年 2007-2021 - モートラック蒸溜所
    - モートラック (MORTLACH) 13年 2007-2020 - モートラック蒸溜所
    - モートラック (MORTLACH) 2023 - モートラック蒸溜所
    - ダリュイン (DAILUAINE) RUM10年 2012-2022 - ダリュイン蒸溜所
    - ダリュイン (DAILUAINE) 23年 1997-2021 - ダリュイン蒸溜所
    - ダリュイン (DAILUAINE) 10年 2011-2021 - ダリュイン蒸溜所
    - ダリュイン (DAILUAINE) 9年 2013-2022 - ダリュイン蒸溜所
    - ベンネビス (BEN NEVIS) 2009-2021 11年 - ベンネビス蒸溜所
    - ベンネビス (Benrinnes) 1973-1998 - ベンネビス蒸溜所
    - ハイランドパーク (ORKNEY) 18年 2004-2023 - ハイランドパーク蒸溜所
    - ハイランドパーク (ORKNEY) 22年 1999-2021 - オークニー（ハイランドパーク）蒸溜所
    - ハイランドパーク (ORKNEY) 13年 2008 - オークニー（ハイランドパーク）蒸溜所
    - ハイランドパーク (HIGHLAND PARK) 1986-2006 - ハイランドパーク蒸溜所
    - ベンロマック (Benromach) 2009-2021 223瓶限定 - ベンロマック蒸溜所
    - グレンタウチャーズ (GLENTAUCHERS) 11年 2011-2023 - グレンタウチャーズ蒸溜所
    - グレンタウチャーズ (Glentauchers) 31年 1989-2021 - グレントファース蒸溜所
    - グレンギリー (glengarioch) 14年 2008 - グレンギリー蒸溜所
    - グレンギリー (GlenGarioch) 18年 1994-2013 - グレンギリー蒸溜所
    - ブレアアソル (BLAIR ATHOL) 11年 2011-2023 - ブレアアソル蒸溜所
    - グレンファークラス (Glenfarclas) 莨樽周年 2008-2023 - グレンファークラス蒸溜所
    - グレンファークラス (Glenfarclas) 11年 2009-2021 - グレンファークラス蒸溜所
    - リンクウッド (Linkwood) 15年 2008-2023 - リンクウッド蒸溜所
    - リンクウッド (LINKWOOD) 13年 SHIMAJIボトル - リンクウッド蒸溜所
    - フェッターケアン (FETTERCAIRN) 25年 1995-2021 - フェッターケアン蒸溜所
    - フェッターケアン (Old FETTERCAIRN) 80年代 - フェッターケアン蒸溜所
    - グレングラッサウ (GLEN GLASSAUGH) 1973 - グレングラッサウ蒸溜所
    - グレングラント (GLENGRANT) 25年 1995 - グレングラント蒸溜所
    - グレンオード (GLEN ORD) 2009-2023 - グレンオード蒸溜所
    - ロイヤルブラックラ (Royal Brackla) 2011-2021 - ロイヤルブラックラ蒸溜所
    - ロイヤルブラックラ (ROYAL BRACKLA) 13年 2009-2022 - ロイヤルブラックラ蒸溜所
    - タムドゥ (TAMDHU) 2006-2022 - タムドゥ蒸溜所
    - インヴァーゴードン (Invergoroon) 1972-2021 49年 - インヴァーゴードン蒸溜所
    - トミントウル (TOMINTOUL) 16年 1999 19年 - トミントウル蒸溜所
    - ティーニニック (TEANINICH) 21年 1999-2020 - ティーニニック蒸溜所
    - ピティヴァイク (PITTYVAICH) 2019年 29年 - ピティヴァイク蒸溜所
    - グレンモーレンジー (GLENMORANGIE) 10Years Old - グレンモーレンジー蒸溜所
    - グレンモーレンジー (GLENMORANGIE) PORT WOOD FINISH - グレンモーレンジー蒸溜所
    - ダルウィニー30年 2019 - ダルウィニー蒸溜所

    ■ スコットランド - キャンベルタウン
    - スプリングバンク (SPRINGBANK) 21年 2022年 - スプリングバンク蒸溜所
    - スプリングバンク (ADELPHI Springbank) 22年 1998-2021 - スプリングバンク蒸溜所
    - スプリングバンク (SPRINGBANK) 12年 1997-2009 - スプリングバンク蒸溜所

    ■ スコットランド - その他
    - ローズバンク1990年 イエコーン - ローズバンク蒸溜所
    - ジュラ (Jura) 1999 - ジュラ蒸溜所
    - エドラダワー (エドラタワー) 10年750ml 80年代 - エドラダワー蒸溜所

    ■ 日本
    - 軽井沢 (KARUIZAWA) 25年 - 軽井沢蒸溜所
    - 軽井沢 (軽井沢) 12年 - 軽井沢蒸溜所
    - 軽井沢 (軽井沢) 100%malt - 軽井沢蒸溜所
    - 山崎蒸留所樽出原酒58度大阪50周年 - 山崎蒸溜所
    - 山崎 (山崎) 10年 - 山崎蒸溜所
    - 長濱 (NAGAHAMA) INAZUMA2021 - 長濱蒸溜所
    - 長濱 (NAGAHAMA) シングルモルト2019-2022 - 長濱蒸溜所
    - 秩父 (秩父) 2016-2021 イチローズモルト - 秩父蒸溜所
    - 秩父 (秩父) ESTABLISHED2004 - 秩父蒸溜所
    - 秩父 (秩父) 第二蒸留所 ウィスキー - 秩父蒸溜所
    - 秩父 (IchirosMWR) - 秩父蒸溜所
    - 秩父 (IchirosWWR) - 秩父蒸溜所
    - 秩父 (IchirosDD) - 秩父蒸溜所
    - マルス (MARS) The YA屋久岛 - マルス駒ヶ岳蒸溜所
    - マルス (MARS) ラッキーキャット ウィスキー - マルス駒ヶ岳蒸溜所
    - マルス (駒ヶ岳) 蝶々2024 - マルス駒ヶ岳蒸溜所
    - 津貫 (津贯) 2018-2021 ５周年記念ボトル - マルス津貫蒸溜所
    - 桜尾 (樱尾) 2020-2023 - 桜尾蒸溜所
    - 桜尾 (樱尾) 2020-2023 信濃屋 - 桜尾蒸溜所
    - 桜尾 (樱尾) 4年2020 - 桜尾蒸溜所
    - 安積 (安積) 2017－2022 - 安積蒸溜所（YAMAZAKURA）
    - 游佐 (YUZA) 2022ウィスキー - 游佐蒸溜所
    - 明石 (明石) 3年粉色ウィスキー - 明石蒸溜所
    - 三郎丸 (三郎丸) 2020-2025 ウィスキー - 三郎丸蒸溜所
    - 厚岸 (厚岸) 小暑2024 ウィスキー - 厚岸蒸溜所

    ■ アイルランド
    - ティーリング (Teeling) 2021年祭ボトル - ティーリング蒸溜所
    - ティーリング (Teeling) 2012-2020 - ティーリング蒸溜所
    - ティーリング (TEELING) 18年 2005-2023 - ティーリング蒸溜所

    ■ スウェーデン
    - ハイコースト (High Coast) 2013-2021 - ハイコースト蒸溜所
    `;

    // システムプロンプト - リクエストタイプによって変更
    if (isFullRecommendation) {
      // 言及された銘柄を抽出
      const mentionedWhiskies = extractMentionedWhiskies(requestData.chatHistory);
      const mentionedWhiskiesInstructions = mentionedWhiskies.length > 0 ? 
        `\n\n【重要指示】ユーザーが「${mentionedWhiskies.join('」「')}」に言及しています。これらの銘柄の中から条件に合うものを必ず1つ以上、推薦リストに含めてください。言及された銘柄が条件に合わない場合でも、可能な限り近いプロファイルの銘柄として含めるようにしてください。` : '';

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
        
        ${whiskyCatalog}
        
        必ず3つのウィスキーを推薦し、JSONとして有効な形式で出力してください。${mentionedWhiskiesInstructions}`
      });
    } else {
      // 言及された銘柄を抽出
      const mentionedWhiskies = extractMentionedWhiskies(requestData.chatHistory);
      const mentionedWhiskiesInstructions = mentionedWhiskies.length > 0 ? 
        `\n\n【重要指示】ユーザーが「${mentionedWhiskies.join('」「')}」に言及しています。これらの銘柄について質問されている場合は、在庫リストに基づいて正確に回答してください。` : '';

      messages.push({
        role: 'system',
        content: `あなたは「昼の月バー」の熟練ウィスキーソムリエです。常に温かく専門的に応答し、具体的な銘柄名と価格を含め、なぜその銘柄がおすすめかの理由を明確に説明してください。
        
        ${whiskyCatalog}${mentionedWhiskiesInstructions}`
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
      • ボウモア 15年 マリナー（¥4,800）: Smoky(3点)とFruity(3点)のバランスが絶妙。お客様の味覚座標(X=${requestData.tasteX || 0.5}, Y=${requestData.tasteY || 0.5})に近い位置づけです。
      • ボウモア 26年 ダンカンテイラー: 長期熟成による豊かで複雑な香り、アイラ特有のスモーキーさと甘みが絶妙に調和しています。
      • ボウモア 12年 (¥3,500): スタンダードながら上質なアイラモルトで、バランスの取れた味わいが特徴です。
      • ボウモア 13年 1998-2011: 希少なヴィンテージボトリングで、独特の複雑さを楽しめます。
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
        必ず上記「最近追加された銘柄」も考慮に含め、顧客の好みに合っていればボウモア15年やボウモア26年などのボウモアシリーズも候補に入れてください。
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
            // チャットで言及された銘柄が含まれているか確認
            const mentionedWhiskies = extractMentionedWhiskies(requestData.chatHistory);
            
            // 言及された銘柄が含まれているか確認し、含まれていない場合は注記を追加
            if (mentionedWhiskies.length > 0) {
              let hasMentionedWhisky = false;
              
              // 推薦リスト内に言及された銘柄があるか確認
              for (const whisky of parsedJson.recommendations) {
                for (const brand of mentionedWhiskies) {
                  if (whisky.name.toLowerCase().includes(brand.toLowerCase())) {
                    hasMentionedWhisky = true;
                    break;
                  }
                }
                if (hasMentionedWhisky) break;
              }
              
              // 言及された銘柄が含まれていない場合、強制的に追加する
              if (!hasMentionedWhisky) {
                console.log(`言及された銘柄「${mentionedWhiskies.join('」「')}」が推薦リストに含まれていません。注記を追加します。`);
                
                // 言及された銘柄について注記
                parsedJson.summary = `お話にあった「${mentionedWhiskies.join('」「')}」は現在の設定条件では上位に入りませんでしたが、以下の3つの銘柄が最もお好みに合うと思われます。\n` + parsedJson.summary;
              }
            }
            
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