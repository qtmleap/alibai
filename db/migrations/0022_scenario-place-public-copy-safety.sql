-- Keep investigable-place list copy public and spoiler-neutral.

-- Private place findings are unchanged.

UPDATE scenarios
SET places = '[{"id":"choir-access","name":"聖歌席裏","shortName":"聖歌席裏","introduction":"鐘の修復資材が置かれた、一階の作業区画","situation":"木箱と工事用の札がまとめて置かれている"}]'
WHERE victim_name = '高瀬静一';

UPDATE scenarios
SET places = '[{"id":"rare-vault","name":"希少資料庫","shortName":"資料庫","introduction":"貴重資料を保管する、厚い防火扉の資料庫","situation":"重い扉が閉じ、廊下側には開錠用の鍵穴がある"}]'
WHERE victim_name = '今泉孝臣';

UPDATE scenarios
SET places = '[{"id":"playout-room","name":"自動送出室","shortName":"送出室","introduction":"収録音源と深夜番組の放送順を管理する送出卓","situation":"送出卓のモニターと操作盤が待機状態になっている"}]'
WHERE victim_name = '大門修一';

UPDATE scenarios
SET places = '[{"id":"badge-reader","name":"検査廊下の認証端末","shortName":"認証端末","introduction":"防護区画を通る管理バッジの認証端末","situation":"認証端末の画面が待機表示のまま残っている"}]'
WHERE victim_name = '星名悟';

UPDATE scenarios
SET places = '[{"id":"framing-room","name":"額装作業室","shortName":"額装室","introduction":"作品台紙の加工と搬送準備を行う作業室","situation":"作業台と資材棚が、閉館時のまま残されている"}]'
WHERE victim_name = '荻原直哉';

UPDATE scenarios
SET places = '[{"id":"patch-bay","name":"第2ブース監視席","shortName":"監視席","introduction":"録音入力を切り替えるパッチ盤と収録端末の席","situation":"パッチ盤と収録端末の電源が残っている"}]'
WHERE victim_name = '冬木圭介';

UPDATE scenarios
SET places = '[{"id":"old-walkway","name":"旧保守歩廊","shortName":"旧歩廊","introduction":"排水区画に残る、現在は使われていない保守通路","situation":"現在は増水で水に覆われ、入口から先へ進めない"}]'
WHERE victim_name = '峰岸達也';

UPDATE scenarios
SET places = '[{"id":"old-stairs","name":"厨房脇の旧階段","shortName":"旧階段","introduction":"厨房脇に残る、普段使われない古い木造階段","situation":"古い木造の隔壁と手すりがそのまま残されている"}]'
WHERE victim_name = '桐谷宗介';

UPDATE scenarios
SET places = '[{"id":"observation-glass","name":"投影室の観察ガラス","shortName":"観察ガラス","introduction":"投影室と廊下を隔てる、大型の観察窓","situation":"投影室と廊下のあいだを、大きな一枚ガラスが隔てている"}]'
WHERE victim_name = '犬塚誠';

UPDATE scenarios
SET places = '[{"id":"emergency-cabin","name":"非常用搬器","shortName":"非常搬器","introduction":"非常時と保守点検に使う、小型の予備搬器","situation":"営業終了後の点検位置で停止している"}]'
WHERE victim_name = '高瀬修司';

UPDATE scenarios
SET places = '[{"id":"shaft-two-telegraph","name":"第二立坑の電信機","shortName":"第2電信","introduction":"二つの立坑を結ぶ、工事連絡用の電信機","situation":"送信キーと記録用の紙束が作業机の上に残されている"}]'
WHERE victim_name = 'エドワード・ヘイル';
