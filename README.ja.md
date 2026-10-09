<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno：Chrome 向けコマンドバー & 新しいタブ拡張機能</h1>

<p align="center">
  無料・オープンソースの Chrome / Edge 拡張機能。Spotlight 風のコマンドバーとカスタマイズできるミニマルな新しいタブを、Brave や Arc などの Chromium ブラウザでも使えます。
  <br />
  ひとつのショートカットでタブ、ブックマーク、履歴を検索し、URL へ移動し、サイト内検索や AI 検索を呼び出せます。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/users/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=Chrome%20users&color=2563eb" alt="Chrome ウェブストアのユーザー数" /></a>
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/rating/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=rating&color=f59e0b" alt="Chrome ウェブストアの評価" /></a>
  <a href="https://github.com/kubai087/lumno-extension/stargazers"><img src="https://img.shields.io/github/stars/kubai087/lumno-extension?style=flat-square&color=111827" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square" alt="Manifest V3" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0 ライセンス" /></a>
</p>

<p align="center">
  <a href="https://lumno.kubai.design/">公式サイト</a> ·
  <a href="#インストール">インストール</a> ·
  <a href="#機能">機能</a> ·
  <a href="#よくある質問">よくある質問</a> ·
  <a href="CHANGELOG.md">更新履歴</a>
  <br />
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

**Lumno** は Manifest V3 対応のブラウザ拡張機能です。macOS の Spotlight、Raycast、Arc ブラウザのコマンドバーのような、キーボード中心の**コマンドパレット**をあらゆる Web ページに追加し、ブラウザ標準の新しいタブを高速でミニマルな**新しいタブページ**に置き換えます。`Cmd+Shift+K` / `Ctrl+Shift+K` で、開いているタブ、ブックマーク、閲覧履歴、よく使うサイトを検索し、URL を開き、タブを切り替え、Google、YouTube、GitHub、ChatGPT、Gemini、DeepSeek などへそのまま検索できます。アカウント登録は不要で、閲覧データはブラウザの中にとどまります。

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="./assets/images/readme/chrome-web-store-large-bordered.png" alt="Chrome ウェブストアで Lumno を入手" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="./assets/images/readme/microsoft-edge-addons-badge.png" alt="Microsoft Edge アドオンで Lumno を入手" width="200" />
  </a>
</p>

<p align="center">現在のバージョン：<code>0.9.61</code></p>

<img width="1200" height="480" alt="Lumno Chrome コマンドバー拡張機能：どのページからでもタブ、ブックマーク、履歴を検索" src="./assets/images/readme/banner.webp" decoding="async" />

## 機能

### Spotlight 風のコマンドバー

現在のページ上にコマンドバーを開き、URL への移動、キーワード検索、開いているタブへの切り替え、`chrome://settings` などのブラウザ内部ページや Lumno 設定へのアクセスを、マウスなしで行えます。

### タブ・ブックマーク・履歴をまとめて検索

ブックマーク、閲覧履歴、よく使うサイト、ブラウザ候補、開いているタブを統合。結果ソースの絞り込み、先頭結果の優先度、選択履歴によるランキング、ピンイン検索、ブラックリスト除外に対応します。結果は現在のタブ、左右のタブ、またはタブバーの末尾に開けます。

### サイト内検索と AI 検索

プレフィックスを入力するだけで、YouTube、Bilibili、GitHub、Google、Bing、Baidu、Zhihu、Douban、Juejin、Taobao、X、Reddit、Wikipedia などをサイト内検索できます。ChatGPT、Gemini、DeepSeek、Kimi、豆包、千問、元宝、MiniMax にも直接質問できます。カスタムテンプレートと別名も追加できます。

### 集約検索：複数の検索エンジンを一度に

2～10 個の内蔵またはカスタム検索ソースを 1 つの検索範囲にまとめ、同じクエリを複数のタブで同時に実行します。結果を「集約検索名：クエリ」という名前のタブグループにまとめることもできます。

### 最近のタブスイッチャー

`Alt+Q` でキーボード操作のタブスイッチャーを開き、最近使ったタブ間をすばやく移動できます。ブラウザ版の `Alt+Tab` のように使えます。

### 選択テキストの AI クイックアクション

ページ上のテキストを選択すると、好みの AI サービスで回答・翻訳・解説・要約・リサーチ・計算ができます。結果は新しいタブ（バックグラウンドも可）で開きます。

### カスタマイズできる新しいタブ

検索ボックス、最近/よく使うサイトのショートカット、ブックマークのグリッドとフォルダ階層メニュー、ブックマークのページング、フォルダの色設定を備えたシンプルな新しいタブです。ショートカットとブックマーク間のドラッグ変換、最近サイトの固定/非表示、ドラマや小説の最新話・最新章を追う進捗カード、コンテンツ幅の調整に対応し、`/zen` と入力すると集中できる Zen モードに切り替わります。

### 壁紙とテーマ

システム/ライト/ダークテーマを、全体または新しいタブのみに適用できます。内蔵壁紙、Bing の毎日の壁紙、厳選写真やオープンアクセスのアート作品、ローカル画像や画像 URL を選べます。オーバーレイ透明度、粒子/ハーフトーン/ディザ/ASCII フィルター、検索ボックス幅、Lumno ロゴ表示も調整できます。

### ピクチャー・イン・ピクチャー：Web Clip と動画の自動 PiP

- **Web Clip PiP**：対応する HTTPS ページで一部分を選択し、Document Picture-in-Picture ウィンドウに浮かせて参照や比較に使えます。
- **動画の自動 PiP**：動画再生中に別タブへ移動すると、YouTube、Netflix、Twitch、Vimeo、Prime Video、Disney+、TikTok、Bilibili などで自動的にピクチャー・イン・ピクチャーへの切り替えを試みます。

### Chrome 同期と WebDAV 同期

設定は既定で Chrome の同期機能で同期されます。オプションの [WebDAV 同期](#webdav-同期)（Beta）を使うと、カスタムアイコンやアップロードした壁紙も自分のサーバー経由で同期できます。

### ブラウザ補助と多言語対応

再起動後の固定タブ復元、制限ページから新しいタブへのフォールバック、現在ページ URL のワンキーコピー、拡張機能ショートカット/詳細ページのオープンに対応します。UI は日本語、英語、簡体字中国語、繁体字中国語、またはブラウザ言語への追従を選べます。

## スクリーンショット

<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno のカスタム新しいタブ：壁紙、ショートカット、ブックマーク" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno のコマンドパレット：開いているタブ、ブックマーク、履歴を検索" width="100%" loading="lazy" decoding="async" />
</p>

## ショートカット

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| コマンドバーを開く | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| 現在ページの URL を入れてコマンドバーを開く | `Cmd+Shift+L` | `Ctrl+Shift+L` |
| 現在ページの URL をコピー | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| 最近のタブスイッチャーを開く | `Alt+Q` | `Alt+Q` |

ブラウザによっては拡張機能のショートカットが予約または制限される場合があります。`chrome://extensions/shortcuts`、`edge://extensions/shortcuts`、または利用中ブラウザのショートカット設定ページで変更してください。

## インストール

| ブラウザ | インストール |
| --- | --- |
| Google Chrome | [Chrome ウェブストア](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge アドオン](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave、Arc、Vivaldi、Opera などの Chromium ブラウザ | [Chrome ウェブストア](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |

ソースからインストールする場合：

1. このリポジトリを clone またはダウンロードします。
2. `npm ci` と `npm run build:react` を実行します（[開発](#開発)を参照）。
3. `chrome://extensions/`、または利用中の Chromium ブラウザの拡張機能管理ページを開き、デベロッパーモードを有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を選び、リポジトリのルートディレクトリを指定します。
5. 必要に応じて Lumno の設定ページを開き、言語、テーマ、新しいタブの内容、サイト内検索、ブラックリスト、PiP、ショートカット動作を調整します。

ローカル HTML、PDF、`file://` ページでコマンドバーを使う場合は、拡張機能の詳細ページで「ファイルの URL へのアクセスを許可する」を有効にしてください。

## プライバシー

Lumno はローカルファーストです。ブックマーク、履歴、タブは検索のために端末内でのみ読み取り、Lumno や開発者のサーバーへ送信しません。Lumno アカウント、利用統計、広告トラッキングはありません。サイトアイコン、オンライン壁紙、WebDAV など外部サービスと通信する機能は、オンにしたときだけ動作します。詳しくは[プライバシーポリシー](https://lumno.kubai.design/privacy/)をご覧ください。

## よくある質問

**Lumno は無料ですか？**
はい。Lumno は GPL-3.0 ライセンスの無料オープンソースソフトウェアです。開発を支援したい場合は [Sponsoring](SPONSORING.md) をご覧ください。

**どのブラウザに対応していますか？**
Manifest V3 拡張機能に対応した Chromium ブラウザ（Google Chrome、Microsoft Edge、Brave、Arc、Vivaldi、Opera など）で使えます。Firefox と Safari には対応していません。

**設定を複数の端末で同期できますか？**
はい。ブラウザにログインしていれば、設定は Chrome の同期機能で同期されます。[WebDAV 同期](#webdav-同期)をオンにすると、カスタムアイコンや壁紙も自分のサーバー経由で同期できます。

**一部のページでコマンドバーが開かないのはなぜですか？**
ブラウザは `chrome://` などの内部ページや Chrome ウェブストアで拡張機能の動作を制限しています。これらのページでは Lumno は新しいタブへフォールバックします。ローカルファイルでは「ファイルの URL へのアクセスを許可する」を有効にしてください。

**ショートカットを変更するには？**
`chrome://extensions/shortcuts`（または `edge://extensions/shortcuts`）を開き、Lumno に新しいキーを設定してください。

**Chrome 標準のタブ検索との違いは？**
Lumno はタブ、ブックマーク、履歴、よく使うサイトをまとめて検索し、サイト内検索や AI 検索のプレフィックス、集約検索、最近のタブスイッチャーを備えています。ツールバーだけでなく、現在のページ上にオーバーレイとして開けます。

## WebDAV 同期

WebDAV は「設定 → アカウントと同期」にある Beta 機能です。接続を追加して HTTPS アドレス、同期ディレクトリ、ユーザー名、アプリパスワードを入力し、「保存して同期をオン」を選びます。既存の Chrome 同期と併用し、カスタムアイコンやアップロードした壁紙も同期します。画像は Chrome Sync に含まれず、接続情報は各端末にのみ保存されます。

サーバーに既存データがある場合は最初のバージョンを選択します。その後の競合では競合する内容のバージョンだけを選び、他の変更は統合します。置き換え前にバックアップを保存し、最後に同期が成功した日時を表示します。WebDAV をオフにしても Chrome 同期は続行されます。[WebDAV 同期の詳細](docs/webdav-sync.md)も参照してください。

## 開発

開発と CI では Node.js 20 を使用します。`nvm` を使う場合は `nvm use` を実行すると `.nvmrc` のバージョンに切り替わります。

React ページを Chrome で読み込むには、先にブラウザ用アセットを生成する必要があります。開発版を初めて読み込む前と、`react-src/` を変更した後に次を実行してください。

```bash
npm ci
npm run build:react
```

その後、`chrome://extensions/` でデベロッパーモードを有効のままにし、リポジトリのルートをパッケージ化されていない拡張機能として読み込みます。新しいアセットを生成した後、またはバックグラウンドスクリプトや `manifest.json` を変更した後は、拡張機能ページで手動で再読み込みしてください。起動時の新しいタブの置き換えを中断しないよう、開発版は Chrome プロファイルの起動時に二度目の更新を強制しません。

コミット前に次を実行してください。

```bash
npm run verify
npm run audit:i18n
npm run audit:style
npm run package:store
```

よく使う個別テスト：

```bash
npm run test:settings
npm run test:search
npm run test:site-search-store
npm run test:message-router
npm run test:newtab-layout
npm run test:onboarding-content
```

`npm run package:store` は `manifest.json` のバージョンを読み取り、`dist/lumno-store-v<version>.zip` を生成します。このコマンドにはシステム上の `zip` と `zipinfo` が必要です。

### ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3 設定、権限、コマンド、コンテンツスクリプト、新しいタブの上書き |
| `src/background/` | Service worker、コマンドルーティング、検索データ、サイト/AI 検索、タブスイッチャー、PiP 所有権、固定タブ復元、WebDAV 同期 |
| `src/newtab/` | 新しいタブ UI、検索、最近サイト、ブックマーク、壁紙、フィードバック、ページ通知 |
| `src/overlay/` | ページ内コマンドバー、候補リスト、テーマ/言語同期、サイト別補正 |
| `src/content/` | ページショートカット監視、選択テキストのクイックアクション、Web Clip PiP、動画の自動 PiP |
| `src/options/` | 拡張機能の設定ページ |
| `src/onboarding/` | インストール/アップデート時のオンボーディング |
| `src/shared/` | 設定、検索、favicon、メニュー、ツールチップ、URL ガードなどの共通モジュール |
| `react-src/` | React ソース（`src/react/` にビルド） |
| `_locales/` | 拡張 UI 文言 |
| `assets/data/` | 内蔵サイト内検索とブラウザショートカットのデータ |
| `assets/wallpapers/` | 新しいタブの内蔵壁紙とサムネイル |
| `scripts/` | チェック、監査、パッケージング、回帰テスト |

## コントリビュート

不具合の報告、機能の提案、プルリクエストは [Issues](https://github.com/kubai087/lumno-extension/issues) で受け付けています。プロジェクトの運営方針は [GOVERNANCE.md](GOVERNANCE.md) をご覧ください。Lumno が役に立ったら、GitHub の ⭐ や Chrome ウェブストアでのレビューで応援していただけると、より多くの人に届きます。

## クレジット

- 日本語ローカライズ：[Humi](https://github.com/Hum1Tab) さんに日本語翻訳と校正へご協力いただきました。
- macOS `Ctrl+N` / `Ctrl+P` による候補移動の実験機能：[wanghanzhen](https://github.com/wanghanzhen) さんの [PR #38](https://github.com/kubai087/lumno-extension/pull/38) での貢献に基づいています。
- 同梱アイコンセット：[Remix Icon](https://remixicon.com/)
- 同梱書体：Open Sans、[LXGW WenKai](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1、一言表示用にサブセット化）

## ライセンス

このプロジェクトは [GPL-3.0](LICENSE) ライセンスで公開されています。
