/*
 * モックを動かすための足場。画面の意匠ではない。
 *
 * file:// で開くので import も fetch も使えない（CORS で落ちる）。素の <script> で読み、
 * window.Mock に置く。データは _case.js が window.CASE に置いたものを使う。
 *
 * 各画面は location.hash で状態を受け取る。たとえば
 *   interrogation.html#turn=9
 * ハッシュが無ければ、その画面らしい既定の状態で描く——一枚だけ開いて撮ったときに
 * 白紙にならないため。
 */

;(() => {
  var C = window.CASE

  // ---- 顔料 ----
  // 机は --asagi-t、端末は --asagi-fg と、明るい側の名前が違う。読み手側で吸収する。
  var probe = getComputedStyle(document.documentElement)
  var LIT = probe.getPropertyValue('--asagi-t').trim() ? '-t' : '-fg'

  /*
   * 話を聞く相手と、調べる相手を同じ袋に入れる。遺体も場所も喋らないが、
   * 手を向ける先としては人物と同じ扱いなので、引く場所を分けると
   * 画面ごとに「どっちの袋を見るか」の分岐が増える。
   */
  var PLACES = C.places === undefined ? [] : C.places
  var CAST_BY_KEY = {}
  C.cast.concat([C.victim], PLACES).forEach((p) => {
    CAST_BY_KEY[p.key] = p
  })

  /** 喋らない相手か。訊くのではなく調べることになる。 */
  var examines = (key) => key === C.victim.key || PLACES.some((p) => p.key === key)

  // ---- 時刻 ----
  var toMin = (hhmm) => {
    var parts = String(hhmm).split(':')
    return Number(parts[0]) * 60 + Number(parts[1])
  }
  var SPAN = { from: toMin(C.span.from), to: toMin(C.span.to) }
  SPAN.len = SPAN.to - SPAN.from

  // 机の表は 60分 = 600px で固定。伸縮させると目盛りの間隔が画面ごとに変わる。
  var PX_PER_MIN = 10

  // 10分ごとの目盛り。表と突き合わせで同じものを使う。
  var TICKS = Array.from({ length: SPAN.len / 10 + 1 }, (_, i) => i * 10)

  var topOf = (at) => (toMin(at) - SPAN.from) * PX_PER_MIN

  /*
   * 刻限の印（docs/design/deadline-window.md）。
   *
   * 遺体発見は事件の記録に書いてある公開情報なので常に実線で出す。死亡推定のほうは
   * 手に入れた確度で描き分ける——同じ 18:50 でも、探偵が検死して出した数字と、
   * 居合わせた誰かがそう言っているだけの数字は別物なので。
   *
   * 面は塗らない。窓は両端に返しの付いた線で示す。塗ると容疑者の帯と競う。
   */
  var deathMarks = (name) => {
    var state = C.death[name] === undefined ? C.death.unknown : C.death[name]
    var line = (top, cls, label, time) =>
      '<span class="deadline' +
      (cls ? ' ' + cls : '') +
      '" style="top:' +
      top +
      'px"><span>' +
      label +
      '　<span class="t">' +
      time +
      '</span></span></span>'
    var win = (top, height, cls, label, time, style) =>
      '<span class="window' +
      (cls ? ' ' + cls : '') +
      '" style="top:' +
      top +
      'px;height:' +
      height +
      'px' +
      (style || '') +
      '"><span>' +
      label +
      '　<span class="t">' +
      time +
      '</span></span></span>'

    var html = line(topOf(C.found), '', '遺体発見', C.found)
    var top = state.from === undefined ? 0 : topOf(state.from)
    var who = state.by === undefined ? undefined : CAST_BY_KEY[state.by]

    if (state.kind === 'fixed') {
      return html + line(topOf(state.at), '', '死亡推定', state.at)
    }

    if (state.kind === 'range') {
      return html + win(top, topOf(state.to) - top, '', '死亡推定', state.from + '–' + state.to)
    }

    if (state.kind === 'claimed') {
      return (
        html +
        line(topOf(state.at), 'claimed', '死亡推定', '? ' + state.at) +
        '<span class="by" style="top:' +
        topOf(state.at) +
        'px;color:var(--' +
        who.hue +
        LIT +
        ')">' +
        esc(who.short) +
        'の見立て</span>'
      )
    }

    // 不明。どこか一点を指せないので、分かっている幅ぜんぶを点線の窓で囲う。
    return html + win(0, topOf(C.found), 'unknown', '死亡推定', '?')
  }

  /*
   * 罫と左の目盛り。アリバイ表と結果の突き合わせで同じ格子を敷くので、
   * 二度書かない——片方だけ直したときに、同じはずの表が食い違う。
   */
  var gridAndGutter = () =>
    TICKS.map((m) => '<span class="grid" style="top:' + m * PX_PER_MIN + 'px"></span>').join('') +
    '<span class="gut">' +
    TICKS.map(
      (m) =>
        '<span class="at' +
        (m === 0 || m === SPAN.len ? ' edge' : '') +
        '" style="top:' +
        m * PX_PER_MIN +
        'px">' +
        hhmm(SPAN.from + m) +
        '</span>',
    ).join('') +
    '</span>'

  // ---- ハッシュの読み取り ----
  var params = {}
  String(location.hash.replace(/^#/, ''))
    .split('&')
    .forEach((pair) => {
      if (!pair) return
      var kv = pair.split('=')
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv.length > 1 ? kv[1] : '1')
    })

  var esc = (s) =>
    String(s).replace(
      /[&<>"]/g,
      (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch],
    )

  /*
   * 台本の地の文にだけ使う印。<tm fuji>六時二十三分</tm> を、その人の顔料で染めた
   * 時刻に変える。確定した時刻は、喋っている人ではなく「その時刻が立つ列」の色を持つ。
   */
  var marks = (line) =>
    String(line).replace(
      /<tm ([a-z]+)>(.*?)<\/tm>/g,
      (_, hue, text) =>
        '<span class="tm" style="color:var(--' + hue + LIT + ')">' + text + '</span>',
    )

  // ---- 通しの一回分 ----
  /*
   * 聞き込みの順番を一本に決めておく。turn=n で「n問目まで訊いた状態」になる。
   * 9問目で食い違いが立ち、10問目でそれを牧野に当てる——という運びを持たせてある。
   */
  var PLAY = [
    { who: 'makino', i: 0 },
    { who: 'makino', i: 1 },
    { who: 'makino', i: 2 },
    { who: 'kuroda', i: 0 },
    { who: 'kuroda', i: 2 },
    { who: 'kuroda', i: 1 },
    { who: 'sena', i: 0 },
    { who: 'sena', i: 1 },
    { who: 'sena', i: 3 },
    { who: 'makino', i: 4 },
    { who: 'kuroda', i: 3 },
    { who: 'sena', i: 2 },
    // 遺体の検分もターンを1つ使う。人に訊くか現場を見るかは、同じ財布から出る。
    { who: 'mizuno', i: 0 },
    { who: 'choba', i: 0 },
    { who: 'oku', i: 0 },
  ]

  /*
   * turn は台本の何手目か。who は支度から渡された相手で、あれば優先する。
   * 「〇〇を調べる」と書いてある口から入って別の相手が開くと、選んだ意味が無い。
   *
   * 相手を探すために play を何度も呼ぶ画面があるので（端末の切り替え）、
   * 上書きは呼び出し側が明示したときだけにする。ハッシュをここで読むと、
   * その探索まで巻き添えで同じ相手を返すようになる。
   */
  var play = (turn, who) => {
    var n = Math.max(0, Math.min(PLAY.length, turn))
    var segs = []
    var log = []
    var clash = false
    PLAY.slice(0, n).forEach((beat, k) => {
      const step = C.script[beat.who][beat.i]
      log.push({ me: true, text: step.q })
      log.push({ who: beat.who, lines: step.lines, last: k === n - 1 })
      step.reveals.forEach((r) => {
        segs.push(r)
      })
      if (step.clash) clash = true
    })
    return {
      turn: n,
      segments: segs,
      log: log,
      clash: clash,
      current:
        who !== undefined && CAST_BY_KEY[who] !== undefined
          ? who
          : n > 0
            ? PLAY[n - 1].who
            : C.cast[0].key,
      /*
       * 次に訊けそうなこと。台本の先読みなので、残りが無ければ空。
       * 最後の一手では先読みが自分自身に当たるので、重なった分は落とす——
       * 同じ問いが二行並ぶと、選べる道が二つあるように見えてしまう。
       */
      hints:
        n < PLAY.length
          ? [C.script[PLAY[n].who][PLAY[n].i].q, hintAlt(n)].filter(
              (q, i, all) => all.indexOf(q) === i,
            )
          : [],
    }
  }

  var hintAlt = (n) => {
    var beat = PLAY[Math.min(PLAY.length - 1, n + 1)]
    return C.script[beat.who][beat.i].q
  }

  // ---- 机のアリバイ表 ----
  var chartHead = (opts) => {
    var cols = C.cast.concat([C.victim])
    var html = '<span></span>'
    cols.forEach((p) => {
      var on = opts.active === p.key
      var role = on && opts.activeLabel ? opts.activeLabel : opts.roleOf ? opts.roleOf(p) : p.role
      html +=
        '<span class="c' +
        (on ? ' now' : '') +
        '" style="color:var(--' +
        p.hue +
        LIT +
        ')" data-mock-id="ALI_INT_12" data-who="' +
        p.key +
        '">' +
        '<span class="who">' +
        esc(p.name) +
        '</span><span class="rl' +
        (opts.okOf && opts.okOf(p) ? ' ok' : '') +
        '">' +
        esc(role) +
        '</span></span>'
    })
    return html
  }

  var chart = (opts) => {
    var segs = opts.segments
    var html = gridAndGutter()

    C.cast.concat([C.victim]).forEach((p) => {
      var on = opts.active === p.key
      html +=
        '<span class="col' + (on ? ' now' : '') + '" style="color:var(--' + p.hue + LIT + ')">'
      segs
        .filter((s) => s.who === p.key)
        .forEach((s) => {
          var top = (toMin(s.from) - SPAN.from) * PX_PER_MIN
          var h = (toMin(s.to) - toMin(s.from)) * PX_PER_MIN
          var solid = s.kind === 'solid'
          // 会話のなかでいま指している時刻と対になっている目盛りだけ、太らせる。
          var lit = solid && opts.litFix && s.fix === opts.litFix
          html +=
            '<span class="bar ' +
            (solid ? 'solid' : 'claim') +
            (lit ? ' on' : '') +
            '" style="top:' +
            top +
            'px; height:' +
            h +
            'px; ' +
            (solid ? 'background:var(--' + p.hue + ')' : 'color:var(--' + p.hue + ')') +
            '">' +
            '<span class="pl">' +
            esc(s.place) +
            '</span>' +
            (s.fix ? '<span class="fix">' + esc(s.fix) + '</span>' : '') +
            '</span>'
        })
      html += '</span>'
    })

    html += deathMarks(opts.death)

    /*
     * 食い違い。噛み合わない二人の列のあいだに一本だけ架ける。
     * 表の上でひとつだけの印なので、条件が揃うまで出さない。
     *
     * 誰と誰かと何時かは C.clash が持つ。ここが出すのは「何列目と何列目か」だけで、
     * px は CSS の側（--gut-w / --col-n / --bar-mid）が列の実寸から出す——
     * 幅を焼き込むと、人数や列幅が変わったときに線だけが元の場所に残る。
     *
     * 両端の目盛りは線の子にしない。親は draw で scaleX(0) から伸びるので、
     * 中に入れると引いているあいだ目盛りまで一緒に潰れて走って見える。
     */
    if (opts.clash) {
      const cols = C.cast.concat([C.victim])
      const ends = C.clash.between.map((key) => ({
        col: cols.findIndex((p) => p.key === key),
        hue: CAST_BY_KEY[key].hue,
      }))
      const ct = (toMin(C.clash.at) - SPAN.from) * PX_PER_MIN
      html +=
        '<span class="clash" style="top:' +
        ct +
        'px; --clash-a:' +
        ends[0].col +
        '; --clash-b:' +
        ends[1].col +
        '" data-mock-id="ALI_INT_14"><span>' +
        esc(C.clash.label) +
        '</span></span>' +
        ends
          .map(
            (e) =>
              '<i class="cpin" style="top:' +
              ct +
              'px; --clash-col:' +
              e.col +
              '; color:var(--' +
              e.hue +
              LIT +
              ')"></i>',
          )
          .join('')
    }
    return html
  }

  // ---- 端末の時刻軸 ----
  var rail = (opts) => {
    var segs = opts.segments
    var html =
      '<span class="cap label t">' +
      C.span.from +
      '</span><span class="cap2 label t">' +
      C.span.to +
      '</span>' +
      '<span class="line"></span>'
    var last = null
    segs.forEach((s) => {
      var r = pct(s.fix ? s.fix.split('　')[0] : s.from) / 100
      var p = CAST_BY_KEY[s.who]
      // 帯は左右 10px の余白の内側に引かれている。% だけで置くと線からずれる。
      var at = 'calc(10px + (100% - 20px) * ' + r.toFixed(3) + ')'
      html +=
        '<span class="pin' +
        (s.kind === 'solid' ? '' : ' hollow') +
        '" style="left:' +
        at +
        '; background:var(--' +
        p.hue +
        ')"></span>'
      if (s.kind === 'solid') last = at
    })
    if (last) html += '<span class="now" style="left:' + last + '"></span>'
    // 刻限は帯の一部。机の chart が deathMarks を内から呼ぶのと同じ扱いにする。
    return html + railDeath(opts.death, 10)
  }

  // 帯のなかでの位置。端末側は px ではなく % で置く（幅が端末に依るため）。
  var pct = (hhmm) => ((toMin(hhmm) - SPAN.from) / SPAN.len) * 100

  /*
   * 端末の刻限の印（docs/design/deadline-window.md）。
   *
   * 描き分ける四状態は机（deathMarks）と同じで、変えるのは向きだけ。机は時刻が上から下へ
   * 流れるので横一本の線になるが、端末は左から右なので縦の目盛りになる。一点を指す印
   * （遺体発見・確定・第三者の見立て）は帯を縦に貫き、幅を持つ印（範囲・不明）は両端に
   * 返しの付いた線を帯の下へ渡す。塗らないのは机と同じ理由で、面を足すと容疑者の帯と競う。
   *
   * inset は器が持つ左右の余白。聞き込みの帯（.rail）は 10px 内側に線を引いているので、
   * % だけで置くと印が線からずれる（.pin が同じ手当てをしている）。告発の拡大軸は 0。
   */
  var railDeath = (name, inset) => {
    var state = C.death[name] === undefined ? C.death.unknown : C.death[name]
    var pad = inset === undefined ? 0 : inset
    var at = (p) =>
      'calc(' + pad + 'px + (100% - ' + pad * 2 + 'px) * ' + (p / 100).toFixed(4) + ')'
    var wide = (p) => 'calc((100% - ' + pad * 2 + 'px) * ' + (p / 100).toFixed(4) + ')'

    /*
     * 札は印の子にしない。印は帯を貫く縦線、札は帯の下の一段と、縦の置き場所が別なので、
     * 器（.rail と .rail-big）ごとの深さを CSS の側で決められるようにしておく。
     *
     * 揃え方で、指しているのが一点か幅かを言い分ける。一点の印は札の右端を印に合わせ
     * （机の札が線の左に付くのと同じ）、窓の札は幅の真ん中へ置く。
     * 端末は 390px しかないので、印が端に寄れば札は零れる。零れる側では折り返す——
     * 遺体発見の 19:15 は軸の 92% に立つので、右端を揃えないと画面の外へ出る。
     */
    var lb = (p, label, time, tail, mid) =>
      '<span class="lb' +
      (p < 24 ? ' start' : mid && p < 72 ? '' : ' end') +
      '" style="left:' +
      at(p) +
      '">' +
      label +
      '　<span class="t">' +
      time +
      '</span>' +
      (tail === undefined ? '' : tail) +
      '</span>'

    var tick = (p, cls) =>
      '<span class="deadline' + (cls ? ' ' + cls : '') + '" style="left:' + at(p) + '"></span>'

    var win = (from, to, cls, time) => {
      var a = pct(from)
      var b = pct(to)
      return (
        '<span class="window' +
        (cls ? ' ' + cls : '') +
        '" style="left:' +
        at(a) +
        ';width:' +
        wide(b - a) +
        '"></span>' +
        lb((a + b) / 2, '死亡推定', time, undefined, true)
      )
    }

    var html = tick(pct(C.found)) + lb(pct(C.found), '遺体発見', C.found)
    var who = state.by === undefined ? undefined : CAST_BY_KEY[state.by]

    if (state.kind === 'fixed') {
      return html + tick(pct(state.at)) + lb(pct(state.at), '死亡推定', state.at)
    }

    if (state.kind === 'range') {
      return html + win(state.from, state.to, '', state.from + '–' + state.to)
    }

    if (state.kind === 'claimed') {
      /*
       * 誰の見立てかは、机では線の下へ別の一行として添えてある。端末にはその一段が無いので
       * 同じ札の尾に続ける——顔料はその人のものなので、続けても言い分の出どころは残る。
       */
      return (
        html +
        tick(pct(state.at), 'claimed') +
        lb(
          pct(state.at),
          '死亡推定',
          '? ' + state.at,
          '<span class="by" style="color:var(--' +
            who.hue +
            LIT +
            ')">' +
            esc(who.short) +
            'の見立て</span>',
        )
      )
    }

    // 不明。どこか一点を指せないので、分かっている幅ぜんぶを点線の窓で囲う。
    return html + win(C.span.from, C.found, 'unknown', '?')
  }

  /*
   * 端末の告発で使う、拡大した時刻軸。
   * 一人一段。裏付けのある区間は濃く、申告だけの区間は薄く敷く——
   * 机の実線／破線と同じ区別を、線の太さではなく濃さで言い換えている。
   */
  var railBig = (opts) => {
    var segs = opts.segments
    var html = ''
    C.cast.forEach((p, i) => {
      html +=
        '<div class="lane" style="top:' +
        (12 + i * 32) +
        'px"><span class="who" style="color:var(--' +
        p.hue +
        LIT +
        ')">' +
        esc(p.short) +
        '</span>'
      segs
        .filter((s) => s.who === p.key)
        .forEach((s) => {
          var left = pct(s.from)
          html +=
            '<span class="seg' +
            (s.kind === 'solid' ? '' : ' gap') +
            '" style="left:' +
            left.toFixed(1) +
            '%; width:' +
            (pct(s.to) - left).toFixed(1) +
            '%; background:var(--' +
            p.hue +
            ')"></span>'
        })
      html += '</div>'
    })

    // 掴んで動かす目盛り。指した時刻がひとつだけ朱で立つ。
    if (opts.at) {
      html +=
        '<span class="mark" style="left:' +
        pct(opts.at).toFixed(1) +
        '%"><span class="at">' +
        opts.at +
        '</span></span>'
    }

    // 刻限の印。段の下、軸の上に置く（_phone.css の .rail-big .lb）。
    html += railDeath(opts.death, 0)

    /*
     * 軸の両端だけ。ここには死亡推定を焼き込まない——盤面が最初から知っていることになる。
     * 刻限は上の印が、手に入れた確度のぶんだけ言う。
     */
    html +=
      '<div class="axis"><span class="t label">' +
      C.span.from +
      '</span><span class="t label">' +
      C.span.to +
      '</span></div>'
    return html
  }

  /*
   * 端末の結果で使う突き合わせ。真相を線の上、自分の指した時刻を下に置く。
   * 同じ位置に重なれば当たり、離れていればその隔たりがそのまま外し具合になる。
   */
  /*
   * 真相の時刻と、自分が指した時刻。
   * opts.truth を渡さなければ、自分の指した一本だけを引く——迷宮入りの回では
   * この一本が真相を漏らす経路になるので、線ごと出さない。
   */
  var cmp = (opts) =>
    '<span class="line"></span>' +
    (opts.truth
      ? '<span class="m truth" style="left:' +
        pct(opts.truth).toFixed(1) +
        '%"><span class="lb">真相 ' +
        opts.truth +
        '</span></span>'
      : '') +
    '<span class="m mine" style="left:' +
    pct(opts.mine).toFixed(1) +
    '%"><span class="lb">指した ' +
    opts.mine +
    '</span></span>'

  // ---- 会話 ----
  var log = (turns) =>
    turns
      .map((t) => {
        if (t.me) {
          return (
            '<div class="turn me" data-mock-id="ALI_INT_07"><span class="who">探偵</span>' +
            '<p class="txt">' +
            esc(t.text) +
            '</p></div>'
          )
        }
        var p = CAST_BY_KEY[t.who]
        /*
         * 遺体と場所の欄は名前を出さず「所見」にする。
         * 名前を出すと、死んだ人や部屋が証言しているように読める。
         */
        var label = examines(t.who) ? '所見' : p.name
        var body = t.lines
          .map((line, i) => {
            var tail = t.last && i === t.lines.length - 1 ? '<span class="beat">▼</span>' : ''
            return '<p class="txt">' + marks(line) + tail + '</p>'
          })
          .join('')
        return (
          '<div class="turn" style="border-left-color:var(--' +
          p.hue +
          ')" data-mock-id="ALI_INT_07">' +
          '<span class="who" style="color:var(--' +
          p.hue +
          LIT +
          ')">' +
          esc(label) +
          '</span>' +
          body +
          '</div>'
        )
      })
      .join('')

  // ---- 結果の突き合わせ（同じ列に、申告と実際を二本） ----
  var compare = () => {
    var html = gridAndGutter()

    var mine = play(PLAY.length).segments
    C.cast.concat([C.victim]).forEach((p) => {
      html += '<span class="col" style="color:var(--' + p.hue + LIT + ')">'
      mine
        .filter((s) => s.who === p.key && s.kind === 'solid')
        .forEach((s) => {
          var top = (toMin(s.from) - SPAN.from) * PX_PER_MIN
          html +=
            '<span class="bar mine" style="top:' +
            top +
            'px; height:' +
            (toMin(s.to) - toMin(s.from)) * PX_PER_MIN +
            'px"></span>'
        })
      C.truth.real
        .filter((s) => s.who === p.key)
        .forEach((s) => {
          var top = (toMin(s.from) - SPAN.from) * PX_PER_MIN
          var h = (toMin(s.to) - toMin(s.from)) * PX_PER_MIN
          html +=
            '<span class="bar real" style="top:' +
            top +
            'px; height:' +
            h +
            'px; background:var(--' +
            p.hue +
            ')"></span>'
          if (s.note) {
            /*
             * 二本がずれた区間にだけ言葉を足す。列は 108px しかないので、ここ以外には書かない。
             * 見るのは「この実線と重なっている申告の線」だけ。その人の線すべてから
             * 最大の終わりを取ると、離れた後半の線（牧野なら 19:08 の郵便窓口）を拾って
             * 区間が一点に潰れ、註が死亡推定の線の上に落ちる。
             */
            const overlapEnd = mine
              .filter((m) => m.who === p.key && m.kind === 'solid')
              .filter((m) => toMin(m.from) < toMin(s.to) && toMin(m.to) > toMin(s.from))
              .reduce((acc, m) => Math.max(acc, Math.min(toMin(m.to), toMin(s.to))), toMin(s.from))
            const gapTop = (overlapEnd - SPAN.from) * PX_PER_MIN
            html +=
              '<span class="gapnote" style="top:' +
              gapTop +
              'px; height:' +
              (top + h - gapTop) +
              'px">' +
              s.note +
              '</span>'
          }
        })
      html += '</span>'
    })

    var dl = (toMin(C.deadline.at) - SPAN.from) * PX_PER_MIN
    html +=
      '<span class="deadline" style="top:' +
      dl +
      'px"><span>死亡　<span class="t">' +
      C.deadline.at +
      '</span></span></span>'
    return html
  }

  /*
   * 経過時間。ターン数から作った見せかけで、計っているわけではない。
   * 12ターンで 10 分弱に収まる速さにしてある——一覧が「約10分」と言っている以上、
   * 画面の時計だけ 26 分を指していては辻褄が合わない。
   */
  var clock = (turn) => {
    var sec = turn * 47 + 13
    return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0')
  }

  var hhmm = (min) => {
    var h = Math.floor(min / 60)
    var m = min % 60
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m
  }

  /*
   * 記録の読み上げ。
   *
   * 一字ずつ現し、書いている先が器の底に着いたらせり上げる。読み上げという名前の
   * 画面なのに全文が最初から出ていて、しかも長いと最後の段落が霞の下へ潜ったまま
   * 取り出せなかった。器を送るのは書いている先を追うためで、演出のためではない。
   *
   * 中身は innerHTML を一度組んでから、テキストノードだけを空にして戻していく。
   * 一文字ずつ足し算で組み立てると <em> のような印が壊れる。
   *
   * #done=1 と「動きを控える」設定では最初から全文を出す。storyboard の一覧や
   * 画面の撮影で、毎回ちがう途中経過が写らないように。
   */
  var readOut = (el, html, opts = {}) => {
    el.innerHTML = html
    var scroller = opts.scroller === undefined ? el : opts.scroller

    var parts = []
    var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null)
    var node = walk.nextNode()
    for (; node; node = walk.nextNode()) {
      parts.push({ node: node, text: node.nodeValue })
      node.nodeValue = ''
    }

    var showAll = () => {
      parts.forEach((p) => {
        p.node.nodeValue = p.text
      })
      scroller.scrollTop = scroller.scrollHeight
    }

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (params.done === '1' || reduced) {
      showAll()
      return { finish: showAll }
    }

    /* 自分で上へ戻した人を引き戻さない。底の近くにいるあいだだけ追う。 */
    var stick = true
    scroller.addEventListener('scroll', () => {
      stick = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40
    })

    var speed = opts.speed === undefined ? 46 : opts.speed
    var at = 0
    var k = 0
    var timer = null

    var step = () => {
      /* 空になった段落は読み飛ばす。while は使えないので for で数える。 */
      for (; at < parts.length && k >= parts[at].text.length; at += 1) {
        k = 0
      }
      if (at >= parts.length) {
        timer = null
        return
      }
      var ch = parts[at].text.charAt(k)
      parts[at].node.nodeValue += ch
      k += 1
      if (stick) scroller.scrollTop = scroller.scrollHeight

      /* 息継ぎ。句点で長く、読点で少し、段落の切れ目でもう一拍。 */
      var wait = speed
      if (k >= parts[at].text.length) wait = speed * 11
      else if ('。！？'.indexOf(ch) >= 0) wait = speed * 8
      else if ('、」—'.indexOf(ch) >= 0) wait = speed * 3
      timer = setTimeout(step, wait)
    }
    timer = setTimeout(step, 420)

    return {
      finish: () => {
        if (timer) clearTimeout(timer)
        timer = null
        showAll()
      },
    }
  }

  /*
   * data-mock-id のバッジ。
   *
   * 既定は伏せておく。i キー、#ids=1、または親からの postMessage で出す。
   * 画面の組みを崩さないよう、実体には触らず固定層に重ねて描く。
   */
  var layer = null
  var shown = false

  var draw = () => {
    if (!layer) return
    layer.innerHTML = ''
    if (!shown) return
    var nodes = document.querySelectorAll('[data-mock-id]')
    Array.prototype.forEach.call(nodes, (el) => {
      var r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      var box = document.createElement('div')
      box.className = 'box'
      box.style.left = r.left + 'px'
      box.style.top = r.top + 'px'
      box.style.width = r.width + 'px'
      box.style.height = r.height + 'px'
      var tag = document.createElement('div')
      tag.className = 'tag'
      tag.textContent = el.dataset.mockId
      // 上端に貼ると画面の外へ出る要素があるので、その時だけ内側へ落とす。
      tag.style.left = '0'
      tag.style.top = r.top < 12 ? '0' : '-11px'
      box.append(tag)
      layer.append(box)
    })
  }

  var setIds = (next) => {
    shown = next
    if (!layer) {
      layer = document.createElement('div')
      layer.className = 'mock-badges'
      document.body.append(layer)
    }
    var hint = document.querySelector('.mock-hint')
    if (shown && !hint) {
      hint = document.createElement('div')
      hint.className = 'mock-hint'
      hint.textContent = 'data-mock-id 表示中　—　i キーで消す'
      document.body.append(hint)
    } else if (!shown && hint) {
      hint.remove()
    }
    draw()
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'i' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) setIds(!shown)
  })
  window.addEventListener('resize', draw)
  window.addEventListener('message', (e) => {
    if (e.data && typeof e.data.mockIds === 'boolean') setIds(e.data.mockIds)
  })

  window.Mock = {
    case: C,
    cast: CAST_BY_KEY,
    places: PLACES,
    examines: examines,
    lit: LIT,
    params: params,
    num: (k, d) => (params[k] === undefined ? d : Number(params[k])),
    str: (k, d) => (params[k] === undefined ? d : params[k]),
    esc: esc,
    marks: marks,
    toMin: toMin,
    hhmm: hhmm,
    span: SPAN,
    total: PLAY.length,
    play: play,
    chart: chart,
    // 刻限の印だけを単体で出す。四状態を並べる台紙（deadline-states.html）が使う。
    deathMarks: deathMarks,
    // 同じ四状態を、端末の横に寝た時刻軸へ移したもの。
    railDeath: railDeath,
    pxPerMin: PX_PER_MIN,
    chartHead: chartHead,
    rail: rail,
    railBig: railBig,
    cmp: cmp,
    pct: pct,
    log: log,
    compare: compare,
    clock: clock,
    readOut: readOut,
    ids: setIds,
    refresh: draw,
    // 各画面の最後に呼ぶ。ハッシュで #ids=1 が来ていたら最初から出す。
    ready: () => {
      if (params.ids === '1') setIds(true)
    },
  }
})()
