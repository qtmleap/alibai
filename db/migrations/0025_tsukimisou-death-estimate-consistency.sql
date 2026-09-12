-- 月見荘: 遺体検分の返答と死亡推定の開示条件を一致させる。
-- 既存の victim_findings（前提 Evidence UUID を含む）は保持し、所見だけを追記する。
UPDATE scenario_truths
SET victim_findings = CASE
  WHEN EXISTS (
    SELECT 1
    FROM json_each(scenario_truths.victim_findings)
    WHERE json_extract(value, '$.id') = 'postmortem-state'
  ) THEN victim_findings
  ELSE json_insert(
    victim_findings,
    '$[#]',
    json('{"id":"postmortem-state","statement":"発見時、体にはまだ温かさが残っており、死後硬直も始まりかけた段階にとどまっている。","requires":{"revelations":[],"evidences":[]}}')
  )
END
WHERE scenario_id = (
  SELECT id FROM scenarios WHERE victim_name = '高瀬涼子' LIMIT 1
);

UPDATE evidences
SET
  description = '唇のまわりと指先のしびれの跡に加え、発見時には体にまだ温かさが残り、死後硬直も始まりかけた段階にとどまっている。発見時刻と合わせると、事切れたのは20時15分ごろと推定できる。',
  reveal_condition = 'プレイヤーが遺体を調べ、検分の返答で「体にまだ温かさが残り、死後硬直も始まりかけている」という所見を実際に確認し、その所見を根拠に死亡時刻を検討したら開示する。'
WHERE scenario_id = (
  SELECT id FROM scenarios WHERE victim_name = '高瀬涼子' LIMIT 1
)
AND label = '遺体に残る中毒の徴候と、その進み具合';
