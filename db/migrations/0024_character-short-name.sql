ALTER TABLE `characters` ADD `short_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
-- 既存の行にはまだ短い名前が無い。空のままにすると帯から名前が消えるので、
-- フルネームを写して埋める。窮屈なのは直っていないが、表示は壊れない。
-- 短い名前そのものは、あとから yaml へ書いて焼き直す。
UPDATE `characters` SET `short_name` = `name` WHERE trim(`short_name`) = '';
