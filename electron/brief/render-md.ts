// feature-001 立项模型重建 · 立项单 MD 镜像渲染（契约 §4，纯函数）
// 固定区块：标题/拍板行/项目性质/六要素/故事前提/视觉风格/诊断结论/诊断明细（D-018）/相对上版改动。
import type { ProjectBrief } from '../../shared/types.js'

const KIND_LABEL: Record<ProjectBrief['kind'], string> = {
  commercial: '商业短剧',
  memorial: '个人纪念',
}

/** 渲染 立项单.vN.md 全文（字段为「待定」时照写） */
export function renderBriefMd(brief: ProjectBrief): string {
  const fe = brief.fiveElements
  const p = brief.premise
  const approveLine = brief.approve.by === 'verbal'
    ? `口头拍板（“${brief.approve.verbal?.quote ?? ''}”）`
    : brief.approve.by === 'ui'
      ? '修改立项面板直改'
      : '门内拍板'
  const aux = brief.style.auxiliaryStyleId?.trim() ? brief.style.auxiliaryStyleId! : '无'
  const diag = brief.diagnosisSummary?.trim() ? brief.diagnosisSummary! : '（无）'
  const diagDetail = brief.diagnosisDetail?.trim() ? brief.diagnosisDetail! : '（无）'

  const changes = brief.version === 1 || brief.changesFromPrevious.length === 0
    ? '首版立项。'
    : brief.changesFromPrevious.map(c => `- ${c.field}：${c.from || '（空）'} → ${c.to || '（空）'}`).join('\n')

  // feature-013：L0 标签/备注区块（有值才渲染，置于头部）
  const l0Tags = brief.l0?.tags?.filter(t => t.trim() !== '') ?? []
  const l0Notes = brief.l0?.notes?.trim() ?? ''
  const l0Block = l0Tags.length > 0 || l0Notes !== ''
    ? `## 项目标签与备注
${l0Tags.length > 0 ? `- 标签：${l0Tags.join('、')}` : ''}${l0Tags.length > 0 && l0Notes !== '' ? '\n' : ''}${l0Notes !== '' ? `- 备注：${l0Notes}` : ''}

`
    : ''

  return `# 立项单 v${brief.version}

> 发布时间：${brief.publishedAt}　拍板方式：${approveLine}

${l0Block}## 项目性质
${KIND_LABEL[brief.kind]}

## 立项六要素
- 题材赛道：${fe.genre}
- 目标平台：${[...fe.platforms].sort().join('、')}
- 单集时长：${fe.episodeDuration}
- 集数：${fe.episodeCount}
- 风格基调：${fe.tone}
- 画幅：${fe.aspectRatio}

## 故事前提
- 人物（双方身份/年龄）：${p.leads}
- 时间：${p.time}
- 地点：${p.place}
- 核心事件：${p.coreEvent}
- 本季边界：${p.seasonBoundary}

## 视觉风格
- 主风格：${brief.style.mainStyleId} @ ${brief.style.catalogVersion}
- 辅助气氛：${aux}

## 选题诊断结论
${diag}

## 选题诊断明细
${diagDetail}

## 相对上一版改动
${changes}
`
}
