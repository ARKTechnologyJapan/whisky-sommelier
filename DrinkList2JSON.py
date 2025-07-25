# -*- coding: utf-8 -*-
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import pandas as pd
import requests
from bs4 import BeautifulSoup
import json
import time
import threading
from urllib.parse import quote, urlparse
import re
from datetime import datetime
import os
import sys

class WhiskeyAnalyzerEnhanced:
    """
    ウィスキー分析システム拡張版
    - taste_profile自動採点機能追加
    - JSON/Excelエクスポート機能
    - エラーハンドリング強化
    """
    
    def __init__(self, output_folder="output"):
        # LLM API設定
        self.api_key = "KLmy1EtC4jRcrlXSK2xPgesG5Hgc533A"
        self.base_url = "http://Bedroc-Proxy-wEBSZeIAE9sX-1369774611.us-east-1.elb.amazonaws.com/api/v1"
        self.model = "us.anthropic.claude-3-7-sonnet-20250219-v1:0"
        
        # HTTP セッション設定
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        
        # 出力フォルダ設定
        self.output_folder = os.path.abspath(output_folder)
        self.ensure_directories()
        
        # 統計情報
        self.stats = {
            'processed': 0,
            'successful': 0,
            'skipped': 0,
            'errors': [],
            'taste_profiles_generated': 0
        }
    
    def ensure_directories(self):
        """必要なディレクトリを作成"""
        try:
            os.makedirs(self.output_folder, exist_ok=True)
            print(f"✅ 出力フォルダ準備完了: {self.output_folder}")
        except Exception as e:
            print(f"❌ フォルダ作成失敗: {e}")
            self.output_folder = os.path.abspath(".")
    
    def clean_product_name(self, product_name):
        """商品名のクリーニング"""
        try:
            if not product_name or pd.isna(product_name):
                return ""
            
            clean_name = str(product_name).strip()
            clean_name = re.sub(r'\s+', ' ', clean_name).strip()
            return clean_name
            
        except Exception as e:
            print(f"商品名クリーニングエラー: {e}")
            return str(product_name) if product_name else ""
    
    def generate_taste_profile(self, tasting_note, whiskey_name):
        """
        テイスティングノートからtaste_profileを自動生成
        Claude APIを使用して6項目を1-5で採点
        """
        try:
            prompt = f"""以下のウィスキーのテイスティングノートを分析し、味覚プロファイルを6項目で採点してください。

ウィスキー名: {whiskey_name}
テイスティングノート: {tasting_note}

以下の6項目を1-5のスケールで採点し、JSON形式で回答してください：
- fruity (フルーティー): 果物の風味の強さ
- spicy (スパイシー): スパイスやペッパーの強さ
- body (ボディ): 重厚感・ボディの強さ
- smoky (スモーキー): ピート・煙の強さ
- sweetness (甘さ): 甘味の強さ
- complexity (複雑さ): 味の複雑性・層の豊富さ

採点基準:
1: 非常に弱い/ほとんどない
2: 弱い/少ない
3: 中程度/バランス
4: 強い/明確
5: 非常に強い/支配的

JSONフォーマット:
{{
    "taste_profile": {{
        "fruity": 数値,
        "spicy": 数値,
        "body": 数値,
        "smoky": 数値,
        "sweetness": 数値,
        "complexity": 数値
    }}
}}

必ずJSONのみで回答してください。"""
            
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            data = {
                'model': self.model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 800,
                'temperature': 0.2
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # JSON抽出
                json_match = re.search(r'\{[^{}]*"taste_profile"[^{}]*\{[^{}]*\}[^{}]*\}', content)
                if json_match:
                    try:
                        parsed_json = json.loads(json_match.group())
                        taste_profile = parsed_json.get('taste_profile', {})
                        
                        # 値の検証（1-5の範囲内）
                        required_keys = ['fruity', 'spicy', 'body', 'smoky', 'sweetness', 'complexity']
                        validated_profile = {}
                        
                        for key in required_keys:
                            value = taste_profile.get(key, 3)  # デフォルト3
                            validated_profile[key] = max(1, min(5, int(value)))
                        
                        self.stats['taste_profiles_generated'] += 1
                        print(f"✅ Taste Profile生成成功: {whiskey_name}")
                        return validated_profile
                        
                    except json.JSONDecodeError as e:
                        print(f"❌ JSON解析エラー: {e}")
                        return self.create_default_taste_profile()
                else:
                    print("❌ JSONが見つかりません")
                    return self.create_default_taste_profile()
            else:
                print(f"❌ API エラー: {response.status_code}")
                return self.create_default_taste_profile()
                
        except Exception as e:
            print(f"❌ Taste Profile生成エラー: {str(e)}")
            return self.create_default_taste_profile()
    
    def create_default_taste_profile(self):
        """デフォルトのtaste_profile"""
        return {
            'fruity': 3,
            'spicy': 3,
            'body': 3,
            'smoky': 3,
            'sweetness': 3,
            'complexity': 3
        }
    
    def search_whiskey_info(self, whiskey_name):
        """ウィスキー情報の検索"""
        try:
            search_query = f"{whiskey_name} whiskey ウィスキー テイスティング"
            encoded_query = quote(search_query, safe='', encoding='utf-8')
            search_url = f"https://www.google.com/search?q={encoded_query}&num=5"
            
            response = self.session.get(search_url, timeout=15)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # 検索結果取得
            search_results = []
            for result in soup.find_all('div', class_=['BNeawe', 'VuuXrf'])[:5]:
                try:
                    text = result.get_text().strip()
                    if text and len(text) > 15:
                        search_results.append(text)
                except:
                    continue
            
            return "\n".join(search_results) if search_results else f"{whiskey_name}の情報が見つかりませんでした"
            
        except Exception as e:
            print(f"❌ 検索エラー: {str(e)}")
            return f"{whiskey_name}の検索でエラーが発生しました"
    
    def analyze_with_llm(self, whiskey_name, search_info):
        """LLM分析"""
        try:
            prompt = f"""以下のウィスキーを分析し、JSON形式で情報を提供してください：

ウィスキー名: {whiskey_name}
検索情報: {search_info[:1500]}

以下のJSON形式で回答してください：
{{
    "classification": "ウィスキーの分類",
    "region": "生産地域",
    "sub_category": "詳細カテゴリ",
    "tasting_notes_english": "英語テイスティングノート (100-300文字)",
    "tasting_notes_japanese": "日本語テイスティングノート (100-300文字)",
    "confidence": "High/Medium/Low"
}}

classificationは以下から選択：
- Scotch Whisky (スコッチウィスキー)
- Irish Whiskey (アイリッシュウィスキー)  
- Japanese Whisky (ジャパニーズウィスキー)
- American Whiskey (アメリカンウィスキー)
- Other Whiskey (その他ウィスキー)

JSONのみで回答してください。"""
            
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json; charset=utf-8'
            }
            
            data = {
                'model': self.model,
                'messages': [{'role': 'user', 'content': prompt}],
                'max_tokens': 1200,
                'temperature': 0.3
            }
            
            response = requests.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=45
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']
                
                # JSON抽出
                json_matches = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', content)
                
                for json_str in json_matches:
                    try:
                        parsed_json = json.loads(json_str)
                        required_fields = ['classification', 'region', 'sub_category', 
                                         'tasting_notes_english', 'tasting_notes_japanese']
                        if all(field in parsed_json for field in required_fields):
                            print(f"✅ LLM分析成功: {whiskey_name}")
                            return parsed_json
                    except json.JSONDecodeError:
                        continue
                
                return self.create_fallback_result(whiskey_name, "JSON解析失敗")
            else:
                print(f"❌ LLM API エラー: {response.status_code}")
                return self.create_fallback_result(whiskey_name, f"API エラー: {response.status_code}")
                
        except Exception as e:
            print(f"❌ LLM分析エラー: {str(e)}")
            return self.create_fallback_result(whiskey_name, str(e))
    
    def create_fallback_result(self, whiskey_name, error_msg):
        """フォールバック結果"""
        return {
            "classification": "Other Whiskey",
            "region": "Unknown",
            "sub_category": "Unknown",
            "tasting_notes_english": f"Analysis failed for {whiskey_name}. Manual verification required.",
            "tasting_notes_japanese": f"{whiskey_name}の分析に失敗しました。手動での確認が必要です。",
            "confidence": "Low"
        }
    
    def process_whiskey(self, whiskey_name, existing_tasting_note=None):
        """ウィスキー処理のメイン関数"""
        try:
            self.stats['processed'] += 1
            
            clean_name = self.clean_product_name(whiskey_name)
            if not clean_name:
                self.stats['skipped'] += 1
                return None
            
            print(f"🍷 処理中: {whiskey_name}")
            
            # 情報検索
            search_info = self.search_whiskey_info(clean_name)
            time.sleep(2)  # レート制限対応
            
            # LLM分析
            analysis_result = self.analyze_with_llm(clean_name, search_info)
            time.sleep(2)  # レート制限対応
            
            # taste_profile生成
            tasting_note_for_profile = (existing_tasting_note or 
                                      analysis_result.get('tasting_notes_japanese', ''))
            taste_profile = self.generate_taste_profile(tasting_note_for_profile, clean_name)
            time.sleep(2)  # レート制限対応
            
            # 結果統合
            analysis_result['taste_profile'] = taste_profile
            analysis_result['original_name'] = whiskey_name
            
            self.stats['successful'] += 1
            print(f"✅ 処理完了: {whiskey_name}")
            return analysis_result
            
        except Exception as e:
            error_msg = f"{whiskey_name}の処理エラー: {str(e)}"
            print(f"❌ {error_msg}")
            self.stats['skipped'] += 1
            self.stats['errors'].append(error_msg)
            return None
    
    def get_statistics(self):
        return self.stats.copy()

class WhiskeyManagerGUI:
    """ウィスキー管理システムGUI"""
    
    def __init__(self, root):
        self.root = root
        self.root.title("🍷 ウィスキー分類・テイスティングノートシステム（拡張版）")
        self.root.geometry("1400x900")
        
        self.df = None
        self.file_path = None
        self.output_folder = os.path.abspath("output")
        self.analyzer = None
        self.analysis_results = []
        self.selected_column = None
        
        # エクスポート設定
        self.export_excel = tk.BooleanVar(value=True)
        self.export_json = tk.BooleanVar(value=True)
        
        self.create_widgets()
    
    def create_widgets(self):
        """GUI作成"""
        # メインフレーム
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # グリッド設定
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        
        # タイトル
        title_label = ttk.Label(main_frame, text="🍷 ウィスキー分類・テイスティングノートシステム（拡張版）", 
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, columnspan=3, pady=(0, 20))
        
        # ファイル読み込みセクション
        file_frame = ttk.LabelFrame(main_frame, text="📁 ファイル読み込み", padding="10")
        file_frame.grid(row=1, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        file_frame.columnconfigure(1, weight=1)
        
        ttk.Button(file_frame, text="Excelファイル選択", 
                  command=self.load_file).grid(row=0, column=0, padx=(0, 10))
        
        self.file_label = ttk.Label(file_frame, text="ファイルが選択されていません")
        self.file_label.grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # エクスポート設定セクション（新機能）
        export_frame = ttk.LabelFrame(main_frame, text="💾 エクスポート設定", padding="10")
        export_frame.grid(row=2, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Checkbutton(export_frame, text="📊 Excelファイルとして保存", 
                       variable=self.export_excel).grid(row=0, column=0, sticky=tk.W, padx=(0, 20))
        
        ttk.Checkbutton(export_frame, text="📄 JSONファイルとして保存（ウェブアプリ用）", 
                       variable=self.export_json).grid(row=0, column=1, sticky=tk.W)
        
        # データプレビューセクション
        preview_frame = ttk.LabelFrame(main_frame, text="📊 データプレビュー", padding="10")
        preview_frame.grid(row=3, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        preview_frame.columnconfigure(0, weight=1)
        preview_frame.rowconfigure(1, weight=1)
        
        # 列選択
        column_frame = ttk.Frame(preview_frame)
        column_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(column_frame, text="処理対象列:").grid(row=0, column=0, padx=(0, 10))
        
        self.column_combo = ttk.Combobox(column_frame, state="readonly", width=20)
        self.column_combo.grid(row=0, column=1, padx=(0, 10))
        self.column_combo.bind('<<ComboboxSelected>>', self.on_column_selected)
        
        self.column_info_label = ttk.Label(column_frame, text="")
        self.column_info_label.grid(row=0, column=2, padx=(10, 0))
        
        # データプレビューツリー
        tree_frame = ttk.Frame(preview_frame)
        tree_frame.grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        tree_frame.columnconfigure(0, weight=1)
        tree_frame.rowconfigure(0, weight=1)
        
        self.tree = ttk.Treeview(tree_frame, height=8)
        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # スクロールバー
        v_scrollbar = ttk.Scrollbar(tree_frame, orient="vertical", command=self.tree.yview)
        v_scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.tree.configure(yscrollcommand=v_scrollbar.set)
        
        h_scrollbar = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.tree.xview)
        h_scrollbar.grid(row=1, column=0, sticky=(tk.W, tk.E))
        self.tree.configure(xscrollcommand=h_scrollbar.set)
        
        # 処理セクション
        process_frame = ttk.LabelFrame(main_frame, text="⚙️ データ処理", padding="10")
        process_frame.grid(row=4, column=0, columnspan=3, sticky=(tk.W, tk.E), pady=(0, 10))
        process_frame.columnconfigure(1, weight=1)
        
        self.process_button = ttk.Button(process_frame, text="🚀 AI分析開始（taste_profile自動生成）", 
                                        command=self.start_processing, state="disabled")
        self.process_button.grid(row=0, column=0, padx=(0, 10))
        
        self.progress = ttk.Progressbar(process_frame, mode='determinate')
        self.progress.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        self.status_label = ttk.Label(process_frame, text="準備完了")
        self.status_label.grid(row=0, column=2)
        
        # 結果セクション
        results_frame = ttk.LabelFrame(main_frame, text="📋 処理結果", padding="10")
        results_frame.grid(row=5, column=0, columnspan=3, sticky=(tk.W, tk.E, tk.N, tk.S))
        results_frame.columnconfigure(0, weight=1)
        results_frame.rowconfigure(0, weight=1)
        
        self.results_text = scrolledtext.ScrolledText(results_frame, height=8, state="disabled")
        self.results_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 保存ボタン
        save_frame = ttk.Frame(results_frame)
        save_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        
        self.save_button = ttk.Button(save_frame, text="💾 結果を保存", 
                                     command=self.save_results, state="disabled")
        self.save_button.grid(row=0, column=0, padx=(0, 10))
        
        # グリッドの重み設定
        main_frame.rowconfigure(3, weight=1)
        main_frame.rowconfigure(5, weight=1)
    
    def load_file(self):
        """ファイル読み込み"""
        file_path = filedialog.askopenfilename(
            title="Excelファイルを選択",
            filetypes=[("Excel files", "*.xlsx *.xls"), ("All files", "*.*")]
        )
        
        if not file_path:
            return
        
        try:
            self.df = pd.read_excel(file_path)
            self.file_path = file_path
            
            filename = os.path.basename(file_path)
            self.file_label.config(text=f"✅ {filename} ({len(self.df)} 行, {len(self.df.columns)} 列)")
            
            self.setup_column_selection()
            self.preview_data()
            self.process_button.config(state="normal")
            
            print(f"✅ ファイル読み込み完了: {filename}")
            
        except Exception as e:
            messagebox.showerror("エラー", f"ファイル読み込みエラー: {str(e)}")
            print(f"❌ ファイル読み込みエラー: {str(e)}")
    
    def setup_column_selection(self):
        """列選択設定"""
        if self.df is not None:
            columns = list(self.df.columns)
            self.column_combo['values'] = columns
            
            if len(columns) > 1:
                self.column_combo.set(columns[1])  # B列を自動選択
                self.selected_column = columns[1]
            elif len(columns) > 0:
                self.column_combo.set(columns[0])
                self.selected_column = columns[0]
            
            self.update_column_info()
    
    def on_column_selected(self, event=None):
        """列選択イベント"""
        try:
            selected = self.column_combo.get()
            if selected and selected in self.df.columns:
                self.selected_column = selected
                self.update_column_info()
                print(f"✅ 列選択: {selected}")
        except Exception as e:
            messagebox.showerror("エラー", f"列選択エラー: {str(e)}")
    
    def update_column_info(self):
        """列情報更新"""
        if self.selected_column and self.df is not None:
            column_data = self.df[self.selected_column]
            non_null_count = column_data.notna().sum()
            self.column_info_label.config(
                text=f"有効データ: {non_null_count}/{len(column_data)} 件"
            )
    
    def preview_data(self):
        """データプレビュー"""
        if self.df is None:
            return
        
        # 既存データクリア
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        # 列設定
        columns = list(self.df.columns)
        self.tree['columns'] = columns
        self.tree['show'] = 'headings'
        
        # 列ヘッダーと幅設定
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=120, minwidth=80)
        
        # データ挿入（最初の20行）
        for idx, row in self.df.head(20).iterrows():
            values = [str(val) if pd.notna(val) else "" for val in row]
            self.tree.insert('', 'end', values=values)
    
    def start_processing(self):
        """データ処理開始"""
        if not self.selected_column or self.df is None:
            messagebox.showwarning("警告", "処理対象の列を選択してください")
            return
        
        if not (self.export_excel.get() or self.export_json.get()):
            messagebox.showwarning("警告", "少なくとも一つのエクスポート形式を選択してください")
            return
        
        # UI無効化
        self.process_button.config(state="disabled")
        self.save_button.config(state="disabled")
        
        # 処理スレッド開始
        thread = threading.Thread(target=self.process_data)
        thread.daemon = True
        thread.start()
    
    def process_data(self):
        """データ処理"""
        try:
            self.analyzer = WhiskeyAnalyzerEnhanced(self.output_folder)
            
            product_names = self.df[self.selected_column].dropna().tolist()
            total_items = len(product_names)
            
            if total_items == 0:
                self.update_status("❌ 処理対象データがありません")
                return
            
            self.update_status(f"🚀 {total_items} 件のAI分析を開始...")
            self.analysis_results = []
            
            # 各商品を処理
            for i, product_name in enumerate(product_names):
                try:
                    self.update_status(f"AI分析中: {product_name} ({i+1}/{total_items})")
                    self.update_progress((i / total_items) * 100)
                    
                    # 既存のテイスティングノートを取得（もしあれば）
                    existing_note = None
                    if 'tasting_note' in self.df.columns:
                        row_data = self.df[self.df[self.selected_column] == product_name]
                        if not row_data.empty:
                            existing_note = row_data.iloc[0]['tasting_note']
                    
                    # AI分析実行
                    result = self.analyzer.process_whiskey(product_name, existing_note)
                    
                    if result:
                        result['row_index'] = self.df[self.df[self.selected_column] == product_name].index[0]
                        self.analysis_results.append(result)
                        
                        # 結果表示更新
                        taste_info = result.get('taste_profile', {})
                        taste_summary = f"F:{taste_info.get('fruity', 0)} S:{taste_info.get('smoky', 0)} B:{taste_info.get('body', 0)}"
                        self.update_results_display(
                            f"✅ {product_name}: {result.get('classification', 'Unknown')} ({taste_summary})")
                    else:
                        self.update_results_display(f"❌ {product_name}: 処理失敗")
                    
                except Exception as e:
                    error_msg = f"❌ {product_name}: {str(e)}"
                    self.update_results_display(error_msg)
                    print(error_msg)
            
            # 処理完了
            self.update_progress(100)
            stats = self.analyzer.get_statistics()
            success_msg = f"✅ AI分析完了: {len(self.analysis_results)}/{total_items} 件成功"
            success_msg += f" (Taste Profile: {stats['taste_profiles_generated']}件生成)"
            self.update_status(success_msg)
            
            # 保存ボタン有効化
            self.root.after(0, lambda: self.save_button.config(state="normal"))
            
        except Exception as e:
            error_msg = f"❌ 処理エラー: {str(e)}"
            self.update_status(error_msg)
            print(error_msg)
        finally:
            # 処理ボタン再有効化
            self.root.after(0, lambda: self.process_button.config(state="normal"))
    
    def update_status(self, message):
        """ステータス更新（スレッドセーフ）"""
        self.root.after(0, lambda: self.status_label.config(text=message))
    
    def update_progress(self, value):
        """プログレス更新（スレッドセーフ）"""
        self.root.after(0, lambda: self.progress.config(value=value))
    
    def update_results_display(self, message):
        """結果表示更新（スレッドセーフ）"""
        def update():
            self.results_text.config(state="normal")
            self.results_text.insert(tk.END, message + "\n")
            self.results_text.see(tk.END)
            self.results_text.config(state="disabled")
        
        self.root.after(0, update)
    
    def save_results(self):
        """結果保存"""
        if not self.analysis_results:
            messagebox.showwarning("警告", "保存する結果がありません")
            return
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            base_filename = f"whiskey_analysis_{timestamp}"
            
            saved_files = []
            
            # Excel保存
            if self.export_excel.get():
                excel_path = filedialog.asksaveasfilename(
                    title="Excel分析結果を保存",
                    initialdir=self.output_folder,
                    initialfile=f"{base_filename}.xlsx",
                    defaultextension=".xlsx",
                    filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
                )
                
                if excel_path:
                    self.save_to_excel(excel_path)
                    saved_files.append(('Excel', excel_path))
            
            # JSON保存
            if self.export_json.get():
                json_path = filedialog.asksaveasfilename(
                    title="JSON分析結果を保存（ウェブアプリ用）",
                    initialdir=self.output_folder,
                    initialfile=f"{base_filename}.json",
                    defaultextension=".json",
                    filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
                )
                
                if json_path:
                    self.save_to_json(json_path)
                    saved_files.append(('JSON', json_path))
            
            if saved_files:
                file_list = "\n".join([f"- {fmt}: {path}" for fmt, path in saved_files])
                success_msg = f"✅ 以下のファイルに保存しました:\n{file_list}\n\n"
                success_msg += f"📊 処理統計:\n"
                success_msg += f"- 総分析数: {len(self.analysis_results)}\n"
                
                if self.analyzer:
                    stats = self.analyzer.get_statistics()
                    success_msg += f"- Taste Profile生成: {stats['taste_profiles_generated']}件\n"
                
                messagebox.showinfo("保存完了", success_msg)
                print(f"✅ 結果保存完了: {len(saved_files)}ファイル")
            
        except Exception as e:
            error_msg = f"保存エラー: {str(e)}"
            messagebox.showerror("エラー", error_msg)
            print(f"❌ {error_msg}")
    
    def save_to_excel(self, filepath):
        """Excel形式で保存"""
        enhanced_df = self.df.copy()
        
        # 分析結果列を追加
        analysis_columns = {
            '分類': 'classification',
            '地域': 'region', 
            'サブカテゴリ': 'sub_category',
            'テイスティングノート_英語': 'tasting_notes_english',
            'テイスティングノート_日本語': 'tasting_notes_japanese',
            '信頼度': 'confidence',
            # taste_profile項目
            'Taste_Fruity': ('taste_profile', 'fruity'),
            'Taste_Spicy': ('taste_profile', 'spicy'),
            'Taste_Body': ('taste_profile', 'body'),
            'Taste_Smoky': ('taste_profile', 'smoky'),
            'Taste_Sweetness': ('taste_profile', 'sweetness'),
            'Taste_Complexity': ('taste_profile', 'complexity'),
        }
        
        # 新しい列を初期化
        for col_name in analysis_columns.keys():
            enhanced_df[col_name] = ""
        
        # 分析結果を挿入
        for result in self.analysis_results:
            row_idx = result.get('row_index')
            if row_idx is not None and row_idx in enhanced_df.index:
                for col_name, result_key in analysis_columns.items():
                    if isinstance(result_key, tuple):  # taste_profile
                        profile_key, sub_key = result_key
                        value = result.get(profile_key, {}).get(sub_key, "")
                    else:
                        value = result.get(result_key, "")
                    enhanced_df.at[row_idx, col_name] = str(value) if value else ""
        
        # Excel保存
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            enhanced_df.to_excel(writer, index=False, sheet_name='AI分析結果')
            
            # 列幅自動調整
            worksheet = writer.sheets['AI分析結果']
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(str(cell.value))
                    except:
                        pass
                adjusted_width = min(max_length + 2, 50)
                worksheet.column_dimensions[column_letter].width = adjusted_width
    
    def save_to_json(self, filepath):
        """JSON形式で保存（ウェブアプリ用）"""
        whiskey_data = {
            "whiskies": [],
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "total_count": len(self.analysis_results),
                "includes_taste_profile": True,
                "taste_profile_attributes": ["fruity", "spicy", "body", "smoky", "sweetness", "complexity"]
            }
        }
        
        for i, result in enumerate(self.analysis_results):
            whiskey_entry = {
                "id": str(i + 1),
                "name": result.get('original_name', ''),
                "price": "¥未設定",  # 価格情報があれば使用
                "amount": "¥未設定",
                "category": "Whiskey",
                "region": result.get('region', 'Unknown'),
                "subcategory": result.get('classification', 'Unknown'),
                "tastingNote_ja": result.get('tasting_notes_japanese', ''),
                "taste_profile": result.get('taste_profile', self.analyzer.create_default_taste_profile())
            }
            whiskey_data["whiskies"].append(whiskey_entry)
        
        # JSON保存
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(whiskey_data, f, ensure_ascii=False, indent=2)

def create_sample_data():
    """サンプルデータ作成"""
    sample_data = {
        'ID': [1, 2, 3, 4, 5],
        'ウィスキー名': [
            'マッカラン 12年',
            'スプリングバンク 21年',
            'ブナハーブン 12年',
            'アバフェルディ 18年',
            '響 ハーモニー'
        ],
        '価格': [8000, 45000, 12000, 15000, 12000],
        '容量': ['700ml'] * 5,
        '備考': ['スコッチウィスキー', '限定品', 'アイラモルト', 'ヴィンテージ', 'ジャパニーズウィスキー']
    }
    
    df = pd.DataFrame(sample_data)
    sample_path = "sample_whiskey_data.xlsx"
    df.to_excel(sample_path, index=False)
    print(f"✅ サンプルデータ作成: {sample_path}")
    return sample_path

def main():
    """メイン関数"""
    print("🍷 ウィスキー分類・テイスティングノートシステム（拡張版）を起動中...")
    print("新機能: taste_profile自動採点、JSON/Excelエクスポート")
    
    root = tk.Tk()
    app = WhiskeyManagerGUI(root)
    
    # サンプルデータ作成ボタン（デバッグ用）
    def create_sample():
        try:
            sample_path = create_sample_data()
            messagebox.showinfo("サンプルデータ作成", f"サンプルデータを作成しました:\n{sample_path}")
        except Exception as e:
            messagebox.showerror("エラー", f"サンプルデータ作成失敗: {e}")
    
    # メニューバー追加
    menubar = tk.Menu(root)
    root.config(menu=menubar)
    
    file_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="ファイル", menu=file_menu)
    file_menu.add_command(label="サンプルデータ作成", command=create_sample)
    file_menu.add_separator()
    file_menu.add_command(label="終了", command=root.quit)
    
    help_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="ヘルプ", menu=help_menu)
    help_menu.add_command(label="使用方法", 
                         command=lambda: messagebox.showinfo("使用方法", 
                                                            "1. Excelファイルを選択\n" +
                                                            "2. 処理対象列を選択\n" +
                                                            "3. エクスポート形式を選択\n" +
                                                            "4. AI分析開始ボタンをクリック\n" +
                                                            "5. 結果を保存"))
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("\n🛑 プログラムを終了します...")
    except Exception as e:
        print(f"❌ 予期しないエラー: {e}")

if __name__ == "__main__":
    main()