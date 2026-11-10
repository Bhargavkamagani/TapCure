import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/index.jsx'
import { BRAND } from '../../data/landingData.js'
import TypeLoop from './TypeLoop.jsx'
import { Story, PATIENT_STEPS, HOSPITAL_STEPS } from './TcStory.jsx'

/**
 * How it works — the homepage's short version of the Features page story
 * (2026-11-09; it took the place of the leave-time road, which moved to
 * Features). Three steps for each side; the patient pick keeps the leave-time
 * step, so the hero's "know when to leave home" is still shown here.
 */
const PATIENT_PICK = [0, 1, 3].map((i) => PATIENT_STEPS[i])
const HOSPITAL_PICK = [0, 1, 2].map((i) => HOSPITAL_STEPS[i])

function TcHowItWorks() {
  const { t } = useI18n()
  const brand = BRAND.name
  const [side, setSide] = useState('pat')
  const pat = side === 'pat'

  const tab = (key, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={side === key}
      onClick={() => setSide(key)}
      className={`relative pb-3 pt-1.5 text-[20px] font-semibold transition-colors ${side === key ? 'text-[color:var(--ink)]' : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'}`}
    >
      {label}
      <span className={`absolute inset-x-0 bottom-0 h-[3px] rounded bg-gradient-to-r from-[#0A9A96] to-[#2F58B7] transition-transform duration-300 ${side === key ? 'scale-x-100' : 'scale-x-0'}`} />
    </button>
  )

  return (
    <section className="sec" id="how">
      <div className="wrap">
        <div className="sec-head center rv">
          <span className="eyebrow"><TypeLoop text={t('tc.how.eyebrow')} /></span>
          <h2>{t('sfeat.heroA')}<br /><span className="serif grad">{t('sfeat.heroB')}</span></h2>
          <p className="lede">{t('sfeat.heroLede', { brand })}</p>
          <div role="tablist" aria-label={t('sfeat.showFor')} className="mt-2 flex justify-center gap-10">
            {tab('pat', t('sfeat.patientsEyebrow'))}
            {tab('hosp', t('sfeat.hospitalsEyebrow'))}
          </div>
        </div>

        {/* a new key remounts the story, so it starts at step one */}
        <div role="tabpanel" className="mx-auto max-w-[1120px]">
          <Story key={side} steps={pat ? PATIENT_PICK : HOSPITAL_PICK} device={pat ? 'phone' : 'desk'} />
        </div>

        <p className="mt-6 text-center">
          <Link to="/features" className="btn btn-ghost">{t('tc.how.all')} →</Link>
        </p>
      </div>
    </section>
  )
}

export default TcHowItWorks
