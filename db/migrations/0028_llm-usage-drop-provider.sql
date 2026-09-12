-- 宛先が OpenAI互換サーバ1つになり、anthropic / openai / google の区分が
-- 経路も設定も分けなくなったので落とす。課金の内訳はモデルID（model 列）で追える。
-- 既存行の provider 値は戻らない。列にインデックスも外部キーも無いため再構築は要らない。
ALTER TABLE `llm_usages` DROP COLUMN `provider`;
