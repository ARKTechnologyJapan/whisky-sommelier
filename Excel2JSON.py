# -*- coding: utf-8 -*-
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import pandas as pd
import json
import os
import re
from datetime import datetime

class ExcelToJSONConverter:
    """
    エクセルファイルをウィスキーウェブアプリ用JSON形式に変換するアプリ
    """
    
    def __init__(self, root):
        self.root = root
        self.root.title("📊 Excel → JSON変換ツール（ウィスキーウェブアプリ用）")
        self.root.geometry("1200x800")
        
        self.df = None
        self.file_path = None
        self.output_folder = os.path.abspath("output")
        self.column_mappings = {}
        
        # 必須カラム定義
        self.required_columns = {
            'id': 'ID',
            'name': 'ウィスキー名',
            'price': '価格',
            'amount': '容量価格',
            'category': 'カテゴリ',
            'region': '地域',
            'subcategory': 'サブカテゴリ',
            'tastingNote_ja': 'テイスティングノート',
            'taste_profile': 'テイストプロファイル'
        }
        
        # デフォルト値
        self.default_values = {
            'category': 'Whiskey',
            'amount': '¥未設定',
            'region': 'Unknown',
            'subcategory': 'Single Malt Whisky'
        }
        
        self.create_widgets()
        self.ensure_output_folder()
    
    def ensure_output_folder(self):
        """出力フォルダの作成"""
        try:
            os.makedirs(self.output_folder, exist_ok=True)
            print(f"✅ 出力フォルダ準備完了: {self.output_folder}")
        except Exception as e:
            print(f"❌ フォルダ作成失敗: {e}")
            self.output_folder = os.path.abspath(".")
    
    def create_widgets(self):
        """GUI作成"""
        # メインフレーム
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # グリッド設定
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        
        # タイトル
        title_label = ttk.Label(main_frame, text="📊 Excel → JSON変換ツール（ウィスキーウェブアプリ用）", 
                               font=('Arial', 16, 'bold'))
        title_label.grid(row=0, column=0, pady=(0, 20))
        
        # ファイル読み込みセクション
        file_frame = ttk.LabelFrame(main_frame, text="📁 ファイル読み込み", padding="10")
        file_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        file_frame.columnconfigure(1, weight=1)
        
        ttk.Button(file_frame, text="Excelファイル選択", 
                  command=self.load_file).grid(row=0, column=0, padx=(0, 10))
        
        self.file_label = ttk.Label(file_frame, text="ファイルが選択されていません")
        self.file_label.grid(row=0, column=1, sticky=(tk.W, tk.E))
        
        # 列マッピングセクション
        mapping_frame = ttk.LabelFrame(main_frame, text="🔗 列マッピング設定", padding="10")
        mapping_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        mapping_frame.columnconfigure(1, weight=1)
        
        # 列マッピング説明
        ttk.Label(mapping_frame, text="Excelの列をJSON項目に対応させてください：", 
                 font=('Arial', 10)).grid(row=0, column=0, columnspan=2, sticky=tk.W, pady=(0, 10))
        
        # 列マッピング用のフレーム
        self.mapping_frame = ttk.Frame(mapping_frame)
        self.mapping_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E))
        self.mapping_frame.columnconfigure(1, weight=1)
        
        # データプレビューセクション
        preview_frame = ttk.LabelFrame(main_frame, text="📊 データプレビュー", padding="10")
        preview_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        preview_frame.columnconfigure(0, weight=1)
        preview_frame.rowconfigure(0, weight=1)
        
        # データプレビューツリー
        tree_frame = ttk.Frame(preview_frame)
        tree_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
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
        
        # 変換セクション
        convert_frame = ttk.LabelFrame(main_frame, text="⚙️ JSON変換", padding="10")
        convert_frame.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        convert_frame.columnconfigure(1, weight=1)
        
        self.convert_button = ttk.Button(convert_frame, text="🚀 JSON変換実行", 
                                        command=self.convert_to_json, state="disabled")
        self.convert_button.grid(row=0, column=0, padx=(0, 10))
        
        self.progress = ttk.Progressbar(convert_frame, mode='determinate')
        self.progress.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=(0, 10))
        
        self.status_label = ttk.Label(convert_frame, text="ファイルを選択してください")
        self.status_label.grid(row=0, column=2)
        
        # 結果セクション
        results_frame = ttk.LabelFrame(main_frame, text="📋 変換結果", padding="10")
        results_frame.grid(row=5, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        results_frame.columnconfigure(0, weight=1)
        results_frame.rowconfigure(0, weight=1)
        
        self.results_text = scrolledtext.ScrolledText(results_frame, height=6, state="disabled")
        self.results_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))
        
        # 保存ボタン
        save_frame = ttk.Frame(results_frame)
        save_frame.grid(row=1, column=0, sticky=(tk.W, tk.E))
        
        self.save_button = ttk.Button(save_frame, text="💾 JSONファイル保存", 
                                     command=self.save_json, state="disabled")
        self.save_button.grid(row=0, column=0, padx=(0, 10))
        
        self.open_folder_button = ttk.Button(save_frame, text="📁 出力フォルダを開く", 
                                           command=self.open_output_folder)
        self.open_folder_button.grid(row=0, column=1)
        
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
            
            self.setup_column_mappings()
            self.preview_data()
            self.convert_button.config(state="normal")
            self.status_label.config(text="列マッピングを確認してください")
            
            print(f"✅ ファイル読み込み完了: {filename}")
            
        except Exception as e:
            messagebox.showerror("エラー", f"ファイル読み込みエラー: {str(e)}")
            print(f"❌ ファイル読み込みエラー: {str(e)}")
    
    def setup_column_mappings(self):
        """列マッピングの設定"""
        if self.df is None:
            return
        
        # 既存のマッピングUIをクリア
        for widget in self.mapping_frame.winfo_children():
            widget.destroy()
        
        excel_columns = [''] + list(self.df.columns)  # 空の選択肢を最初に追加
        self.column_combos = {}
        
        row = 0
        for json_key, display_name in self.required_columns.items():
            # ラベル
            ttk.Label(self.mapping_frame, text=f"{display_name}:").grid(
                row=row, column=0, sticky=tk.W, padx=(0, 10), pady=2)
            
            # コンボボックス
            combo = ttk.Combobox(self.mapping_frame, values=excel_columns, 
                               state="readonly", width=25)
            combo.grid(row=row, column=1, sticky=(tk.W, tk.E), padx=(0, 10), pady=2)
            
            # 自動マッピング試行
            auto_mapped = self.auto_map_column(json_key, display_name, excel_columns)
            if auto_mapped:
                combo.set(auto_mapped)
            
            self.column_combos[json_key] = combo
            
            # 必須マークまたはデフォルト値の表示
            if json_key in self.default_values:
                ttk.Label(self.mapping_frame, text=f"(デフォルト: {self.default_values[json_key]})", 
                         foreground="gray").grid(row=row, column=2, sticky=tk.W, padx=(10, 0), pady=2)
            else:
                ttk.Label(self.mapping_frame, text="*必須", 
                         foreground="red").grid(row=row, column=2, sticky=tk.W, padx=(10, 0), pady=2)
            
            row += 1
        
        # taste_profileの特別な説明
        ttk.Label(self.mapping_frame, text="※ テイストプロファイルは「fruity,spicy,body,smoky,sweetness,complexity」の順で数値をカンマ区切りで入力", 
                 font=('Arial', 8), foreground="blue").grid(row=row, column=0, columnspan=3, sticky=tk.W, pady=(5, 0))
        
        self.mapping_frame.columnconfigure(1, weight=1)
    
    def auto_map_column(self, json_key, display_name, excel_columns):
        """自動列マッピング"""
        # キーワードマッピング
        mapping_keywords = {
            'id': ['id', 'ID', '番号', 'No', 'no'],
            'name': ['name', 'Name', 'ウィスキー名', 'whiskey', 'whisky', '商品名', '製品名'],
            'price': ['price', 'Price', '価格', '値段', '単価'],
            'amount': ['amount', 'Amount', '容量価格', '容量', 'volume'],
            'category': ['category', 'Category', 'カテゴリ', '分類', 'type'],
            'region': ['region', 'Region', '地域', '産地', 'country', '国'],
            'subcategory': ['subcategory', 'SubCategory', 'サブカテゴリ', '詳細分類'],
            'tastingNote_ja': ['tasting', 'note', 'テイスティング', 'ノート', '味', '香り'],
            'taste_profile': ['taste_profile', 'profile', 'プロファイル', '味覚', 'テイスト']
        }
        
        keywords = mapping_keywords.get(json_key, [])
        
        for col in excel_columns[1:]:  # 最初の空文字列をスキップ
            for keyword in keywords:
                if keyword.lower() in col.lower():
                    return col
        
        return None
    
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
        
        # データ挿入（最初の10行）
        for idx, row in self.df.head(10).iterrows():
            values = [str(val) if pd.notna(val) else "" for val in row]
            self.tree.insert('', 'end', values=values)
    
    def convert_to_json(self):
        """JSON変換処理"""
        if self.df is None:
            messagebox.showwarning("警告", "Excelファイルが読み込まれていません")
            return
        
        # 必須列のチェック
        required_mappings = ['id', 'name']
        missing_required = []
        
        for key in required_mappings:
            combo = self.column_combos.get(key)
            if not combo or not combo.get():
                missing_required.append(self.required_columns[key])
        
        if missing_required:
            messagebox.showerror("エラー", f"以下の必須項目が設定されていません:\n{', '.join(missing_required)}")
            return
        
        try:
            self.status_label.config(text="JSON変換中...")
            self.progress.config(value=0)
            
            # 列マッピング取得
            mappings = {}
            for key, combo in self.column_combos.items():
                if combo.get():
                    mappings[key] = combo.get()
            
            # JSON変換
            whiskey_data = {
                "whiskies": [],
                "metadata": {
                    "generated_at": datetime.now().isoformat(),
                    "total_count": len(self.df),
                    "includes_taste_profile": 'taste_profile' in mappings,
                    "source_file": os.path.basename(self.file_path) if self.file_path else "unknown",
                    "conversion_tool": "Excel to JSON Converter v1.0"
                }
            }
            
            total_rows = len(self.df)
            converted_count = 0
            
            for idx, row in self.df.iterrows():
                try:
                    whiskey_entry = self.create_whiskey_entry(row, mappings, idx + 1)
                    if whiskey_entry:
                        whiskey_data["whiskies"].append(whiskey_entry)
                        converted_count += 1
                    
                    # プログレス更新
                    progress = ((idx + 1) / total_rows) * 100
                    self.progress.config(value=progress)
                    
                except Exception as e:
                    self.update_results_display(f"❌ 行 {idx + 1} 変換エラー: {str(e)}")
                    continue
            
            # 結果保存
            self.converted_data = whiskey_data
            self.progress.config(value=100)
            self.status_label.config(text=f"✅ 変換完了: {converted_count}/{total_rows} 件")
            
            # 結果表示
            success_msg = f"✅ JSON変換完了\n"
            success_msg += f"- 総行数: {total_rows}\n"
            success_msg += f"- 変換成功: {converted_count}\n"
            success_msg += f"- エラー: {total_rows - converted_count}\n"
            success_msg += f"- taste_profile含む: {'はい' if whiskey_data['metadata']['includes_taste_profile'] else 'いいえ'}"
            
            self.update_results_display(success_msg)
            self.save_button.config(state="normal")
            
        except Exception as e:
            error_msg = f"❌ 変換エラー: {str(e)}"
            self.status_label.config(text=error_msg)
            self.update_results_display(error_msg)
            messagebox.showerror("エラー", error_msg)
    
    def create_whiskey_entry(self, row, mappings, entry_id):
        """個別のウィスキーエントリ作成"""
        entry = {
            "id": str(entry_id),
            "name": "",
            "price": "¥未設定",
            "amount": "¥未設定",
            "category": "Whiskey",
            "region": "Unknown",
            "subcategory": "Single Malt Whisky",
            "tastingNote_ja": "",
            "taste_profile": {
                "fruity": 3,
                "spicy": 3,
                "body": 3,
                "smoky": 3,
                "sweetness": 3,
                "complexity": 3
            }
        }
        
        # マッピングに基づいてデータを設定
        for json_key, excel_col in mappings.items():
            if excel_col in row.index:
                value = row[excel_col]
                
                # 空の値の処理
                if pd.isna(value) or value == "":
                    if json_key in self.default_values:
                        entry[json_key] = self.default_values[json_key]
                    continue
                
                # 特別な処理が必要な項目
                if json_key == 'id':
                    entry[json_key] = str(value)
                elif json_key == 'price':
                    entry[json_key] = self.format_price(value)
                elif json_key == 'amount':
                    entry[json_key] = self.format_price(value)
                elif json_key == 'taste_profile':
                    entry[json_key] = self.parse_taste_profile(value)
                else:
                    entry[json_key] = str(value)
        
        # 必須フィールドのチェック
        if not entry['name']:
            return None
        
        return entry
    
    def format_price(self, value):
        """価格フォーマット"""
        try:
            if isinstance(value, (int, float)):
                return f"¥{int(value):,}"
            elif isinstance(value, str):
                # 数値のみ抽出
                numbers = re.findall(r'\d+', value)
                if numbers:
                    return f"¥{int(numbers[0]):,}"
            return f"¥{value}"
        except:
            return str(value)
    
    def parse_taste_profile(self, value):
        """テイストプロファイル解析"""
        default_profile = {
            "fruity": 3,
            "spicy": 3,
            "body": 3,
            "smoky": 3,
            "sweetness": 3,
            "complexity": 3
        }
        
        try:
            if isinstance(value, str):
                # カンマ区切りの数値を解析
                values = [int(x.strip()) for x in value.split(',')]
                if len(values) == 6:
                    keys = ["fruity", "spicy", "body", "smoky", "sweetness", "complexity"]
                    profile = {}
                    for i, key in enumerate(keys):
                        profile[key] = max(1, min(5, values[i]))  # 1-5の範囲に制限
                    return profile
            
            return default_profile
        except:
            return default_profile
    
    def update_results_display(self, message):
        """結果表示更新"""
        self.results_text.config(state="normal")
        self.results_text.insert(tk.END, message + "\n")
        self.results_text.see(tk.END)
        self.results_text.config(state="disabled")
    
    def save_json(self):
        """JSON保存"""
        if not hasattr(self, 'converted_data'):
            messagebox.showwarning("警告", "変換されたデータがありません")
            return
        
        try:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            default_filename = f"whiskey_data_{timestamp}.json"
            
            json_path = filedialog.asksaveasfilename(
                title="JSONファイルを保存",
                initialdir=self.output_folder,
                initialfile=default_filename,
                defaultextension=".json",
                filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
            )
            
            if json_path:
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(self.converted_data, f, ensure_ascii=False, indent=2)
                
                # 保存成功メッセージ
                success_msg = f"✅ JSONファイル保存完了!\n"
                success_msg += f"📁 保存先: {json_path}\n"
                success_msg += f"📊 データ数: {len(self.converted_data['whiskies'])} 件\n"
                success_msg += f"🔗 ウェブアプリに配置してご利用ください"
                
                messagebox.showinfo("保存完了", success_msg)
                self.update_results_display(success_msg)
                
                print(f"✅ JSON保存完了: {json_path}")
                
        except Exception as e:
            error_msg = f"❌ 保存エラー: {str(e)}"
            messagebox.showerror("エラー", error_msg)
            self.update_results_display(error_msg)
    
    def open_output_folder(self):
        """出力フォルダを開く"""
        try:
            if os.path.exists(self.output_folder):
                import subprocess
                import sys
                
                if sys.platform.startswith('win'):
                    os.startfile(self.output_folder)
                elif sys.platform.startswith('darwin'):  # macOS
                    subprocess.run(['open', self.output_folder])
                else:  # Linux
                    subprocess.run(['xdg-open', self.output_folder])
            else:
                messagebox.showwarning("警告", "出力フォルダが存在しません")
        except Exception as e:
            messagebox.showerror("エラー", f"フォルダを開けませんでした: {str(e)}")

def create_sample_excel():
    """サンプルエクセルファイル作成"""
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
        '地域': ['スコットランド', 'スコットランド', 'スコットランド', 'スコットランド', '日本'],
        'サブカテゴリ': ['Single Malt Scotch Whisky', 'Single Malt Scotch Whisky', 
                      'Single Malt Scotch Whisky', 'Single Malt Scotch Whisky', 
                      'Japanese Whisky'],
        'テイスティングノート': [
            'リッチでフルーティーな味わい',
            '複雑でスモーキーな香り',
            '塩気とピートの絶妙なバランス',
            'ヴィンテージの深い味わい',
            '日本の四季を感じる調和'
        ],
        'テイストプロファイル': [
            '4,2,3,1,4,4',  # fruity,spicy,body,smoky,sweetness,complexity
            '2,4,4,5,2,5',
            '3,3,3,4,3,4',
            '3,3,4,2,3,5',
            '3,2,3,1,3,4'
        ]
    }
    
    df = pd.DataFrame(sample_data)
    sample_path = "sample_whiskey_for_json.xlsx"
    df.to_excel(sample_path, index=False)
    return sample_path

def main():
    """メイン関数"""
    print("📊 Excel → JSON変換ツール（ウィスキーウェブアプリ用）を起動中...")
    
    root = tk.Tk()
    app = ExcelToJSONConverter(root)
    
    # メニューバー追加
    menubar = tk.Menu(root)
    root.config(menu=menubar)
    
    file_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="ファイル", menu=file_menu)
    file_menu.add_command(label="サンプルExcel作成", 
                         command=lambda: create_sample_and_notify())
    file_menu.add_separator()
    file_menu.add_command(label="終了", command=root.quit)
    
    help_menu = tk.Menu(menubar, tearoff=0)
    menubar.add_cascade(label="ヘルプ", menu=help_menu)
    help_menu.add_command(label="使用方法", 
                         command=lambda: messagebox.showinfo("使用方法", 
                                                            "1. Excelファイルを選択\n" +
                                                            "2. 列マッピングを設定\n" +
                                                            "3. JSON変換実行\n" +
                                                            "4. JSONファイルを保存\n" +
                                                            "5. ウェブアプリに配置して使用"))
    
    def create_sample_and_notify():
        try:
            sample_path = create_sample_excel()
            messagebox.showinfo("サンプル作成", f"サンプルExcelファイルを作成しました:\n{sample_path}")
        except Exception as e:
            messagebox.showerror("エラー", f"サンプル作成失敗: {e}")
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("\n🛑 プログラムを終了します...")
    except Exception as e:
        print(f"❌ 予期しないエラー: {e}")

if __name__ == "__main__":
    main()