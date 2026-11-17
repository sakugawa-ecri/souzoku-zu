# 相続関係説明図・法定相続情報一覧図（Vercel版）設定手順

事務所のGoogleアカウント（@ecrioffice.com）でログインした人だけが開けるようにして、Vercelに置きます。
戸籍のデータは職員のパソコンの画面の中だけで処理され、Vercelには届きません。

## ファイルの中身

| ファイル | 役割 |
|---|---|
| public/index.html | 相続関係説明図・一覧図のページ本体（右上にログアウトボタン付き） |
| public/signed-out.html | ログアウト後の案内 |
| proxy.js | 門番。ログインしていない人をGoogleのログインへ送る |
| api/login.js, api/callback.js, api/logout.js | Googleログインの入口・戻り口・ログアウト |
| lib/session.js | ログイン状態の発行と確認（中身はメールアドレスと期限だけ） |
| vercel.json | 門番の設定、東京リージョン、セキュリティの設定（外部への送信禁止など） |

## 手順1　Vercelにプロジェクトを作る

1. このフォルダをGitHubのリポジトリ（非公開）にして、Vercelの「Add New → Project」から読み込む
2. Framework Preset は「Other」のまま「Deploy」
3. 公開されたURL（例：`https://souzoku-zu.vercel.app`）を控える
   - この時点では、まだログインの設定がないのでページは開けません（エラーになります）

## 手順2　GoogleでOAuthクライアントを作る（無料）

Google Cloud コンソール（https://console.cloud.google.com）に、事務所の管理者アカウントで入ります。

1. 上のプロジェクト選択で、使うプロジェクトを選ぶ（新しく作ってもよい）
2. 「Google Auth Platform」を開く → 「始める」
   - アプリ名：相続関係説明図
   - ユーザーサポートメール：管理者のアドレス
   - 対象：**内部**（事務所のアカウントだけが使える。Googleの審査も不要）
3. 「クライアント」→「クライアントを作成」
   - アプリケーションの種類：**ウェブ アプリケーション**
   - 承認済みのリダイレクト URI：`https://（手順1のURL）/api/callback`
4. 表示された「クライアント ID」と「クライアント シークレット」を控える（シークレットは他人に見せない）

## 手順3　Vercelに設定値を入れる

Vercelのプロジェクト → Settings → Environment Variables に、次の4つを入れます（Environment は Production）。

| 名前 | 値 |
|---|---|
| GOOGLE_CLIENT_ID | 手順2のクライアント ID |
| GOOGLE_CLIENT_SECRET | 手順2のクライアント シークレット |
| ALLOWED_DOMAIN | ecrioffice.com |
| SESSION_SECRET | 40文字以上のでたらめな英数字（パスワード生成機能で作る。どこにも書き残さない） |

入れたら、Deployments → 最新のもの → 「Redeploy」。

## 手順4　確認する

1. ブラウザのシークレットウィンドウでURLを開く → Googleのログイン画面が出る
2. 個人のGmailでログイン → 「ログインできません」になる
3. 事務所のアカウントでログイン → ページが開く
4. 右上の「ログアウト」→ 案内ページが出る

※ Vercelのログイン画面が出る場合は、Settings → Deployment Protection の「Vercel Authentication」が本番のURLにもかかっています。
「Standard Protection」（本番のドメイン以外を保護）にしてください。

## 運用

- ログインは8時間続きます。共用パソコンでは、使い終わったら「ログアウト」を押す
- 退職者は、Googleのアカウントを停止すれば次回から入れなくなる（最長8時間は、それまでのログインが残る）
- SESSION_SECRET を変えて Redeploy すると、全員のログインを強制的に切れる
- 図の修正をしたら public/index.html を差し替えて、GitHubに上げれば自動で公開される
