<p align="center">
  <img src="../assets/images/lumno.png" alt="Lumno logo" width="96" height="96" />
</p>

<h1 align="center">Lumno：Chrome 向けコマンドバー & 新しいタブ拡張機能</h1>

<p align="center">
  無料・オープンソースの Chrome / Edge / Firefox 拡張機能。Spotlight 風のコマンドバーとカスタマイズできるミニマルな新しいタブを、Brave や Arc などの Chromium ブラウザや、Zen などの Firefox 系ブラウザでも使えます。
  <br />
  ひとつのショートカットでタブ、ブックマーク、履歴を検索し、URL へ移動し、サイト内検索や AI 検索を呼び出せます。
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/users/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=Chrome%20users&color=2563eb" alt="Chrome ウェブストアのユーザー数" /></a>
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao"><img src="https://img.shields.io/chrome-web-store/rating/nggfkkbmogmadfoikakkfegkoilfcfao?style=flat-square&label=rating&color=f59e0b" alt="Chrome ウェブストアの評価" /></a>
  <a href="https://github.com/kubai087/lumno-extension/stargazers"><img src="https://img.shields.io/github/stars/kubai087/lumno-extension?style=flat-square&color=111827" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/badge/Manifest-V3-111827?style=flat-square" alt="Manifest V3" />
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-GPL--3.0-16a34a?style=flat-square" alt="GPL-3.0 ライセンス" /></a>
</p>

<p align="center">
  <a href="https://lumno.kubai.design/">公式サイト</a> ·
  <a href="https://lumno.kubai.design/ja/help/">ヘルプセンター</a> ·
  <a href="#インストール">インストール</a> ·
  <a href="#機能">機能</a> ·
  <a href="#よくある質問">よくある質問</a> ·
  <a href="https://github.com/kubai087/lumno-extension/releases">更新履歴</a>
  <br />
  <a href="README.zh-CN.md">简体中文</a> |
  <a href="../README.md">English</a> |
  <a href="README.ja.md">日本語</a>
</p>

**Lumno** は Manifest V3 対応のブラウザ拡張機能です。macOS の Spotlight、Raycast、Arc ブラウザのコマンドバーのような、キーボード中心の**コマンドパレット**をあらゆる Web ページに追加し、ブラウザ標準の新しいタブを高速でミニマルな**新しいタブページ**に置き換えます。`Cmd+Shift+K` / `Ctrl+Shift+K` で、開いているタブ、ブックマーク、閲覧履歴、よく使うサイトを検索し、URL を開き、タブを切り替え、Google、YouTube、GitHub、ChatGPT、Gemini、DeepSeek などへそのまま検索できます。アカウント登録は不要で、閲覧データはブラウザの中にとどまります。

<p align="center">
  <a href="https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao">
    <img src="../assets/images/readme/chrome-web-store-large-bordered.png" alt="Chrome ウェブストアで Lumno を入手" width="200" />
  </a><br />
  <a href="https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc">
    <img src="../assets/images/readme/microsoft-edge-addons-badge.png" alt="Microsoft Edge アドオンで Lumno を入手" width="200" />
  </a><br />
  <a href="https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/">
    <img src="../assets/images/readme/firefox-get-the-addon-badge.png" alt="Firefox アドオンで Lumno を入手" width="200" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/kubai087/lumno-extension/releases/latest"><img src="https://img.shields.io/github/v/release/kubai087/lumno-extension?style=flat-square&label=%E6%9C%80%E6%96%B0%E3%83%90%E3%83%BC%E3%82%B8%E3%83%A7%E3%83%B3&color=111827" alt="最新バージョン" /></a>
</p>

<img width="1200" height="480" alt="Lumno Chrome コマンドバー拡張機能：どのページからでもタブ、ブックマーク、履歴を検索" src="../assets/images/readme/banner.webp" decoding="async" />

## 機能

### Spotlight 風のコマンドバー

現在のページ上にコマンドバーを開き、URL への移動、キーワード検索、開いているタブへの切り替え、`chrome://settings` などのブラウザ内部ページや Lumno 設定へのアクセスを、マウスなしで行えます。

### タブ・ブックマーク・履歴をまとめて検索

ブックマーク、閲覧履歴、よく使うサイト、ブラウザ候補、開いているタブを統合。結果ソースの絞り込み、先頭結果の優先度、選択履歴によるランキング、ブラックリスト除外に対応します。中国語のタイトルはピンイン、頭文字、またはその組み合わせで検索でき（あいまい音にも対応）、キーボード配列を切り替え忘れて入力した内容（ロシア語、ウクライナ語、ヘブライ語、アラビア語、韓国語）でも目的のページが見つかります。結果は現在のタブ、左右のタブ、またはタブバーの末尾に開けます。

### サイト内検索と AI 検索

プレフィックスを入力するだけで、YouTube、Bilibili、GitHub、Google、Bing、Baidu、Zhihu、Douban、Juejin、Taobao、X、Reddit、Wikipedia などをサイト内検索できます。ChatGPT、Gemini、Google AI Studio、Copilot、Grok、DeepSeek、Kimi、豆包、千問、Qwen Chat、元宝、MiniMax にも直接質問できます。カスタムテンプレートと別名も追加できます。

### 集約検索：複数の検索エンジンを一度に

2～10 個の内蔵またはカスタム検索ソースを 1 つの検索範囲にまとめ、同じクエリを複数のタブで同時に実行します。結果を「集約検索名：クエリ」という名前のタブグループにまとめることもできます。

### 最近のタブスイッチャー

`Alt+Q` でキーボード操作のタブスイッチャーを開き、最近使ったタブ間をすばやく移動できます。ブラウザ版の `Alt+Tab` のように使えます。

### 選択テキストの AI クイックアクション

ページ上のテキストを選択すると、好みの AI サービスで回答・翻訳・解説・要約・リサーチ・計算ができます。結果は新しいタブ（バックグラウンドも可）で開きます。

### カスタマイズできる新しいタブ

検索ボックス、名前付きのグループに整理できるショートカット（最大 200 個）、最近/よく使うサイトのカード、ブックマークのグリッドとフォルダ階層メニュー、ブックマークのページング、フォルダの色設定を備えたシンプルな新しいタブです。ショートカットとブックマーク間のドラッグ変換、最近サイトの固定/非表示、ドラマや小説の最新話・最新章を追う進捗カード、コンテンツ幅の調整に対応し、`/zen` と入力すると集中できる Zen モードに切り替わります。Firefox では、コマンドバーや新しいタブの検索ボックスで `/appearance` と入力すると、Web ページに伝えるウェブサイトの外観を自動・ライト・ダークで切り替えられます。どのページも右クリックメニューやツールバーのポップアップからショートカットに追加でき、背景のないアイコンはアイコンの主な色で着色した背景に載せて表示されます。

時計は 6 種類のフォントから選べ、文字サイズ、不透明度、色、12時間表示も設定できます。今日の一言には、自分で用意した TXT / Markdown の名言リストを好みのフォントで表示できます。

### 壁紙とテーマ

システム/ライト/ダークテーマを、全体または新しいタブのみに適用できます。内蔵壁紙、Bing の毎日の壁紙、厳選写真やオープンアクセスのアート作品、ローカル画像や画像 URL を選べます（厳選写真のランダムは分類を絞り込めます）。気に入った Bing や厳選の壁紙は、この端末の壁紙に保存できます。オーバーレイ透明度、粒子/ハーフトーン/ディザ/ASCII フィルター、検索ボックス幅、Lumno ロゴ表示も調整できます。

検索バー、カード、メニュー、ダイアログには、**アクリル**や、背後の壁紙を屈折させる**リキッドグラス**のマテリアルを適用でき、「ガラスの明暗」でライトまたはダークに固定することもできます。

### ピクチャー・イン・ピクチャー：Web Clip と動画の自動 PiP

- **Web Clip PiP**：対応する HTTPS ページで一部分を選択し、Document Picture-in-Picture ウィンドウに浮かせて参照や比較に使えます。
- **動画の自動 PiP**：動画再生中に別タブへ移動すると、YouTube、Netflix、Twitch、Vimeo、Prime Video、Disney+、TikTok、Bilibili などで自動的にピクチャー・イン・ピクチャーへの切り替えを試みます。

### ツールバーのポップアップ

ツールバーの Lumno アイコンをクリックすると、現在のページを新しいタブのショートカットに追加したり、リンクをコピーしたり、コマンドバーを開いたり、ページをクリップしたり、ピクチャー・イン・ピクチャーを開始したりできます。クイック設定ではテーマとコマンドバーのオプションを切り替えられ、下部には WebDAV 同期の状態が表示されます。

### Chrome 同期と WebDAV 同期

設定は既定で Chrome の同期機能で同期されます。オプションの [WebDAV 同期](#webdav-同期)（Beta）を使うと、カスタムアイコンやアップロードした壁紙も自分のサーバー経由で同期できます。サーバーがリクエストを制限したときは、Lumno が待機して自動的に再試行します。

### ブラウザ補助と多言語対応

Shift キーを押しながらリンクをクリックすると、ページの上の小さなウィンドウでプレビューでき、閉じるかタブに移せます。再起動後の固定タブ復元、制限ページから新しいタブへのフォールバック、現在ページ URL のワンキーコピー、拡張機能ショートカット/詳細ページのオープンに対応します。

UI は 10 言語（日本語、英語、簡体字中国語、繁体字中国語、韓国語、ドイツ語、フランス語、スペイン語、ブラジルポルトガル語、ロシア語）に対応し、ブラウザ言語への追従も選べます。日本語、英語、簡体字中国語、繁体字中国語は人が書いて確認しており、それ以外は AI 翻訳です。ネイティブスピーカーの方は、設定 → 一般 → 言語 → **翻訳を改善** から修正にご協力いただけます。

各機能の使い方は、スクリーンショット付きで [Lumno ヘルプセンター](https://lumno.kubai.design/ja/help/)にまとめています。

## スクリーンショット

<p align="center">
  <img src="../assets/images/readme/preview-newtab.webp" alt="Lumno のカスタム新しいタブ：壁紙、ショートカット、ブックマーク" width="100%" loading="lazy" decoding="async" />
  <br />
  <img src="../assets/images/readme/preview-command-bar.webp" alt="Lumno のコマンドパレット：開いているタブ、ブックマーク、履歴を検索" width="100%" loading="lazy" decoding="async" />
</p>

## ショートカット

| 操作 | macOS | Windows / Linux |
| --- | --- | --- |
| コマンドバーを開く | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| 現在ページの URL を入れてコマンドバーを開く | `Cmd+Shift+L` | `Ctrl+Shift+L` |
| 現在ページの URL をコピー | `Cmd+Shift+C` | `Ctrl+Shift+C` |
| 最近のタブスイッチャーを開く | `Alt+Q` | `Alt+Q` |

Lumno の新しいタブでは、コマンドバーのショートカットで検索欄にフォーカスを移せます。アドレスバーにフォーカスがあり、入力欄の自動フォーカスがオフでも使えます。入力中の内容と表示中の結果はそのまま残ります。

ブラウザによっては拡張機能のショートカットが予約または制限される場合があります。`chrome://extensions/shortcuts`、`edge://extensions/shortcuts`、または利用中ブラウザのショートカット設定ページで変更してください。

Firefox は `Cmd+Shift+K` / `Ctrl+Shift+K` などをすでに使っているため、Firefox 版の既定は macOS で `Ctrl+Shift+K/L/C`、Windows と Linux で `Alt+K/L/C` です（`Alt+Q` は同じ）。アドオンマネージャーの歯車メニュー →「拡張機能のショートカットキーの管理」で変更できます。

## インストール

| ブラウザ | インストール |
| --- | --- |
| Google Chrome | [Chrome ウェブストア](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Microsoft Edge | [Microsoft Edge アドオン](https://microsoftedge.microsoft.com/addons/detail/pfbklkaefmfamjpibfiapaiihlddhchc) |
| Brave、Arc、Vivaldi、Opera などの Chromium ブラウザ | [Chrome ウェブストア](https://chromewebstore.google.com/detail/nggfkkbmogmadfoikakkfegkoilfcfao) |
| Firefox 140 以降、Zen、LibreWolf、Floorp などの Firefox 系ブラウザ | [Firefox アドオン](https://addons.mozilla.org/firefox/addon/lumno-command-bar-new-tab/) |

ソースからインストールする場合：

1. このリポジトリを clone またはダウンロードします。
2. `npm ci` と `npm run build` を実行します（[開発](#開発)を参照）。
3. `chrome://extensions/`、または利用中の Chromium ブラウザの拡張機能管理ページを開き、デベロッパーモードを有効にします。
4. 「パッケージ化されていない拡張機能を読み込む」を選び、ビルドが作った `dist/chrome` フォルダを指定します。
5. 必要に応じて Lumno の設定ページを開き、言語、テーマ、新しいタブの内容、サイト内検索、ブラックリスト、PiP、ショートカット動作を調整します。

ローカル HTML、PDF、`file://` ページでコマンドバーを使う場合は、拡張機能の詳細ページで「ファイルの URL へのアクセスを許可する」を有効にしてください。

## ブラウザ互換性

Lumno は Chromium ブラウザ向けに開発しており、Firefox 版も用意しています。Zen、LibreWolf、Floorp、Waterfox など Firefox ベースのブラウザでは Firefox 版を使い、Firefox 140 以降のエンジンが必要です。Safari には対応していません。

**Firefox と Firefox 系ブラウザ。** Firefox の拡張機能 API は Chromium といくつかの点で異なります。

| 機能 | Firefox での動作 | 理由 |
| --- | --- | --- |
| 動画の自動ピクチャーインピクチャー | 利用不可。設定では無効表示になり、ホバーで理由を表示 | Firefox は拡張機能がページの動画をピクチャーインピクチャーにすることを許可していない |
| Webクリップ | 利用不可。設定では無効表示になり、ホバーで理由を表示 | Document Picture-in-Picture が必要だが、Firefox は未対応 |
| 新しいタブのブックマークマネージャーボタン | 非表示 | 拡張機能から Firefox のライブラリウィンドウを開けない |
| ショートカットやコマンドバーから `about:` ページ（`about:config` など）を開く | 利用不可 | Firefox は拡張機能が特権ページを開くことを許可していない |
| `about:` ページと addons.mozilla.org でのコマンドバー | 利用不可 | Firefox がこれらのページで拡張機能のスクリプトを禁止しているため。ショートカットは制限ページの設定に従う |
| ローカルの `file://` ページでのコマンドバー | 利用不可 | Firefox には拡張機能にファイル URL へのアクセスを許可する設定がない |
| サイトアイコン | 動作が異なる | Firefox には拡張機能向けのアイコン API がないため、Firefox 自身のアイコンキャッシュ（開いているタブとよく使うサイト）を読み、オンにしていればオンラインのアイコンサービスを使う。未訪問のサイトは一度開くまでプレースホルダーになることがある |
| タブスイッチャーでの `about:` ページ | 動作が異なる | Firefox はこれらのページをぼかした画像でしか返さないため、プレビューの代わりにブラウザのロゴを表示 |
| 新しいタブの検索ボックスへのフォーカス | 動作が異なる | Firefox は新しいタブでアドレスバーにフォーカスするため、自動フォーカスがオンのとき Lumno はタブを開き直して検索ボックスにフォーカスする |
| 「ショートカット設定を開く」 | 動作が異なる | アドオンマネージャーが開くので、歯車メニューから「拡張機能のショートカットキーの管理」を選ぶ |
| 設定の同期 | 動作が異なる | Chrome の同期ではなく Firefox Sync を使う。WebDAV 同期は Chrome と Firefox の間でも使え、同じパソコンで両方を開いていても動作する |

**Chromium 系ブラウザ。** Brave、Arc、Vivaldi、Opera などは Chrome ウェブストア版を使い、機能は Chrome と同じですが、拡張機能のショートカットを予約または変更するブラウザもあります。Dia では新しいタブ機能は使えませんが、コマンドバーは使えます。Dia 自体のショートカットが優先されるため、⌘T で開くには、まず Dia の Settings → Shortcuts で「New Tab」の ⌘T を別のキーに変更し、拡張機能のショートカットページで「Open command bar」を ⌘T に設定してください。ショートカットが効かない場合は、同じページで In Dia から Global に変更してください。

## プライバシー

Lumno はローカルファーストです。ブックマーク、履歴、タブは検索のために端末内でのみ読み取り、Lumno や開発者のサーバーへ送信しません。Lumno アカウント、利用統計、広告トラッキングはありません。既定で外部と通信するのは 2 つだけです。検索候補は入力した文字を既定の検索エンジンの候補サービスへ送ります（URL、ホスト名、ファイルパス、事前入力された現在のページのアドレスは送りません）。ブラウザーにキャッシュがないサイトアイコンは Google のアイコンサービス（Gstatic）から取得し、伝わるのはサイトのオリジンだけでページは伝わりません。オンライン壁紙や WebDAV はオンにしたときだけ通信します。詳しくは[プライバシーポリシー](https://lumno.kubai.design/privacy/)をご覧ください。

## よくある質問

**各機能の使い方はどこで確認できますか？**
[Lumno ヘルプセンター](https://lumno.kubai.design/ja/help/)で、セットアップ、コマンドバー、新しいタブ、同期、互換性、プライバシーについて 10 言語で説明しています。

**Lumno は無料ですか？**
はい。Lumno は GPL-3.0 ライセンスの無料オープンソースソフトウェアです。

**どのブラウザに対応していますか？**
Manifest V3 拡張機能に対応した Chromium ブラウザ（Google Chrome、Microsoft Edge、Brave、Arc、Vivaldi、Opera など）に加え、Firefox 140 以降と Zen、LibreWolf などの Firefox 系ブラウザで使えます。Firefox では一部の機能が使えません。[ブラウザ互換性](#ブラウザ互換性)をご覧ください。Safari には対応していません。

**設定を複数の端末で同期できますか？**
はい。ブラウザにログインしていれば、設定は Chrome の同期機能で同期されます。[WebDAV 同期](#webdav-同期)をオンにすると、カスタムアイコンや壁紙も自分のサーバー経由で同期できます。

**一部のページでコマンドバーが開かないのはなぜですか？**
ブラウザは `chrome://` などの内部ページや Chrome ウェブストアで拡張機能の動作を制限しています。これらのページでは Lumno は新しいタブへフォールバックします。ローカルファイルでは「ファイルの URL へのアクセスを許可する」を有効にしてください。

**ショートカットを変更するには？**
`chrome://extensions/shortcuts`（または `edge://extensions/shortcuts`）を開き、Lumno に新しいキーを設定してください。

**Arc のように Ctrl+Tab でタブ切り替えを開けますか？**
はい。ただし、ショートカット設定ページでは Ctrl+Tab を登録できません。`chrome://extensions/shortcuts` を開き、`Cmd+Option+J`（Windows と Linux では `Ctrl+Shift+J`）でデベロッパーツールのコンソールを開いて、次のコードを実行してください。

```js
const extensions = await chrome.developerPrivate.getExtensionsInfo();
const lumno = extensions.find((item) =>
  item.commands.some((command) => command.name === "show-tab-switcher"));
await chrome.developerPrivate.updateExtensionCommand({
  extensionId: lumno.id,
  commandName: "show-tab-switcher",
  keybinding: "Ctrl+Tab",
});
```

このコードが変更するのは Lumno のタブ切り替えのショートカットだけで、設定後はブラウザ標準の Ctrl+Tab は使えなくなります。画像付きの手順は[ヘルプセンター](https://lumno.kubai.design/ja/help/tab-switcher/#ctrl-tab)を参照してください。

**Chrome 標準のタブ検索との違いは？**
Lumno はタブ、ブックマーク、履歴、よく使うサイトをまとめて検索し、サイト内検索や AI 検索のプレフィックス、集約検索、最近のタブスイッチャーを備えています。ツールバーだけでなく、現在のページ上にオーバーレイとして開けます。

## WebDAV 同期

WebDAV は「設定 → アカウントと同期」にある Beta 機能です。接続を追加して HTTPS アドレス、同期ディレクトリ、ユーザー名、アプリパスワードを入力し、「保存して同期をオン」を選びます。既存の Chrome 同期と併用し、カスタムアイコンやアップロードした壁紙も同期します。画像は Chrome Sync に含まれず、接続情報は各端末にのみ保存されます。

サーバーに既存データがある場合は最初のバージョンを選択します。その後の競合では競合する内容のバージョンだけを選び、他の変更は統合します。置き換え前にバックアップを保存し、最後に同期が成功した日時を表示します。WebDAV をオフにしても Chrome 同期は続行されます。

## 開発

開発と CI では Node.js 22 を使用します。`nvm` を使う場合は `nvm use` を実行すると `.nvmrc` のバージョンに切り替わります。

Chrome はビルド済みの拡張機能を読み込みます。`npm run build` はそれを `dist/chrome/` に書き出します（コミットしません）。ページ、スタイル、アセット、ロケールはそのままコピーし、拡張機能が実行するすべてのスクリプトを Vite でその中の `build/` にビルドし、`manifest.json` はリポジトリの同名ファイルから生成します。フォルダの構成はリポジトリと同じなので、ページの URL はストア版と一致します。開発版を初めて読み込む前に次を実行してください。

```bash
npm ci
npm run build
```

`src/` のスクリプトは TypeScript の ES モジュールで、それぞれ必要なモジュールを import します。`build/` の各スクリプトは、`scripts/build/entries.js` が挙げるひとつのエントリーモジュールからビルドされます。ページのスクリプトはチャンクを共有する ES モジュールで、プリロード、コンテンツスクリプト、Service Worker は自己完結したクラシックスクリプトです。作業中は `npm run watch` が `dist/chrome/` を最新に保ちます。変更のたびにファイルをコピーし、スクリプトを作り直します。

その後、`chrome://extensions/` でデベロッパーモードを有効のままにし、`dist/chrome` をパッケージ化されていない拡張機能として読み込みます。新しいアセットを生成した後、またはバックグラウンドスクリプトや `manifest.json` を変更した後は、拡張機能ページで手動で再読み込みしてください。起動時の新しいタブの置き換えを中断しないよう、開発版は Chrome プロファイルの起動時に二度目の更新を強制しません。

プルリクエストを送る前に `npm run verify` を実行してください。拡張機能をビルドし、テスト、静的チェック、ESLint を CI と同じように実行します。作業中は一部だけを実行できます。

```bash
npx vitest run src/domain/search tests/pages/newtab
npx vitest run --project dom -t "scope panel"
npm run lint
```

テストはすべて TypeScript で書かれ、Vitest で実行します。`npx vitest run <パス>` はそのパスにあるテストファイルを、`-t <名前>` は名前が一致するテストだけを実行します。`npm run check:locales` はすべての言語の文言をチェックします。AI 翻訳の言語でまだ翻訳されていない文言は警告にとどまり、`npm run package:store` ではエラーになります。`npm run audit:i18n` と `npm run audit:style` は、コードに直接書かれた中国語と残っているスタイルの課題を一覧にします。

`npm run package:store` は `manifest.json` のバージョンを読み取り、`dist/lumno-store-v<version>.zip` を生成します。このコマンドにはシステム上の `zip` と `zipinfo` が必要です。

`npm run package:firefox` はストア用パッケージを作り、`dist/firefox` の Firefox 版に変換します。Firefox 固有の変更はすべて `scripts/build/build-firefox.js` にまとまっています（Service Worker の代わりのバックグラウンドスクリプト、Gecko のアドオン ID、Firefox 用ショートカット、自動ピクチャーインピクチャーのスクリプトの除外、`__firefox` 接尾辞付きのロケールメッセージによる元の文言の置き換え）。試すには `about:debugging#/runtime/this-firefox` を開き、「一時的なアドオンを読み込む」で `dist/firefox/manifest.json` を選びます。`npm run lint:firefox` で `web-ext` によるチェックができます。共有コードでは URL スキームを直接調べず `LumnoBrowserProfile.isFirefoxExtensionRuntime()` を使い、特定のブラウザ系統だけの UI には `data-browser-only="chromium"`（他では非表示）、設定項目には `data-browser-unsupported="firefox"`（無効表示で理由を示す）を付けてください。

### ディレクトリ構成

| パス | 役割 |
| --- | --- |
| `manifest.json` | Manifest V3 設定、権限、コマンド、コンテンツスクリプト、新しいタブの上書き |
| `src/background/` | Service worker の入口と `*-service.ts` の各部：コマンドルーティング、オーバーレイの表示、検索データ、サイト/AI 検索、タブスイッチャー、PiP 所有権、固定タブ復元、WebDAV 同期 |
| `src/newtab/` | 新しいタブのランタイム。機能別フォルダー `bookmarks/`、`shortcuts/`、`recent/`、`wallpaper/`、`search/`、`top-content/`、`theme/` |
| `src/overlay/` | ページ内コマンドバー（`search-panel.ts` と `panel/` の各部）、テーマ/言語同期、サイト別補正 |
| `src/content/` | ページショートカット監視、選択テキストのクイックアクション、Web Clip PiP、動画の自動 PiP |
| `src/options/` | 拡張機能の設定ページ（`options.ts` と `options-*.ts` の各部） |
| `src/onboarding/` | インストール/アップデート時のオンボーディング |
| `src/domain/` | ブラウザや DOM に触れない純粋なロジック：設定キーと正規化、ルート、検索のランキングと照合（`search/`）、favicon のルール、ショートカットと最近のサイトのストア |
| `src/platform/` | ブラウザと拡張機能 API のラッパー：ブラウザ判定、URL ガード |
| `src/shared/` | 複数の画面が共有する UI とページのランタイム：`search/`（入力と候補）、`ui/`（ツールチップ、トースト、メニューとコントロールのスタイル）、`favicon/`、プリロード |
| `src/*/react/` | 各画面の React ビュー。複数のページで使うものは `src/shared/react/` |
| `_locales/` | 拡張 UI 文言 |
| `assets/data/` | 内蔵サイト内検索とブラウザショートカットのデータ |
| `assets/wallpapers/` | 新しいタブの内蔵壁紙とサムネイル |
| `tests/` | モジュールの隣に置かないテスト：ページ全体のテスト（`tests/pages/<ページ>/`）、リポジトリとビルドのチェック（`tests/repo/`）、ブラウザのフロー（`tests/e2e/`）、共通のフェイク（`tests/fakes/`）。単体テストとコンポーネントテストは `*.test.ts(x)` としてモジュールの隣に置く |
| `scripts/` | 用途別のツール：`build/`（パッケージング）、`check/`（静的チェックと監査）、`dev/`（e2e の試作、プロファイル）、`release/`（ストア提出） |

## コントリビュート

不具合の報告、機能の提案、プルリクエストは [Issues](https://github.com/kubai087/lumno-extension/issues) で受け付けています。AI 翻訳の言語のネイティブスピーカーの方は、設定 → 一般 → 言語 → **翻訳を改善** から、気になる訳文の報告や、記入済みの翻訳シートの送信ができます。Lumno が役に立ったら、GitHub の ⭐ や Chrome ウェブストアや Firefox アドオンでのレビューで応援していただけると、より多くの人に届きます。

プルリクエストを送る前に [CONTRIBUTING.md](../.github/CONTRIBUTING.md) で開発環境、実行すべきチェック、翻訳の進め方を確認してください。新しい UI の文言は英語、簡体字中国語、繁体字中国語、日本語の 4 言語で書けば十分で、ほかの言語はメンテナーが補います。参加するすべての人は[行動規範](../.github/CODE_OF_CONDUCT.md)に従い、セキュリティの問題は [SECURITY.md](../.github/SECURITY.md) に沿って報告してください。

## クレジット

- 日本語ローカライズ：[Humi](https://github.com/Hum1Tab) さんに日本語翻訳と校正へご協力いただきました。
- macOS `Ctrl+N` / `Ctrl+P` による候補移動の実験機能：[wanghanzhen](https://github.com/wanghanzhen) さんの [PR #38](https://github.com/kubai087/lumno-extension/pull/38) での貢献に基づいています。
- 同梱アイコンセット：[Remix Icon](https://remixicon.com/) 4.9.1（GPL ではなく [Remix Icon License v1.0](../assets/remixicon/LICENSE.txt) が適用されます）
- 同梱書体：Open Sans、[LXGW WenKai](https://github.com/lxgw/LxgwWenKai)（SIL OFL 1.1、一言表示用にサブセット化）

## ライセンス

このプロジェクトは [GPL-3.0](../LICENSE) ライセンスで公開されています。同梱しているサードパーティのコード、アイコン、フォントはそれぞれのライセンスに従います。詳しくは [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) をご覧ください。
