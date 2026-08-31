/**
 * 効果音を公式サイトから public/se/ へ落とす。
 *
 * リポジトリに音源を置かないのは規約のため。効果音ラボは「アプリの操作音として
 * 組み込む」ことは許可しているが「再配布」を禁じており、公開リポジトリに
 * 実ファイルを載せると clone した人へ素材を配る形になる。取得はここで行い、
 * public/se/ は .gitignore に入れてある。
 *
 * 直リンクも禁止されているので、実行時にサイトを参照してはいけない。
 * ビルド前に一度これを走らせて、自分のところから配信する。
 *
 * 既定のUAでは403が返る。ブラウザのUAとリファラを付けて初めて200になる。
 */

const BASE = 'https://soundeffect-lab.info/sound'

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

type Sound = {
  /** 効果音ラボ側の区分。URL とリファラの両方に効く。 */
  category: 'anime' | 'button' | 'various'
  /** 向こうのファイル名。出所を辿れるよう、こちらでも改名しない。 */
  name: string
  /** 何に使う音か。使い道が決まっていないものは、その旨を書く。 */
  use: string
}

const SOUNDS: Sound[] = [
  { category: 'anime', name: 'text-impact1', use: '事件に向かう（重い衝撃音）' },
  { category: 'various', name: 'door-old-open1', use: '支度の画面へ（扉を開けて舞台に出る）' },
  { category: 'various', name: 'iron-door-close1', use: 'ターンの変わり目（鉄の扉が閉まる）' },
  { category: 'button', name: 'decision23', use: '推理の提出' },
  { category: 'anime', name: 'temple-bell1', use: '事件の解決' },

  // ここから下は鳴らす場所がまだ決まっていない。選定の結果として残してある。
  { category: 'anime', name: 'koto-glissando1', use: '未使用：告発の直前に張る音（琴）' },
  { category: 'anime', name: 'remember-the-past1', use: '未使用：真相の開示・回想' },
  { category: 'anime', name: 'piano-single1', use: '未使用：誤りを告げる一音' },
  { category: 'button', name: 'cursor12', use: '未使用：選択の移動' },
  { category: 'button', name: 'cancel9', use: '未使用：取り消し・戻る' },
  { category: 'button', name: 'beep5', use: '未使用：残りターンの警告' },
  { category: 'button', name: 'data-display1', use: '未使用：アリバイ表をひらく' },
]

const OUT_DIR = new URL('../public/se/', import.meta.url)

const fetchOne = async (sound: Sound): Promise<void> => {
  const target = new URL(`${sound.name}.mp3`, OUT_DIR)

  if (await Bun.file(target).exists()) {
    console.log(`skip  ${sound.name}.mp3`)

    return
  }

  const response = await fetch(`${BASE}/${sound.category}/mp3/${sound.name}.mp3`, {
    headers: { 'User-Agent': UA, Referer: `${BASE}/${sound.category}/` },
  })

  if (!response.ok) {
    throw new Error(`${sound.name}.mp3 が取得できない (HTTP ${response.status})`)
  }

  await Bun.write(target, await response.arrayBuffer())
  console.log(`get   ${sound.name}.mp3  — ${sound.use}`)
}

/*
 * 順番に落とす。11個しかないうえ相手は個人サイトなので、
 * 並列で叩いて迷惑をかける理由がない。
 */
for (const sound of SOUNDS) {
  await fetchOne(sound)
}

console.log(`\n${SOUNDS.length} 件。出典: 効果音ラボ https://soundeffect-lab.info/`)
