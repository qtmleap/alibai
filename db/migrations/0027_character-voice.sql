ALTER TABLE `characters` ADD `voice_seed` integer;--> statement-breakpoint
ALTER TABLE `characters` ADD `voice_caption` text;
-- 既定を置かず null のままにするのは、シードに無難な既定値が無いため。
-- 0 も正当なシードなので、埋めた値と「まだ決めていない」を区別できなくなる。
-- 両方 null の人物は喋らない。声は yaml へ書いて焼き直したときに入る。
