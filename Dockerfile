# Dev Container のベースイメージ。
#
# 本番は Cloudflare Workers（wrangler deploy）に載せるので、実行用のコンテナイメージは
# もう作らない。ここはあくまで開発環境の土台で、bun / node / gh といった実際のツールは
# devcontainer.json の features が入れる。
FROM oven/bun:1

# devcontainer の common-utils feature が vscode ユーザーを作り、ここを workspaceFolder にする。
WORKDIR /home/vscode/app
