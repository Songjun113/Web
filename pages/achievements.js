import AchievementsPage from '@/components/research/AchievementsPage'

export default function Achievements() {
  return <AchievementsPage />
}

export async function getStaticProps() {
  return {
    props: {
      meta: {
        title: '研究成果 · Achievements',
        description: '松菌君的论文、项目、专利与奖项记录。'
      }
    }
  }
}
