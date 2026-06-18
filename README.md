# Mailwise 統合送信用リスト作成アプリ

複数のCSVリストをアップロードし、Mailwiseでメール配信するための「統合送信用リスト」を作成するWebアプリです。元のGoogle Apps Script（スプレッドシート前提）の**業務ロジックだけ**を、Next.js + TypeScript + SQLite で再設計しています。SpreadsheetApp・シート作成・セル色付け・UIアラート等のGAS固有処理は含みません。

## 技術構成

- **Next.js (App Router) + TypeScript + Node.js**
- **DB: libSQL（SQLite互換）**
  - ローカル開発: `data/mailwise.db`（SQLiteファイル）を自動生成
  - 本番(Vercel): **Turso**（環境変数 `TURSO_DATABASE_URL` があれば自動でそちらに接続）
- CSVパース: `papaparse` / ZIP: `jszip`
- 業務ロジックは `src/lib/` に純粋関数として集約

## セットアップ（ローカル）

```bash
npm install
cp .env.example .env.local   # 必要に応じて編集
npm run dev      # 開発サーバ（http://localhost:3000）
npm run build && npm start   # 本番ビルド & 起動
npm test         # ロジック/DBのテスト
```

### 環境変数

- `APP_BASE_URL` … 配信停止URLのドメイン。例 `https://mailwise.example.vercel.app`。未設定時は `http://localhost:3000`。
- `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` … 本番DB（Turso）の接続情報。未設定ならローカルのSQLiteファイルを使用。
- `MAILWISE_DB_PATH` … ローカルSQLiteの保存先（テスト用）。

## デプロイ（Vercel + Turso）

Vercelはサーバーレス（実行ごとにファイルが消える）ため、DBは外部のTurso（libSQL）を使います。

1. **Tursoでデータベースを作成**（[turso.tech](https://turso.tech) でサインアップ → 無料枠あり）
   ```bash
   # Turso CLI の例
   turso db create mailwise
   turso db show mailwise --url          # → TURSO_DATABASE_URL（libsql://...）
   turso db tokens create mailwise       # → TURSO_AUTH_TOKEN
   ```
   ※テーブルはアプリ起動時に自動作成されます（手動マイグレーション不要）。
2. **GitHubリポジトリをVercelにインポート**（このリポジトリを連携）。
3. **Vercelの環境変数を設定**（Project → Settings → Environment Variables）
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `APP_BASE_URL`（**任意**。未設定でもVercel本番ドメインを自動使用します。独自ドメインを使う場合のみ設定）
4. **Deploy**。発行された `https://～.vercel.app` が、このWebアプリのURLです。
   - 配信停止URLは `https://～.vercel.app/unsubscribe?id=配信停止ID` の形で出力CSVに入ります。

> 補足: 配信停止URLのドメインは `APP_BASE_URL` → Vercel本番ドメイン（自動）→ localhost の順で決まります。
> 独自ドメインをVercelに割り当てた場合は、その独自ドメインを `APP_BASE_URL` に設定してください。

## 画面

| パス | 内容 |
| --- | --- |
| `/` | CSVアップロード（複数・種別選択・順序入替）→ 処理結果＋ダウンロード |
| `/ng` | 配信NGリスト管理（一覧・検索・手動追加・CSVインポート・削除） |
| `/fixed-ng` | 固定NGリスト管理（一覧・追加・削除） |
| `/unsubscribe?id=...` | 配信停止完了ページ（受付／済み／失敗） |

## データベース設計

- `ng_list`（配信NG）: email(UNIQUE), address_name, unsubscribe_id, stopped_at, route, source, clinic
- `fixed_ng`（固定NG）: email(UNIQUE), created_at
- `unsubscribe_id`（配信停止ID管理）: email(PK), unsubscribe_id, created_at, updated_at, address_name, source, clinic

## 業務ロジックの要点

- **リスト種別**: WeSmile / 30Under30 / 1D / ウェビナー参加者 / 歯科抽出リスト（旧DELETE） / その他
- **WeSmile**: 代表者（「名前+先生」, 代表者メール→無ければ会社/医院メール）と担当者（「名前+様」）を分離。代表者と担当者が同一/同姓なら担当者を除外。
- **歯科抽出リスト**: 「歯科」「デンタル」を含むもののみ対象。法人名形式（株式会社・一般社団法人等）や非歯科は除外。個人名→「名前+先生」、医院名のみ→「医院名 御中」。
- **汎用（その他）**: メール+名前を読み、宛名は「名前+先生」。
- **正規化**: メール（不可視文字/BOM/mailto/<>除去・小文字化）、名前（カッコ内・肩書除去）。
- **除外**: メール不足／形式不正／宛名不足／配信NG／固定NG／重複／WeSmile同姓／歯科以外／法人名形式。
- **重複除外**: 同一メールは1件のみ。優先順位は WeSmile → それ以外はアップロード順。
- **配信停止ID**: メールごとに12桁ランダム（英大小+数字）。既存メールは再利用。
- **出力CSV列順**（先頭4列がMailwise用で固定）: メールアドレス / 宛名 / 配信停止ID / 配信停止URL / 元リスト / 所属/医院名 / 配信グループ
- **分割**: 950件ごとに `group_01`, `group_02` … 統合CSV／分割CSV／ZIP一括／除外ログCSV をダウンロード可。

## 配信NG移行用CSVインポート

新形式・旧形式の両方に対応（ヘッダ有無も自動判定）。

- 新形式: メールアドレス, 宛名, 配信停止ID, 停止日時, 停止経路, 元リスト, 所属/医院名
- 旧形式: 除外理由, 元リスト, メールアドレス, 宛名, 名前, 所属/医院名, 残したリスト, 残した宛名, 残した所属/医院名

いずれもメールアドレスを抽出して登録し、重複は二重登録しません。

## テスト

`npm test` で要件記載の確認ケース（重複時のWeSmile優先／アップロード順優先／NG除外／配信停止後の除外／二重登録防止／WeSmile同姓除外／メール空・不正・宛名不足の除外／951件の分割 ほか）を検証します。
