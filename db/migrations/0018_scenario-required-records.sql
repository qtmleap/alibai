-- Backfill timeline record labels required by the current authoring guide.
-- Only timeline_events[].record is changed; scenario/character UUIDs remain untouched.

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '伝言紙')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '早瀬隆司');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '工事タグ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬静一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '席別得点表')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '塚本誠');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '青席の得点')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '塚本誠');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '軌跡比較')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '位置履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '位置履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '岩代圭吾');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '点検記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '篠宮亮');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '署名記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '篠宮亮');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '乗降記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '柴田功');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '点呼表')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '柴田功');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '制御盤ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '神谷宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '復旧ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '神谷宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '扉記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '扉記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '予備開錠記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '今泉孝臣');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '扉状態記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '磯崎章');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '扉状態記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '磯崎章');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '装置電源履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '装置電源履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[7].record', '装置電源履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鳥羽薫');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '区画昼夜表')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '区画昼夜表')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ミラ・ヴォス');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '水道メーター')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '木島祥子');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', 'ミスト作動記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '木島祥子');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '印刷履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '石橋礼司');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '同期試験票')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '防災端末記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '床の移動跡')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '衣紋掛けの上着')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '長峰宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '運行記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '藤崎正雄');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '印刷履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '藤崎正雄');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '通信記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エレナ・ヴァルガ');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[7].record', '自動送出ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '大門修一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '同期ずれ記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '牧瀬航');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '入室履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '牧瀬航');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '整備時刻メモ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '牧瀬航');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '認証記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '星名悟');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[8].record', '受付')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '水野英治');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '搬出伝票')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '周文海');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '積雪層')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '青沼卓');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '除雪作業記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '青沼卓');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '無傷の雪面')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '青沼卓');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '撮影設定')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '神崎遼');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '朝飼い作業板')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '佐久間隆志');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '台紙片')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '台車の使用跡')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '作業着の台紙粉')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '環境管理記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '荻原直哉');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', 'ループ素材')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '収録ファイル')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '冬木圭介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '調光卓履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '瀬尾雅人');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', 'キュー履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '瀬尾雅人');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', 'キュー履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '瀬尾雅人');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '給餌設定')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '江波慎吾');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '給餌作動記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '江波慎吾');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '水位記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '作業靴の泥')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '水位記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '当直日誌')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '峰岸達也');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '作成記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '予定送信設定')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '送信記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '榊原宗一');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '封鎖確認票')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋徹');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[2].record', '計測記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋徹');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '封鎖確認票')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '倉橋徹');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[4].record', '物入れの杖')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '桐谷宗介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '点検表')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '犬塚誠');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '消失確認メモ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '瀬尾俊');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '甲板メモ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '瀬尾俊');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '閲覧卓の位置')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '鷺沢修');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '工具ケース')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '乗員表示')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '乗員表示')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬修司');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[8].record', '飲みかけのグラス')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '高瀬涼子');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', 'ジョブ登録履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '真田啓介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '搬入用ラッチ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '真田啓介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '実行ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '真田啓介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[0].record', '飛行モード履歴')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '芳賀俊介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[1].record', '飛行ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '芳賀俊介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[6].record', '飛行ログ')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = '芳賀俊介');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[3].record', '当直帳')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'ロレンツォ・ヴァーレ');

UPDATE scenario_truths
SET timeline_events = json_set(timeline_events, '$[5].record', '受信記録')
WHERE scenario_id = (SELECT id FROM scenarios WHERE victim_name = 'エドワード・ヘイル');
