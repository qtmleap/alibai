import type { ChatTurn } from '@/client/hooks/useInterrogation'
import type { SessionHistory } from '@/client/lib/schemas'

/**
 * サーバに残っている聞き込みの記録を、画面が持つ会話ログの形に戻す。
 *
 * 会話ログはこれまでクライアントのメモリにしか無く、ページを開き直すと消えていた。
 * URLでプレイを指せるようになった以上、リロードや直リンクで開いても
 * 続きから話せるほうが筋が通る。
 */
export const restoreConversations = (history: SessionHistory): Record<string, ChatTurn[]> =>
  Object.fromEntries(
    history.histories
      // 一度も話していないNPCはキーごと作らない。空配列を置くと
      // 「話しかけたが返事が無い」と見分けがつかなくなる。
      .filter((entry) => entry.exchanges.length > 0)
      .map((entry) => [
        entry.characterId,
        entry.exchanges.flatMap((exchange): ChatTurn[] => {
          const question: ChatTurn = {
            role: 'user',
            text: exchange.question,
            askedAt: exchange.askedAt,
          }

          // 返答が空なのは、配信の途中で閉じられた往復。空の吹き出しを置くと
          // 「いま返答を書いている」ように見えてしまうので、質問だけを残す。
          if (exchange.answer.length === 0) {
            return [question]
          }

          return [question, { role: 'assistant', text: exchange.answer, askedAt: exchange.askedAt }]
        }),
      ]),
  )
