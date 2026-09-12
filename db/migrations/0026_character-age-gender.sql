ALTER TABLE `characters` ADD `age_group` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `gender` text DEFAULT 'unknown' NOT NULL;
-- 既存の行を 'unknown' のままにするのは、書き換えるべき正しい値がどこにも無いため。
-- 年ごろと性別は今のところ personality の文章にしか書かれておらず、そこから機械的に
-- 引き当てると取り違える。'unknown' の行はキャラクターシートに出ないので、
-- これまでと同じく人物像の文章が読まれる。値は yaml へ書いて焼き直したときに入る。
