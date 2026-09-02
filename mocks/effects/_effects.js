// タイプ送りは一字ずつ遅らせる。順番だけ CSS に渡して、時間の決定は CSS 側に残す。
for (const el of document.querySelectorAll('[data-type]')) {
  const chars = [...el.dataset.type]
  el.replaceChildren(
    ...chars.map((ch, i) => {
      const s = document.createElement('span')
      s.textContent = ch
      s.style.setProperty('--i', String(i))
      return s
    }),
  )
}

for (const m of document.querySelectorAll('.motion')) {
  // クラスを外して強制的に再計算させないと、同じアニメーションは再生し直されない。
  const play = () => {
    m.classList.remove('play')
    void m.offsetWidth
    m.classList.add('play')
  }
  m.querySelector('.replay').addEventListener('click', play)
  new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries)
        if (e.isIntersecting) {
          play()
          obs.unobserve(e.target)
        }
    },
    { threshold: 0.55 },
  ).observe(m)
}
