<p align="center">
  <img src="./assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno</h1>

<p align="center">
  コマンドバー & 新しいタブ
  <br />
  どのページからでもコマンドバーを開き、すばやく検索し、URL へ移動し、タブを切り替え、新しいタブ体験を強化します。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-MV3-111827?style=flat-square" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/Browser-Chromium-2563eb?style=flat-square" alt="Chromium" />
  <img src="https://img.shields.io/badge/Language-JavaScript-f59e0b?style=flat-square" alt="JavaScript" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0" />
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

Lumno は Chromium ブラウザ向けの Manifest V3 拡張機能です。集中して使えるブラウザコマンドバーとミニマルな新しいタブを組み合わせ、ブックマーク、履歴、よく使うサイト、開いているタブ、サイト内検索、AI アシスタントをひとつの入口から探せます。

現在のバージョン：`0.9.58`

<img width="1200" height="480" alt="Lumno command bar preview" src="./assets/images/readme/banner.webp" decoding="async" />

## 主な機能

- 集中コマンドバー：注入可能なページ上でオーバーレイ検索を開き、URL への移動、キーワード検索、開いているタブへの切り替え、ブラウザ内部ページや Lumno 設定への移動ができます。
- スマート検索結果：ブックマーク、履歴、よく使うサイト、ブラウザ候補、開いているタブを統合し、結果ソースの絞り込み、先頭結果の優先度、選択履歴によるランキング、ピンイン検索、ブラックリスト除外に対応します。
- サイト内検索 / AI 検索：YouTube、Bilibili、GitHub、Google、Bing、Baidu、Zhihu、Douban、Juejin、Taobao、X、Reddit、Wikipedia などのショートカットを内蔵。AI 入口として ChatGPT、Gemini、豆包、千問、元宝、MiniMax、DeepSeek、Kimi も利用できます。カスタムテンプレートと別名も追加できます。
- 集約検索：2～10 個の内蔵またはカスタム検索ソースを 1 つの検索範囲にまとめ、同じクエリを複数のタブで同時に実行できます。結果をクエリ名のタブグループへ自動的にまとめることもできます。
- 新しいタブ：検索ボックス、最近/よく使うサイトカード、ブックマークのグリッドとフォルダ階層メニュー、ブックマークページング、最近サイトの固定/非表示、フィードバック入口、コンテンツ幅の調整を備えています。
- 外観と壁紙：システム/ライト/ダークテーマ、全体または新しいタブのみのテーマ適用、内蔵壁紙、ローカル壁紙、オーバーレイ透明度、粒子/ハーフトーン/ディザ/ASCII フィルター、検索ボックス幅、Lumno ロゴ表示の切り替えに対応します。
- Web Clip PiP：対応している HTTPS のトップレベルページでページの一部を選択し、Document Picture-in-Picture ウィンドウとして浮かせて参照や比較に使えます。
- 動画の自動画中画：動画再生中に別タブへ移動したとき、YouTube、Bilibili、Youku、Tencent Video、Douyin、TikTok、Netflix、Vimeo、Prime Video、Disney+、Twitch などで自動的に動画 PiP へ入ることを試みます。
- ブラウザ補助：再起動後の固定タブ復元、制限ページから新しいタブへのフォールバック、現在ページ URL のコピー、拡張機能ショートカット/詳細ページのオープンに対応します。
- 多言語：拡張 UI は簡体字中国語、繁体字中国語、英語、日本語、ブラウザ言語への追従に対応します。この README は簡体字中国語、英語、日本語で切り替えできます。

## スクリーンショット
<p align="center">
  <img src="./assets/images/readme/preview-newtab.webp" alt="Lumno new tab preview" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="./assets/images/readme/preview-command-bar.webp" alt="Lumno command bar preview" width="100%" loading="lazy" decoding="async" />
</p>

## ショートカット

| 操作 | 既定のショートカット |
| --- | --- |
| コマンドバーを開く | `Cmd+Shift+K` / `Ctrl+Shift+K` |
| 現在ページの URL を入れてコマンドバーを開く | `Cmd+Shift+L` / `Ctrl+Shift+L` |
| 現在ページの URL をコピー | `Cmd+Shift+C` / `Ctrl+Shift+C` |

ブラウザによっては拡張機能のショートカットが予約または制限される場合があります。`chrome://extensions/shortcuts`、`edge://extensions/shortcuts`、または利用中ブラウザのショートカット設定ページで変更してください。

## インストール

Chrome Web Store からインストールできます：[Install Lumno on Chrome Web Store](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao?utm_source=item-share-cb)

手動インストール：

1. このリポジトリを clone またはダウンロードします。
2. `chrome://extensions/`、または Edge、Brave、Vivaldi、Opera など Chromium ブラウザの拡張機能管理ページを開きます。
3. デベロッパーモードを有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を選び、リポジトリのルートディレクトリを指定します。
5. 必要に応じて Lumno の設定ページを開き、言語、テーマ、新しいタブの内容、サイト内検索、ブラックリスト、PiP、ショートカット動作を調整します。

ローカル HTML、PDF、`file://` ページでコマンドバーを使う場合は、拡張機能の詳細ページで「ファイルの URL へのアクセスを許可する」を有効にしてください。

## WebDAV 同期

WebDAV は「設定 → アカウントと同期」にある Beta 機能です。接続を追加して HTTPS アドレス、同期ディレクトリ、ユーザー名、アプリパスワードを入力し、「保存して同期をオン」を選びます。既存の Chrome 同期と併用し、カスタムアイコンやアップロードした壁紙も同期します。画像は Chrome Sync に含まれず、接続情報は各端末にのみ保存されます。

サーバーに既存データがある場合は最初のバージョンを選択します。その後の競合では競合する内容のバージョンだけを選び、他の変更は統合します。置き換え前にバックアップを保存し、最後に同期が成功した日時を表示します。WebDAV をオフにしても Chrome 同期は続行されます。[WebDAV 同期の詳細](docs/webdav-sync.md)も参照してください。

## 開発

React ページを Chrome で読み込むには、先にブラウザ用アセットを生成する必要があります。開発版を初めて読み込む前と、`react-src/` を変更した後に次を実行してください。

```bash
npm ci
npm run build:react
```

その後、`chrome://extensions/` でデベロッパーモードを有効のままにし、リポジトリのルートをパッケージ化されていない拡張機能として読み込みます。新しいアセットを生成した後、またはバックグラウンドスクリプトや `manifest.json` を変更した後は、拡張機能ページで手動で再読み込みしてください。起動時の新しいタブの置き換えを中断しないよう、開発版は Chrome プロファイルの起動時に二度目の更新を強制しません。

コミット前に次を実行してください。

```bash
npm test
npm run check
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

## ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3 設定、権限、コマンド、コンテンツスクリプト、新しいタブの上書き |
| `src/background/` | Service worker、コマンドルーティング、検索データ、サイト/AI 検索、PiP 所有権、固定タブ復元 |
| `src/newtab/` | 新しいタブ UI、検索、最近サイト、ブックマーク、壁紙、フィードバック、ページ通知 |
| `src/overlay/` | ページ内コマンドバー、候補リスト、テーマ/言語同期、サイト別補正 |
| `src/content/` | ページショートカット監視、Web Clip PiP、動画の自動 PiP |
| `src/options/` | 拡張機能の設定ページ |
| `src/onboarding/` | インストール/アップデート時のオンボーディング |
| `src/shared/` | 設定、検索、favicon、メニュー、ツールチップ、URL ガードなどの共通モジュール |
| `_locales/` | 拡張 UI 文言 |
| `assets/data/` | 内蔵サイト内検索とブラウザショートカットのデータ |
| `assets/wallpapers/` | 新しいタブの内蔵壁紙とサムネイル |
| `scripts/` | チェック、監査、パッケージング、回帰テスト |

## クレジット

- 日本語ローカライズ：[Humi](https://github.com/Hum1Tab) さんに日本語翻訳と校正へご協力いただきました。
- 同梱アイコンセット：[Remix Icon](https://remixicon.com/)
- 同梱書体：Open Sans、[LXGW WenKai](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1、一言表示用にサブセット化）

## ライセンス

このプロジェクトは [GPL-3.0](LICENSE) ライセンスで公開されています。
