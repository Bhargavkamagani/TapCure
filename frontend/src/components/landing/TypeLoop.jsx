// The small label above a section heading ("Your leave time").
//
// It used to type itself out letter by letter, hold, erase and start over, so
// a visitor often caught it half-written ("Your leave ti"). It now shows the
// whole label at once. The name and the `text` prop are kept so every caller
// stays the same. Styled by .type-text in LandingPage's stylesheet.
export default function TypeLoop({ text }) {
  return <span className="type-text">{text}</span>
}
