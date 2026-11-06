import { useState, useEffect } from 'react'

// Splits by what a reader sees as one letter, so Telugu/Hindi vowel signs
// stay attached to their consonant while typing.
function splitLetters(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

// Types the text out letter by letter, holds, erases it, and starts over.
// Screen readers get the full text once; reduced-motion users get it static.
// Styled by .type-text in LandingPage's stylesheet (brand-gradient letters).
export default function TypeLoop({ text }) {
  const [shown, setShown] = useState('')

  useEffect(() => {
    const letters = splitLetters(text)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(text)
      return undefined
    }
    let count = 0
    let step = 1
    let timer
    const tick = () => {
      count += step
      setShown(letters.slice(0, count).join(''))
      let wait = step > 0 ? 70 : 35
      if (count >= letters.length) { step = -1; wait = 2200 }
      else if (count <= 0) { step = 1; wait = 500 }
      timer = setTimeout(tick, wait)
    }
    setShown('')
    timer = setTimeout(tick, 700)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="type-text" aria-hidden="true">{shown}</span>
    </>
  )
}
