-- Upgrade the reviewed scenarios for investigable places and disclosed death estimates.

-- Existing scenario, character, and evidence UUIDs are preserved whenever rows already exist.

UPDATE scenarios SET places = '[{"id":"choir-access","name":"聖歌席裏の点検口","shortName":"点検口","introduction":"鐘の修復作業で使われた、聖歌席裏の設備点検口","situation":"修復用の資材札が残る、小さな点検区画"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一');

UPDATE scenario_truths SET place_findings = '[{"placeId":"choir-access","findings":[{"id":"test-line-still-present","statement":"点検口の奥に仮設試験線が残り、工事タグも撤去済みの状態にはなっていない。","requires":{"revelations":[],"evidences":[]}},{"id":"test-line-reaches-bell","statement":"仮設試験線は、鐘塔へ入らず一階側から鐘の作動確認を行える配線になっている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一');

UPDATE scenarios SET places = '[{"id":"survey-zone","name":"自動測量区画","shortName":"測量区画","introduction":"測量カートの校正と位置タグ確認を行う研究区画","situation":"カートと位置タグの充電台が壁沿いに並んでいる"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾');

UPDATE scenario_truths SET place_findings = '[{"placeId":"survey-zone","findings":[{"id":"cart-tag-fastener","statement":"測量カートの収納ベルトには、小型の位置タグを固定できる留め具と新しい擦れ跡がある。","requires":{"revelations":[],"evidences":[]}},{"id":"cart-track-overlay","statement":"端末に残るカートの走行軌跡と位置タグの軌跡は、同じ時間帯に同じ経路を通っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾');

UPDATE scenarios SET places = '[{"id":"case-archive","name":"旧捜査資料箱","shortName":"旧捜査資料","introduction":"1979年事件の調書・検視記録・現場写真をまとめた保管箱","situation":"黄ばんだ封筒と写真袋が、作成日順に綴じ直されている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '野上修一');

UPDATE scenario_truths SET place_findings = '[{"placeId":"case-archive","findings":[{"id":"original-autopsy-time","statement":"当時の検視記録には、死亡は22時05分ごろと見積もられた旨が記されている。","requires":{"revelations":[],"evidences":[]}},{"id":"original-sighting-source","statement":"事件直後の供述調書で22時30分の暖炉前目撃を自分の体験として述べているのは、一人だけである。","requires":{"revelations":[],"evidences":[]}},{"id":"old-expense-ledger","statement":"押収資料の仕入れ帳には、倉田の担当欄の金額を野上が事件当日に再確認した印が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一');

UPDATE scenarios SET places = '[{"id":"rare-vault","name":"希少資料庫","shortName":"資料庫","introduction":"貴重資料を保管する、自動施錠式の資料庫","situation":"重い扉が閉じ、廊下側には開錠用の鍵穴がある"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣');

UPDATE scenario_truths SET place_findings = '[{"placeId":"rare-vault","findings":[{"id":"self-locking-latch","statement":"扉は廊下側から開けるときだけ鍵を使い、外へ出て閉じればラッチが自動で掛かる構造になっている。","requires":{"revelations":[],"evidences":[]}},{"id":"door-contact-window","statement":"扉センサーには21時09分から21時22分まで開放が続き、その後に閉じた記録が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣');

UPDATE scenarios SET places = '[{"id":"restoration-room","name":"修復室","shortName":"修復室","introduction":"紫外線検査装置と修復用の作業台がある部屋","situation":"検査装置は停止し、作業台だけが照明に浮かんでいる"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫');

UPDATE scenario_truths SET place_findings = '[{"placeId":"restoration-room","findings":[{"id":"uv-power-gap","statement":"紫外線検査装置の履歴には、18時37分から18時51分まで電源が切れていた空白がある。","requires":{"revelations":[],"evidences":[]}},{"id":"uv-resume-time","statement":"装置は18時51分に再起動しており、その前の検査状態が連続していたわけではない。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫');

UPDATE scenarios SET places = '[{"id":"master-clock","name":"親時計盤","shortName":"親時計","introduction":"館内の展示時計と時報へ基準時刻を配る同期盤","situation":"保守扉に夕方の同期試験票が挟まれたままになっている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一');

UPDATE scenario_truths SET place_findings = '[{"placeId":"master-clock","findings":[{"id":"master-clock-offset","statement":"親時計盤の補正値は正しい時刻より十一分進む設定になっている。","requires":{"revelations":[],"evidences":[]}},{"id":"independent-security-clock","statement":"防災端末の時刻は親時計盤と別系統で、同じ瞬間を十一分早い数字で記録している。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一');

UPDATE scenarios SET places = '[{"id":"playout-room","name":"自動送出室","shortName":"送出室","introduction":"収録音源と深夜番組の放送順を管理する送出卓","situation":"深夜番組の送出キューが画面に残っている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '大門修一');

UPDATE scenario_truths SET place_findings = '[{"placeId":"playout-room","findings":[{"id":"midnight-queued-audio","statement":"午前零時の番組冒頭には、事前収録された音声ファイルが自動送出対象として登録されている。","requires":{"revelations":[],"evidences":[]}},{"id":"playout-execution-log","statement":"実行ログでは、午前零時の音声は人のマイク操作ではなく送出卓から自動再生されている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一');

UPDATE scenarios SET places = '[{"id":"badge-reader","name":"検査廊下の認証端末","shortName":"認証端末","introduction":"防護区画を通る管理バッジの認証端末","situation":"通過履歴が時刻とバッジ番号の順で表示されている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '星名悟');

UPDATE scenario_truths SET place_findings = '[{"placeId":"badge-reader","findings":[{"id":"reader-records-badge","statement":"端末が保存しているのは通過したバッジ番号で、装着者の顔や氏名を記録する機能はない。","requires":{"revelations":[],"evidences":[]}},{"id":"orange-badge-entry","statement":"21時18分には橙色の管理バッジが検査廊下を通過した記録が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟');

UPDATE scenarios SET places = '[{"id":"framing-room","name":"額装作業室","shortName":"額装室","introduction":"作品台紙の加工と搬送準備を行う作業室","situation":"清掃後の床に、細かな紙粉がまだ残っている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenario_truths SET place_findings = '[{"placeId":"framing-room","findings":[{"id":"framing-paper-traces","statement":"床に散った紙片は、その夜に荻原が確認していた作品台紙と同じ材質である。","requires":{"revelations":[],"evidences":[]}},{"id":"cart-used-again","statement":"清掃後に戻された作品搬送台車には、その後もう一度動かされた車輪跡が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenarios SET places = '[{"id":"patch-bay","name":"第2ブース監視席","shortName":"監視席","introduction":"録音入力を切り替えるパッチ盤と収録端末の席","situation":"直前の収録セッションの配線がそのまま残っている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介');

UPDATE scenario_truths SET place_findings = '[{"placeId":"patch-bay","findings":[{"id":"recorder-loop-route","statement":"第2ブースの録音入力は生マイクではなく、四十七秒の音声素材を繰り返す経路へ切り替えられている。","requires":{"revelations":[],"evidences":[]}},{"id":"waveform-identical","statement":"収録波形は空調音や小さな物音まで四十七秒ごとに同じ形を繰り返している。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介');

UPDATE scenarios SET places = '[{"id":"old-walkway","name":"旧保守歩廊","shortName":"旧歩廊","introduction":"排水区画を通り、旧制御室の接続口へ続く古い通路","situation":"現在は増水で水に覆われ、入口から先へ進めない"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenario_truths SET place_findings = '[{"placeId":"old-walkway","findings":[{"id":"walkway-connects-control","statement":"設備図と入口の表示から、この歩廊は正面扉を通らず旧制御室へ入れる接続口まで続いている。","requires":{"revelations":[],"evidences":[]}},{"id":"reddish-silt-floor","statement":"水際より手前の床には、この歩廊周辺に特有の赤褐色の堆積泥が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenarios SET places = '[{"id":"old-stairs","name":"厨房脇の旧階段","shortName":"旧階段","introduction":"二階廊下へ木の隔壁一枚で接する、普段使われない階段","situation":"古い木造の隔壁と手すりがそのまま残されている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介');

UPDATE scenario_truths SET place_findings = '[{"placeId":"old-stairs","findings":[{"id":"partition-carries-taps","statement":"手すりを軽く叩くと、木の中空隔壁を通って二階廊下側へ乾いた音がよく響く。","requires":{"revelations":[],"evidences":[]}},{"id":"cane-height-marks","statement":"隔壁には、桐谷の杖の金属部分と高さの合う新しい打痕が残っている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介');

UPDATE scenarios SET places = '[{"id":"observation-glass","name":"投影室の観察ガラス","shortName":"観察ガラス","introduction":"投影室と廊下を隔てる、大型の観察窓","situation":"閉館後の点検で投影室側の主照明が落とされている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠');

UPDATE scenario_truths SET place_findings = '[{"placeId":"observation-glass","findings":[{"id":"corridor-reflection","statement":"投影室を暗くして廊下側を明るくすると、ガラスには廊下側に立つ人物の像が強く映り込む。","requires":{"revelations":[],"evidences":[]}},{"id":"witness-position-replay","statement":"21時35分の立ち位置を再現すると、廊下にいた人物の像が投影室内の人影のように重なる。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠');

UPDATE scenarios SET places = '[{"id":"emergency-cabin","name":"非常用搬器","shortName":"非常搬器","introduction":"点検席と乗員表示センサーを備えた非常用の搬器","situation":"営業終了後の点検位置で停止している"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司');

UPDATE scenario_truths SET place_findings = '[{"placeId":"emergency-cabin","findings":[{"id":"seat-senses-weight","statement":"点検席のセンサーは人物を識別せず、一定以上の重量が掛かると「乗員1」を表示する。","requires":{"revelations":[],"evidences":[]}},{"id":"tool-case-triggers-seat","statement":"保守用工具ケースだけを点検席へ置いても、監視盤の表示は「乗員1」へ切り替わる。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司');

UPDATE scenarios SET places = '[{"id":"shaft-two-telegraph","name":"第二立坑の電信機","shortName":"第2電信","introduction":"二つの立坑を結ぶ、工事連絡用の電信機","situation":"送信キーと符号表が作業机の上に残されている"}]' WHERE id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル');

UPDATE scenario_truths SET place_findings = '[{"placeId":"shaft-two-telegraph","findings":[{"id":"sender-not-recorded","statement":"電信機と受信簿が残すのは電文と受信時刻だけで、第二立坑で誰が送信キーを操作したかは記録されない。","requires":{"revelations":[],"evidences":[]}},{"id":"mark-can-be-copied","statement":"過去の工程電文にはヘイルが使う短い末尾符号が何度も残り、作業関係者が見られる状態になっている。","requires":{"revelations":[],"evidences":[]}}]}]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル');

UPDATE scenarios SET victim_estimated_death_at = '21:05' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一');

UPDATE scenarios SET victim_estimated_death_at = '22:05' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '野上修一');

UPDATE scenarios SET victim_estimated_death_at = '05:57' WHERE id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス');

UPDATE scenarios SET victim_estimated_death_at = '20:41' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '石橋礼司');

UPDATE scenarios SET victim_estimated_death_at = '20:28' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一');

UPDATE scenarios SET victim_estimated_death_at = '21:05' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一');

UPDATE scenarios SET victim_estimated_death_at = '23:48' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '大門修一');

UPDATE scenarios SET victim_estimated_death_at = '21:08' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '星名悟');

UPDATE scenarios SET victim_estimated_death_at = '21:52' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '周文海');

UPDATE scenarios SET victim_estimated_death_at = '2026-01-15T22:10:00+09:00' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志');

UPDATE scenarios SET victim_estimated_death_at = '21:28' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一');

UPDATE scenarios SET victim_estimated_death_at = '21:08' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介');

UPDATE scenarios SET victim_estimated_death_at = '21:24' WHERE id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠');

UPDATE scenarios SET victim_estimated_death_at = '22:03' WHERE id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル');

UPDATE scenarios SET victim_investigable = 0 WHERE id = (SELECT id FROM scenarios WHERE victim_name = '野上修一');

UPDATE scenario_truths SET victim_cause_of_death = NULL, victim_findings = '[]' WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一');

UPDATE evidences
SET description = '点検口には仮設試験線がまだ接続中であることを示す工事タグが残っている。',
    reveal_condition = '玄田に聖歌席裏の点検口で見たものを尋ねるか、水城に仮設線の撤去状況を確認したら開示する。または聖歌席裏の点検口を調べ、残った工事タグと仮設線を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一') AND name = '玄田修')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一') AND name = '水城奈央')), json_object('type', 'location', 'id', 'choir-access')),
    supports = '["test-line-tag-remained","temporary-test-line-exists"]',
    contradicts = '["lie:mizuki-bell-alibi"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一')
  AND label = '聖歌席裏の工事タグ';

UPDATE evidences
SET description = '香川の位置タグと自動測量カートが、21時00分から15分まで同じ地点を同じ時刻に通過している。二つの軌跡は実質的に重なる。',
    reveal_condition = '香川、結城、新堂のいずれかに位置タグの軌跡と自動測量カートの運行を比較できないか尋ねたら開示する。または自動測量区画を調べ、カートの走行跡と位置タグの固定跡を照合したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾') AND name = '香川紗英')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾') AND name = '結城真')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾') AND name = '新堂匠')), json_object('type', 'location', 'id', 'survey-zone')),
    supports = '["locator-tag-removable","mapping-cart-auto-loop","kagawa-tag-on-cart","tag-track-matches-cart"]',
    contradicts = '["lie:kagawa-location-alibi","lie:kagawa-wore-tag"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾')
  AND label = '位置タグと自動測量カートの軌跡比較';

UPDATE evidences
SET description = '倉田の担当欄で仕入れ額が実際より増やされ、野上が事件当日に再確認の印を付けている。',
    reveal_condition = '倉田に野上と事件直前に揉めた帳簿の内容を追及したら開示する。または旧捜査資料箱を調べ、押収された仕入れ帳の該当欄を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一') AND name = '倉田恵')), json_object('type', 'location', 'id', 'case-archive')),
    supports = '["megumi-forged-expenses","nogami-found-megumi-fraud"]',
    contradicts = '["lie:megumi-no-fraud"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一')
  AND label = '仕入れ帳の水増し';

UPDATE evidences
SET description = '廊下側から開ける時だけ館長鍵が必要で、外へ出て扉を閉めるとラッチが自動で掛かる。施錠操作に鍵は不要である。',
    reveal_condition = '八神か戸塚に資料庫の鍵が開錠と施錠のどちらに必要なのか具体的に尋ねたら開示する。または希少資料庫の扉を調べ、閉じるだけで施錠されるラッチ構造を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣') AND name = '八神琴子')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣') AND name = '戸塚誠')), json_object('type', 'location', 'id', 'rare-vault')),
    supports = '["vault-key-only-opens","vault-self-locks","key-found-on-imaizumi"]',
    contradicts = '["lie:yagami-key-needed-to-lock"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣')
  AND label = '希少資料庫の自動施錠仕様';

UPDATE evidences
SET description = '装置は18時35分に起動したが、18時37分から18時51分まで停止している。',
    reveal_condition = '榊に検査を続けていた時間帯を尋ねるか、榎本に修復室の機器ログを確認できないか尋ねたら開示する。または修復室を調べ、紫外線検査装置の電源履歴を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫') AND name = '榊玲')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫') AND name = '榎本駿')), json_object('type', 'location', 'id', 'restoration-room')),
    supports = '["uv-test-started","uv-lamp-off-1837","uv-test-resumed"]',
    contradicts = '["lie:sakaki-uv-alibi"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫')
  AND label = '紫外線検査装置の電源履歴';

UPDATE evidences
SET description = '防災端末が20時19分を記録した瞬間の監視画像で、中央ホールの親時計は20時30分を示している。両系統には十一分の差がある。',
    reveal_condition = '城戸か保科に館内時計の精度と、防災端末など別系統の時計との比較を尋ねたら開示する。または親時計盤を調べ、防災端末と表示時刻を突き合わせたら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一') AND name = '城戸篤')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一') AND name = '保科悠人')), json_object('type', 'location', 'id', 'master-clock')),
    supports = '["master-clock-fast-eleven","gallery-clocks-follow-master","security-clock-accurate","half-past-chime-actual-2019"]',
    contradicts = '["lie:kido-clock-accurate","lie:shiba-late-last-seen"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一')
  AND label = '親時計と防災端末の時刻差';

UPDATE evidences
SET description = '午前零時の冒頭素材は23時53分に登録され、時刻指定で自動再生された記録が残る。',
    reveal_condition = '久世に午前零時の音声が生放送か録音かを尋ねるか、美濃部の「生だった」という説明の技術的根拠を確認したら開示する。または自動送出室を調べ、午前零時の送出キューと実行ログを確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一') AND name = '久世直人')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一') AND name = '美濃部沙耶')), json_object('type', 'location', 'id', 'playout-room')),
    supports = '["minobe-queued-recording","recorded-opening-aired"]',
    contradicts = '["lie:minobe-live-alibi"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一')
  AND label = '自動送出システムの実行ログ';

UPDATE evidences
SET description = '記録されているのは橙色バッジの通過であり、使用者の顔や氏名を直接確認した記録ではない。',
    reveal_condition = '相原か久我に21時18分の認証記録が何を識別しているのか尋ねたら開示する。または検査廊下の認証端末を調べ、記録がバッジ番号だけで使用者を識別しないと確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟') AND name = '相原誠')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟') AND name = '久我夏樹')), json_object('type', 'location', 'id', 'badge-reader')),
    supports = '["orange-badge-passed-2118","aihara-saw-orange-suit"]',
    contradicts = '["lie:sera-badge-proves-hoshina"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟')
  AND label = '二十一時十八分の認証記録';

UPDATE evidences
SET description = '清掃後の額装作業室に、荻原が確認していた作品台紙と同じ紙片が散っている。',
    reveal_condition = '朝倉に事件後の額装作業室で気づいた変化を尋ねたら開示する。または額装作業室を調べ、床の台紙片と作業台周辺の痕跡を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉') AND name = '朝倉凪')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉') AND name = '香坂澪')), json_object('type', 'location', 'id', 'framing-room')),
    supports = '["framing-paper-fibers","kosaka-killed-ogiwara-framing"]',
    contradicts = '["lie:kosaka-vault-crime"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉')
  AND label = '額装作業室の台紙片';

UPDATE evidences
SET description = '空調音や小さな物音まで含めた波形が四十七秒周期で完全一致し、同じ室内音が繰り返し再生されていたと分かる。',
    reveal_condition = '真鍋か牧村に収録ファイルが本当に生マイク入力だったか、波形の反復と入力経路を含めて尋ねたら開示する。または第2ブースの監視席を調べ、録音入力と波形の反復を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介') AND name = '真鍋伊織')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介') AND name = '牧村葉月')), json_object('type', 'location', 'id', 'patch-bay')),
    supports = '["manabe-made-roomtone-loop","loop-routed-to-recorder","recording-repeats-identically"]',
    contradicts = '["lie:manabe-booth-alibi","lie:manabe-live-input"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介')
  AND label = '四十七秒ごとに一致する収録波形';

UPDATE evidences
SET description = '正面扉とは別に、排水区画側から旧制御室へ接続する保守歩廊がある。',
    reveal_condition = '城戸に旧制御室の保守経路を尋ねるか、谷口に設備図上の接続を確認したら開示する。または旧保守歩廊を調べ、旧制御室への接続口を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也') AND name = '城戸真琴')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也') AND name = '谷口航')), json_object('type', 'location', 'id', 'old-walkway')),
    supports = '["old-walkway-connects"]',
    contradicts = '["lie:kido-impossible-entry"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也')
  AND label = '旧保守歩廊の接続図';

UPDATE evidences
SET description = '二つの区画は同じ古い中空隔壁に接し、旧階段側の硬い音が二階から聞こえることがある。',
    reveal_condition = '榊原に古い建物の音の伝わり方を尋ねるか、秋庭に旧階段で音が響くことを知っていたか確認したら開示する。または厨房脇の旧階段を調べ、隔壁の構造と音の伝わり方を確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介') AND name = '榊原蓮')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介') AND name = '秋庭澄')), json_object('type', 'location', 'id', 'old-stairs')),
    supports = '["old-partition-transmits"]',
    contradicts = '["lie:akiwa-cane-proves-alive"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介')
  AND label = '旧階段と二階廊下の中空壁';

UPDATE evidences
SET description = '投影室を暗くして廊下を明るくすると、観察ガラスには室内より廊下側の人物が強く反射する。',
    reveal_condition = '松田か小野寺に投影室消灯時の観察ガラスの見え方を具体的に尋ねたら開示する。または投影室の観察ガラスを調べ、消灯時の反射を同じ立ち位置で再現したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠') AND name = '松田圭介')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠') AND name = '小野寺莉香')), json_object('type', 'location', 'id', 'observation-glass')),
    supports = '["booth-dark-2130","glass-reflects-dark-booth","onodera-knew-reflection"]',
    contradicts = '["lie:onodera-sighting-was-inuzuka"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠')
  AND label = '観察ガラスの照明条件テスト';

UPDATE evidences
SET description = '『乗員1』は一定以上の荷重で点灯し、保守用工具ケースだけでも同じ表示になる。21時台にはそのケースが点検席へ置かれていた。',
    reveal_condition = '須藤、長峰、折原のいずれかに『乗員1』表示の検知方式と工具ケースについて尋ねたら開示する。または非常用搬器を調べ、座席センサーが重量だけを検知することと工具ケースの重さを確認したら開示する。',
    sources = json_array(json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司') AND name = '須藤拓海')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司') AND name = '長峰礼')), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司') AND name = '折原壮')), json_object('type', 'location', 'id', 'emergency-cabin')),
    supports = '["cabin-display-weight-based","tool-case-heavy-enough","sudo-left-tool-case","occupancy-display-on"]',
    contradicts = '["lie:sudo-cabin-alibi","lie:sudo-no-toolcase-seat"]',
    reveals_death_time = 0
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司')
  AND label = '非常用搬器の座席重量仕様';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '8a39e27f-c6a7-4a4b-877b-dd9267901bbc', (SELECT id FROM scenarios WHERE victim_name = '高瀬静一'), '発見時の死亡推定', '資料整理室の室温と発見時の状態を照合すると、高瀬が死亡したのは21時05分ごろと見積もられる。21時20分の鐘より前である。', '遺体を調べて発見時の状態から死亡時刻を推定するか、玄田に発見時の状態と確認内容を具体的に尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一') AND name = '玄田修'))), '["mizuki-killed-takase"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一') AND label = '発見時の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時の高瀬の状態と冷えた資料整理室の様子を確認しており、死亡は21時05分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 発見時の高瀬の状態と冷えた資料整理室の様子を確認しており、死亡は21時05分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一') AND name = '玄田修';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '59a5f86d-68fd-40fc-90b1-ae436d946355', (SELECT id FROM scenarios WHERE victim_name = '野上修一'), '1979年の検視記録', '当時の検視記録は、発見時の状態から野上の死亡を22時05分ごろと見積もっている。22時30分の暖炉前目撃より前になる。', '旧捜査資料箱を調べて当時の検視記録を確認するか、藤村に再調査で読み直した検視記録の内容を尋ねたら開示する。', json_array(json_object('type', 'location', 'id', 'case-archive'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一') AND name = '藤村達也'))), '["megumi-killed-nogami"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一') AND label = '1979年の検視記録'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '再調査で開封された旧検視記録を読み、当時の死亡推定が22時05分ごろだったことを改めて知っている。') = 0 THEN memories || char(10) || '- 再調査で開封された旧検視記録を読み、当時の死亡推定が22時05分ごろだったことを改めて知っている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '野上修一') AND name = '藤村達也';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '039f8a95-322e-49c5-abca-1a09a40a30ca', (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス'), '医療区の死亡推定', '医療センサーによる発見時の確認では、ミラの死亡は船内標準時05時57分ごろと見積もられる。区画ごとの人工時刻とは別の基準である。', '遺体を調べて医療センサーの確認値を見るか、医療担当のユナに死亡推定を船内標準時で尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス') AND name = 'ユナ・パク'))), '["sera-killed-mira"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス') AND label = '医療区の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '医療担当として発見時の状態を確認し、死亡は船内標準時05時57分ごろと見積もっている。人工昼夜表示ではなく標準時で記録した。') = 0 THEN memories || char(10) || '- 医療担当として発見時の状態を確認し、死亡は船内標準時05時57分ごろと見積もっている。人工昼夜表示ではなく標準時で記録した。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス') AND name = 'ユナ・パク';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '299254d1-c287-448f-9749-279f2e51d9c3', (SELECT id FROM scenarios WHERE victim_name = '石橋礼司'), '編集長室の死亡推定', '編集長室の室温と発見時の状態を合わせると、石橋の死亡は20時41分ごろと見積もられる。20時50分の署名時刻より前である。', '遺体を調べて発見時の状態から死亡時刻を推定するか、藤本に発見時に確認した状態と時刻について尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '石橋礼司') AND name = '藤本圭'))), '["kawase-killed-ishibashi-2041"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '石橋礼司') AND label = '編集長室の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時の石橋の状態と編集長室の室温を確認しており、死亡は20時41分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 発見時の石橋の状態と編集長室の室温を確認しており、死亡は20時41分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '石橋礼司') AND name = '藤本圭';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '7b6b0858-5fe6-4871-91ed-681914492c94', (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一'), '修復室の死亡推定', '発見時の状態を、親時計とは別系統の防災端末時刻で整理すると、倉橋の死亡は20時28分ごろと見積もられる。', '遺体を調べて発見時の状態を正しい時刻系で確認するか、保科に発見時の確認内容を防災端末の時刻基準で尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一') AND name = '保科悠人'))), '["shiba-killed-kurahashi"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一') AND label = '修復室の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時の確認内容を防災端末の正しい時刻で控えており、倉橋の死亡は20時28分ごろと見積もられると覚えている。') = 0 THEN memories || char(10) || '- 発見時の確認内容を防災端末の正しい時刻で控えており、倉橋の死亡は20時28分ごろと見積もられると覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一') AND name = '保科悠人';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '50e6108a-a8bb-42a6-87f9-6634dd053925', (SELECT id FROM scenarios WHERE victim_name = '長峰宗一'), '執務室の死亡推定', '執務室の室温と発見時の状態から、長峰の死亡は21時05分ごろと見積もられる。21時30分に見えた人影より前である。', '遺体を調べて発見時の状態を確認するか、星野に最初に執務室へ入ったときの状態と確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一') AND name = '星野結'))), '["ayase-killed-nagamine"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一') AND label = '執務室の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '最初に執務室へ入ったときの状態を覚えており、確認では長峰の死亡は21時05分ごろと見積もられていた。') = 0 THEN memories || char(10) || '- 最初に執務室へ入ったときの状態を覚えており、確認では長峰の死亡は21時05分ごろと見積もられていた。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一') AND name = '星野結';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '7ca45f6f-7b0a-4814-bd7e-23352188e911', (SELECT id FROM scenarios WHERE victim_name = '大門修一'), '第2ブースの死亡推定', '第2ブースの一定した室温と発見時の状態を合わせると、大門の死亡は23時48分ごろと見積もられる。午前零時の放送より前である。', '遺体を調べて発見時の状態を確認するか、久世にブースの室温記録と発見時の確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一') AND name = '久世直人'))), '["daimon-died-2348"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一') AND label = '第2ブースの死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '第2ブースの空調温度と発見時の状態を確認しており、死亡は23時48分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 第2ブースの空調温度と発見時の状態を確認しており、死亡は23時48分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一') AND name = '久世直人';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '89d36740-b882-4b74-91b9-08db60357d01', (SELECT id FROM scenarios WHERE victim_name = '星名悟'), '診療所の死亡推定', '診療所の検査機器で発見時の状態を確認すると、星名の死亡は21時08分ごろと見積もられる。21時18分のバッジ通過より前である。', '遺体を調べて検査機器の確認値を見るか、久我に発見時に取った検査値と死亡推定について尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟') AND name = '久我夏樹'))), '["hoshina-death-2108"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟') AND label = '診療所の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '検査担当として発見時の確認値を取り、星名の死亡は21時08分ごろと見積もられることを把握している。') = 0 THEN memories || char(10) || '- 検査担当として発見時の確認値を取り、星名の死亡は21時08分ごろと見積もられることを把握している。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟') AND name = '久我夏樹';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '78d82753-b74d-46a4-853f-e394d4a5ef4a', (SELECT id FROM scenarios WHERE victim_name = '周文海'), '当夜の検視メモ', '発見後に作られた検視メモでは、周の死亡は21時52分ごろと見積もられている。上紙へ22時05分が書き足されるより前である。', '遺体を調べて当夜の検視内容を確認するか、陳に発見後に控えた検視メモの時刻を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '周文海') AND name = '陳伯安'))), '["lin-killed-zhou"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '周文海') AND label = '当夜の検視メモ'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見後の検視内容を業務メモへ写しており、周の死亡は21時52分ごろと見積もられていたことを覚えている。') = 0 THEN memories || char(10) || '- 発見後の検視内容を業務メモへ写しており、周の死亡は21時52分ごろと見積もられていたことを覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '周文海') AND name = '陳伯安';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT 'aced8865-9f30-45b4-ab44-b6383e8519b9', (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志'), '冬夜の死亡推定', '事務室の夜間温度と発見時の状態を合わせると、佐久間の死亡は前夜22時10分ごろと見積もられる。明け方の朝仕事より大幅に早い。', '遺体を調べて発見時の状態を確認するか、久世に事務室の夜間温度と発見時の確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志') AND name = '久世圭太'))), '["fuyuki-killed-sakuma"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志') AND label = '冬夜の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '設備担当として事務室の夜間温度を把握し、発見時の確認では佐久間の死亡は前夜22時10分ごろと見積もられていたことを覚えている。') = 0 THEN memories || char(10) || '- 設備担当として事務室の夜間温度を把握し、発見時の確認では佐久間の死亡は前夜22時10分ごろと見積もられていたことを覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志') AND name = '久世圭太';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '95442215-0b1b-4d9c-bc3b-47ecf3ae38a0', (SELECT id FROM scenarios WHERE victim_name = '榊原宗一'), '執務室の死亡推定', '執務室の室温と発見時の状態から、榊原の死亡は21時28分ごろと見積もられる。21時42分のメール送信より前である。', '遺体を調べて発見時の状態を確認するか、堀江に執務室へ入ったときの状態と確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一') AND name = '堀江充'))), '["aizawa-killed-sakakibara"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一') AND label = '執務室の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時に執務室の状態を確認しており、榊原の死亡は21時28分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 発見時に執務室の状態を確認しており、榊原の死亡は21時28分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一') AND name = '堀江充';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '547221fe-b63a-41a1-a9db-094323ceae92', (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介'), '帳場奥の死亡推定', '帳場奥の室温と発見時の状態から、桐谷の死亡は21時08分ごろと見積もられる。21時25分に聞かれた杖音より前である。', '遺体を調べて発見時の状態を確認するか、榊原に発見時の室内と確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介') AND name = '榊原蓮'))), '["akiwa-killed-kiritani"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介') AND label = '帳場奥の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時の帳場奥の状態を確認しており、桐谷の死亡は21時08分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 発見時の帳場奥の状態を確認しており、桐谷の死亡は21時08分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介') AND name = '榊原蓮';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '359e693f-6852-4e3b-9453-e9261328f789', (SELECT id FROM scenarios WHERE victim_name = '犬塚誠'), '投影準備室の死亡推定', '投影準備室の温度と発見時の状態を合わせると、犬塚の死亡は21時24分ごろと見積もられる。21時35分の人影目撃より前である。', '遺体を調べて発見時の状態を確認するか、松田に投影準備室へ入ったときの状態と確認内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠') AND name = '松田圭介'))), '["inuzuka-death-2124"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠') AND label = '投影準備室の死亡推定'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '発見時の投影準備室の状態を確認しており、犬塚の死亡は21時24分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 発見時の投影準備室の状態を確認しており、犬塚の死亡は21時24分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠') AND name = '松田圭介';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT '7b4c8930-2002-410c-a66a-c0093f6a5876', (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル'), '現場の死亡推定記録', '測量室の室温と発見時の確認記録から、ヘイルの死亡は22時03分ごろと見積もられる。22時12分の電信より前である。', '遺体を調べて発見時の状態を確認するか、トーマスに測量室での発見時の状態と記録内容を尋ねたら開示する。', json_array(json_object('type', 'victim', 'id', 'victim'), json_object('type', 'character', 'id', (SELECT id FROM characters WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル') AND name = 'トーマス・リード'))), '["bell-killed-hale"]', '[]', 1
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル') AND label = '現場の死亡推定記録'
);

UPDATE characters
SET memories = CASE WHEN instr(memories, '測量室でヘイルを発見したときの状態を作業記録へ残しており、死亡は22時03分ごろと見積もられるという確認内容を覚えている。') = 0 THEN memories || char(10) || '- 測量室でヘイルを発見したときの状態を作業記録へ残しており、死亡は22時03分ごろと見積もられるという確認内容を覚えている。' ELSE memories END
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル') AND name = 'トーマス・リード';

INSERT INTO evidences (id, scenario_id, label, description, reveal_condition, sources, supports, contradicts, reveals_death_time)
SELECT 'd1324f0e-bc53-48d0-9795-0df0539242df', (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル'), '第二立坑の電信機の送信仕様', '第二立坑の送信キーは操作者を識別せず、既知の符号列を誰でも同じ形で送れる。', '第二立坑の電信機を調べ、送信者を識別する仕組みがないことと符号表を確認したら開示する。', json_array(json_object('type', 'location', 'id', 'shaft-two-telegraph')), '["telegraph-no-sender-id"]', '[]', 0
WHERE NOT EXISTS (
  SELECT 1 FROM evidences WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル') AND label = '第二立坑の電信機の送信仕様'
);
