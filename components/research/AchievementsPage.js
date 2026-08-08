import SmartLink from '@/components/SmartLink'
import achievements from '@/data/achievements.json'
import { RESEARCH_TRACKS } from '@/data/research-tracks'
import { useMemo, useState } from 'react'
import styles from './AchievementsPage.module.css'

const typeLabels = { paper: '论文 / PREPRINT', project: '项目 / SOFTWARE', patent: '专利 / PATENT', award: '奖项 / AWARD' }

export default function AchievementsPage() {
  const [track, setTrack] = useState('all')
  const [type, setType] = useState('all')
  const [year, setYear] = useState('all')
  const years = useMemo(() => [...new Set(achievements.map(item => String(item.date || '').slice(0, 4)).filter(Boolean))].sort().reverse(), [])
  const filtered = achievements.filter(item =>
    (track === 'all' || item.researchTrack === track) &&
    (type === 'all' || item.type === type) &&
    (year === 'all' || String(item.date || '').startsWith(year))
  )

  return (
    <main className={styles.page}>
      <nav><SmartLink href='/'>← 返回研究首页</SmartLink><span>SONGJUN · OPEN RESEARCH LEDGER</span></nav>
      <header>
        <p>ACHIEVEMENTS · 研究成果</p>
        <h1>把探索整理成<br />可验证的轨迹。</h1>
        <div><span>{String(achievements.length).padStart(2, '0')}</span><p>VERIFIED RECORDS<br />已确认公开成果</p></div>
      </header>

      <section className={styles.filters} aria-label='成果筛选器'>
        <label>研究方向<select value={track} onChange={e => setTrack(e.target.value)}><option value='all'>全部方向</option>{RESEARCH_TRACKS.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>成果类型<select value={type} onChange={e => setType(e.target.value)}><option value='all'>全部类型</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>年份<select value={year} onChange={e => setYear(e.target.value)}><option value='all'>全部年份</option>{years.map(item => <option key={item}>{item}</option>)}</select></label>
      </section>

      <section className={styles.timeline} aria-live='polite'>
        {filtered.length ? filtered.map((item, index) => (
          <article key={item.id}>
            <div className={styles.marker}>{String(index + 1).padStart(2, '0')}</div>
            <div><span>{typeLabels[item.type] || item.type} · {item.date}</span><h2>{item.title}</h2><p className={styles.english}>{item.titleEn}</p><p>{item.summary}</p><p>{item.venue}</p>{item.publicUrl ? <a href={item.publicUrl} target='_blank' rel='noreferrer'>公开链接 ↗</a> : null}</div>
          </article>
        )) : (
          <div className={styles.empty}>
            <span>EMPTY, BY DESIGN</span>
            <h2>只展示经过确认的成果。</h2>
            <p>月度扫描器会识别新增文件并生成待确认清单；在你确认之前，任何简历、附件和候选记录都不会公开。</p>
          </div>
        )}
      </section>
    </main>
  )
}
