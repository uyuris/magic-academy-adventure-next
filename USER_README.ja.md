# magic-academy-adventure-next ユーザー向け README

この文書は、Mac/Windows 版の配布ビルドを遊ぶ人向けの説明です。
開発者向けの説明は `README.md` を参照してください。

## 重要: このゲームは日本語専用です

本作は、**日本語で遊ぶことを前提にした開発プレビュー版**です。
ゲーム内テキスト、キャラクター会話、設定説明は日本語向けです。

英語など他言語でのプレイは、現時点では対応していません。

## 重要: LM Studio がないと動作しません

本作はローカル LLM を使ったキャラクター会話を中核にしています。
そのため、**LM Studio が起動しており、指定されたモデルと設定でローカル API が動いていることが必要**です。
LM Studioへの接続はローカルホスト、もしくはローカルネットワークでの接続を想定しています。

LM Studio がない、モデルが違う、または設定が不足している場合、ゲームは正常に進行しません。

## 推奨・必須環境

### OS

- Windows 10 / Windows 11

### GPU / VRAM

- NVIDIA GPU 推奨
- **VRAM 24GB 以上が必要**
- RTX 3090 / RTX 4090 クラスを想定

24GB 未満の VRAM では、想定モデルとコンテキスト長での動作は現実的ではありません。

### LM Studio

- LM Studio をインストールしてください
- Local Server / OpenAI-compatible API を有効にしてください
- API の URL は通常 `http://127.0.0.1:1234/v1` を使用します

## LM Studio の必須設定

本作では、次の設定を前提にしています。

| 項目 | 指定 |
|---|---|
| 推奨モデル | `lmstudio-community` の Gemma 4 31B `q4_k_m` |
| ゲーム側モデル名 | 例: `gemma-4-31b-it` |
| コンテキストサイズ | `64000` |
| 評価バッチサイズ | `2048` |
| Max Concurrent Predictions | `1` |
| Unified KV Cache | 無効 |
| KV Cache Quantization | RTX 3090 / 4090 では 4bit 量子化が必須 |
| API 形式 | OpenAI-compatible API |
| API URL | `http://127.0.0.1:1234/v1` |

### RTX 3090 / RTX 4090 での注意

RTX 3090 / RTX 4090 の 24GB VRAM で動かす場合、推奨モデルは **`lmstudio-community` の Gemma 4 31B `q4_k_m`** です。
この構成では、**KV キャッシュの 4bit 量子化が必須**です。

4bit 量子化を使わずにコンテキストサイズ `64000` で動かそうとすると、VRAM が不足してモデルのロードや会話生成に失敗する可能性が高いです。

評価バッチサイズは `2048` にしてください。

また、複数の予測を同時実行すると VRAM 使用量や応答の安定性に影響するため、**Max Concurrent Predictions は `1` にしてください**。

Unified KV Cache は、このゲームの想定設定では **無効** にしてください。

## ゲーム側の LM Studio 設定

開発 repo から実行する場合、設定例は次のファイルにあります。

```text
app/config/lmstudio.example.json
```

実際に使う設定ファイルは次のパスです。

```text
app/config/lmstudio.json
```

例:

```json
{
  "provider": "lmstudio",
  "base_url": "http://127.0.0.1:1234/v1",
  "chat_model": "gemma-4-31b-it",
  "reflection_model": "gemma-4-31b-it",
  "timeout_ms": 120000,
  "stream": true,
  "mock_provider_enabled": true
}
```

配布版では、ゲーム内の設定画面から LM Studio 接続設定を保存できる場合があります。
ただし、LM Studio 側のモデルロード、コンテキストサイズ、KV キャッシュ設定は LM Studio 側で行う必要があります。

## 起動前チェック

ゲームを起動する前に、次を確認してください。

1. LM Studio を起動している
2. `lmstudio-community` の Gemma 4 31B `q4_k_m` をロードしている
3. Context Size が `64000` になっている
4. Evaluation Batch Size / 評価バッチサイズが `2048` になっている
5. RTX 3090 / 4090 の場合、KV Cache Quantization が 4bit になっている
6. Max Concurrent Predictions が `1` になっている
7. Unified KV Cache が無効になっている
8. Local Server / OpenAI-compatible API が起動している
9. API URL が `http://127.0.0.1:1234/v1` になっている
10. ゲーム側のモデル名が LM Studio 側のモデル名と一致している

## Windows インストーラーについて

Windows 版は NSIS 形式のインストーラーとして配布される場合があります。

インストーラーが未署名の場合、Windows SmartScreen やブラウザが警告を表示することがあります。
これは、配布元や署名の信頼情報がまだ蓄積されていないためです。

警告が出る場合は、配布元、ファイル名、チェックサム、リリースノートを確認してから実行してください。

## トラブルシューティング

### ゲームが会話で止まる / 進まない

LM Studio が正しく起動していない可能性があります。

確認してください。

- LM Studio の Local Server が起動しているか
- API URL が `http://127.0.0.1:1234/v1` か
- ゲーム側の `chat_model` / `reflection_model` が LM Studio 側のモデル名と一致しているか
- モデルがロード完了しているか
- VRAM が不足していないか

### モデルロードに失敗する / 生成が極端に遅い

VRAM または KV キャッシュ設定が原因の可能性があります。

- VRAM 24GB 以上の GPU を使っているか
- `lmstudio-community` の Gemma 4 31B `q4_k_m` を使っているか
- Context Size が `64000` か
- Evaluation Batch Size / 評価バッチサイズが `2048` か
- RTX 3090 / 4090 では KV Cache Quantization が 4bit か
- Max Concurrent Predictions が `1` か
- Unified KV Cache が無効か

### API 接続エラーが出る

LM Studio の Local Server 設定を確認してください。

- OpenAI-compatible API が有効か
- ポートが `1234` か
- `http://127.0.0.1:1234/v1` にアクセスできるか
- セキュリティソフトやファイアウォールが localhost 通信を妨げていないか

## 生成AI素材について

本作には、生成AIを用いて制作した画像素材が含まれます。

リポジトリや配布物が公開されていても、ゲーム内の画像・素材・キャラクター素材の再利用を許可するものではありません。
素材の扱いについては `assets/README.md` も参照してください。

## ライセンスと再利用

このプロジェクトは、現時点では **All Rights Reserved** の方針です。

- コードのライセンス: `LICENSE` を参照
- アセットの扱い: `assets/README.md` を参照
- リポジトリの閲覧可能性は、コードや素材の再利用許可を意味しません

## 現在の位置づけ

このゲームは、完成品リリースではなく、**開発プレビュー版**です。

特に次の点に注意してください。

- 日本語専用です
- LM Studio と高性能 GPU が必要です
- ローカル LLM の設定に強く依存します
- 未署名インストーラーでは Windows の警告が出る場合があります
- 仕様やセーブデータ形式は今後変わる可能性があります
