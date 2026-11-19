# ga4crawler

## 概要

このプロジェクトは個人サイトGA4のアクセス解析情報をCloudflare D1に保存するworkerを作成するためのものです。

`wrangler.toml`の**SITE_CONFIG**に設定したGA4の情報を元に集計を行います。集計は**crons**に設定した時間で自動実行されます。

集計結果はこのプロジェクトとは別のreactサイトで表示させています。

## ライセンス

MIT

## 補足事項

Google Geminiとのチャットで仕様を詰めた上でAntigravity IDE上で実装をサポートしてもらったものです。
