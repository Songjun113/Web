import SmartLink from '@/components/SmartLink'
import achievements from '@/data/achievements.json'
import { RESEARCH_TRACKS } from '@/data/research-tracks'
import { useEffect, useMemo, useRef, useState } from 'react'
import FluidCanvas from './FluidCanvas'
import styles from './ResearchHome.module.css'

const splitTitle = '让智能理解人的信号，也理解人的处境。'.split('')

function FeaturedCarousel() {
  const cards = useMemo(() => {
    const verified = achievements.filter(item => item.featured)
    if (verified.length) return verified
    return RESEARCH_TRACKS.map(track => ({
      id: track.id,
      title: track.title,
      titleEn: track.titleEn,
      summary: '经确认的代表成果将在这里形成可追溯的研究时间线。',
      type: 'Research program',
      researchTrack: track.id,
      href: '/achievements'
    }))
  }, [])
  const [active, setActive] = useState(0)
  const touchStart = useRef(0)
  const wheelLock = useRef(false)
  const select = delta => setActive(current => (current + delta + cards.length) % cards.length)

  return (
    <section className={styles.carouselSection} aria-labelledby='featured-title'>
      <div className={styles.sectionEyebrow}>SELECTED OUTPUTS · 精选成果</div>
      <h2 id='featured-title'>研究不是清单，<br />而是一条逐渐清晰的轨迹。</h2>
      <div
        className={styles.carousel}
        role='region'
        aria-label='精选成果环形轮播'
        tabIndex={0}
        onKeyDown={event => {
          if (event.key === 'ArrowRight') select(1)
          if (event.key === 'ArrowLeft') select(-1)
        }}
        onWheel={event => {
          if (Math.abs(event.deltaY) > 12 && !wheelLock.current) {
            wheelLock.current = true
            select(event.deltaY > 0 ? 1 : -1)
            window.setTimeout(() => { wheelLock.current = false }, 420)
          }
        }}
        onTouchStart={event => { touchStart.current = event.touches[0].clientX }}
        onTouchEnd={event => {
          const distance = touchStart.current - event.changedTouches[0].clientX
          if (Math.abs(distance) > 40) select(distance > 0 ? 1 : -1)
        }}>
        {cards.map((card, index) => {
          const raw = index - active
          const distance = raw > cards.length / 2 ? raw - cards.length : raw < -cards.length / 2 ? raw + cards.length : raw
          return (
            <SmartLink
              href={card.href || card.publicUrl || '/achievements'}
              key={card.id}
              aria-label={`${card.title} · ${card.titleEn}`}
              tabIndex={distance === 0 ? 0 : -1}>
              <article
                className={styles.carouselCard}
                aria-hidden={distance !== 0}
                style={{
                  '--card-index': distance,
                  '--card-depth': Math.abs(distance),
                  '--card-offset': `${distance * 92}%`,
                  '--card-visibility': distance === 0 ? 1 : Math.max(0.12, 0.34 - Math.abs(distance) * 0.1),
                  zIndex: cards.length - Math.abs(distance)
                }}>
                <span>{card.type}</span>
                <h3>{card.title}</h3>
                <p className={styles.english}>{card.titleEn}</p>
                <p>{card.summary}</p>
                <b>EXPLORE ↗</b>
              </article>
            </SmartLink>
          )
        })}
      </div>
      <div className={styles.carouselControls}>
        <button onClick={() => select(-1)} aria-label='上一项'>←</button>
        <span>{String(active + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}</span>
        <button onClick={() => select(1)} aria-label='下一项'>→</button>
      </div>
    </section>
  )
}

export default function ResearchHome() {
  const journeyRef = useRef(null)
  const finaleRef = useRef(null)
  const [activeTrack, setActiveTrack] = useState(0)

  useEffect(() => {
    const node = journeyRef.current
    if (!node) return
    const update = () => {
      const rect = node.getBoundingClientRect()
      const distance = Math.max(0, Math.min(node.offsetHeight - window.innerHeight, -rect.top))
      const progress = distance / Math.max(1, node.offsetHeight - window.innerHeight)
      setActiveTrack(Math.min(RESEARCH_TRACKS.length - 1, Math.floor(progress * RESEARCH_TRACKS.length)))
    }
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    let context
    let cancelled = false
    Promise.all([import('gsap'), import('gsap/dist/ScrollTrigger')]).then(([gsapModule, triggerModule]) => {
      if (cancelled || !finaleRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const gsap = gsapModule.gsap
      const ScrollTrigger = triggerModule.ScrollTrigger
      gsap.registerPlugin(ScrollTrigger)
      context = gsap.context(() => {
        gsap.fromTo(`.${styles.finalOrb}`, { scale: 0.28 }, {
          scale: 1.55,
          ease: 'none',
          scrollTrigger: { trigger: finaleRef.current, start: 'top bottom', end: 'center center', scrub: 0.7 }
        })
      }, finaleRef.current)
    })
    return () => {
      cancelled = true
      context?.revert()
    }
  }, [])

  return (
    <div className={styles.experience}>
      <section className={styles.hero}>
        <FluidCanvas />
        <div className={styles.noise} aria-hidden='true' />
        <div className={styles.heroNav}>
          <span>SONGJUN · RESEARCH</span>
          <a href='#research-journey'>SCROLL TO EXPLORE ↓</a>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>BIOMEDICAL ENGINEERING · HUMAN-CENTERED AI</p>
          <h1 aria-label='让智能理解人的信号，也理解人的处境。'>
            {splitTitle.map((letter, index) => (
              <span key={`${letter}-${index}`} style={{ '--letter-delay': `${index * 45}ms` }}>{letter}</span>
            ))}
          </h1>
          <p className={styles.heroEnglish}>Intelligence that reads human signals — and respects the human condition.</p>
        </div>
        <div className={styles.heroIndex}>01 — 04</div>
      </section>

      <section id='research-journey' ref={journeyRef} className={styles.journey}>
        <div className={styles.journeySticky}>
          <div className={styles.journeyHeader}>
            <span>RESEARCH DIRECTIONS</span>
            <span>{String(activeTrack + 1).padStart(2, '0')} / 03</span>
          </div>
          {RESEARCH_TRACKS.map((track, index) => (
            <article
              key={track.id}
              className={`${styles.track} ${index === activeTrack ? styles.trackActive : ''}`}
              aria-hidden={index !== activeTrack}
              style={{ '--track-accent': track.accent }}>
              <span className={styles.trackNumber}>{track.index}</span>
              <div className={styles.trackCopy}>
                <p>{track.titleEn}</p>
                <h2>{track.title}</h2>
                <blockquote>{track.question}</blockquote>
                <p className={styles.trackEnglish}>{track.questionEn}</p>
                <div>{track.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div>
              </div>
              <div className={styles.trackOrb} aria-hidden='true' />
            </article>
          ))}
          <div className={styles.progressRail}><i style={{ height: `${((activeTrack + 1) / 3) * 100}%` }} /></div>
        </div>
      </section>

      <FeaturedCarousel />

      <section ref={finaleRef} className={styles.finale}>
        <div className={styles.finalOrb} aria-hidden='true' />
        <div className={styles.finaleCopy}>
          <span>OPEN RESEARCH LEDGER</span>
          <h2>从问题出发，<br />让每一步都有迹可循。</h2>
          <p>From questions to evidence — an evolving record of research, prototypes and outcomes.</p>
          <SmartLink href='/achievements' className={styles.primaryLink}>查看全部成果 · VIEW ACHIEVEMENTS ↗</SmartLink>
          <a href='#blog' className={styles.secondaryLink}>继续阅读博客 · CONTINUE TO JOURNAL ↓</a>
        </div>
      </section>
    </div>
  )
}
