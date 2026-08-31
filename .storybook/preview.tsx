import type { Preview } from '@storybook/react-vite'
import '../src/client/index.css'

/**
 * 画面は墨の地の上でしか成立しない。明るい地に置くと、顔料の明度差が
 * 全部ひっくり返って別の絵になる。だから背景は切り替えさせず、墨で固定する。
 */
const preview: Preview = {
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="min-h-dvh bg-sumi font-gothic text-kinari">
        <Story />
      </div>
    ),
  ],
}

export default preview
