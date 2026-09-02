import type { ChatTurn } from '@/client/hooks/useInterrogation'
import type { SessionHistory } from '@/client/lib/schemas'

/**
 * サーバに残っている聞き込みの記録を、画面が持つ会話ログの形に戻す。
 *
 * 会話ログはこれまでクライアントのメモリにしか無く、ページを開き直すと消えていた。
 * URLでプレイを指せるようになった以上、リロードや直リンクで開いても
 * 続きから話せるほうが筋が通る。
 */

/** id を振る前の1行。id は並べ終えてから位置で決めるので、組み立て中は持たない。 */
type Line = Omit<ChatTurn, 'id'>
export const restoreConversations = (history: SessionHistory): Record<string, ChatTurn[]> =>
  Object.fromEntries(
    history.histories
      // 一度も話していないNPCはキーごと作らない。空配列を置くと
      // 「話しかけたが返事が無い」と見分けがつかなくなる。
      .filter((entry) => entry.exchanges.length > 0)
      .map((entry) => [
        entry.characterId,
        entry.exchanges
          .flatMap((exchange): Line[] => {
            // 話題を持つのは、その話題で最初の往復だけ。続きの往復と、話題という
            // 考え方より前に記録された往復では null になる。
            const topic: Line[] =
              exchange.topic === null
                ? []
                : [
                    {
                      role: 'topic',
                      text: exchange.topic,
                      askedAt: exchange.askedAt,
                      notable: exchange.yielded,
                    },
                  ]

            const question: Line = {
              role: 'user',
              text: exchange.question,
              askedAt: exchange.askedAt,
            }

            // 返答が空なのは、配信の途中で閉じられた往復。空の吹き出しを置くと
            // 「いま返答を書いている」ように見えてしまうので、質問だけを残す。
            if (exchange.answer.length === 0) {
              return [...topic, question]
            }

            return [
              ...topic,
              question,
              { role: 'assistant', text: exchange.answer, askedAt: exchange.askedAt },
            ]
          })
          // 鍵は並べ終えた位置から作る。同じ話題の行は askedAt を共有するので、
          // 時刻と役割の組では重なる（`ChatTurn.id`）。
          .map((line, index) => ({ ...line, id: `${line.askedAt}:${index}` })),
      ]),
  )
