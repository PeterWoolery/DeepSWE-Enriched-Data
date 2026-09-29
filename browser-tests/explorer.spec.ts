import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { datacurveChartPrecedence, getEfficiencyCoverage, scoreResult } from '../src/lib/comparison'
import type { Dataset } from '../src/lib/schema'

interface ExportedObservation {
  id: string
  sourceCategory: string
  model: { reportedName: string }
  series: { id: string }
  result: { metric: string }
  additionalResults: { metric: string }[]
  metrics: { cost: { value: number | null } }
}

interface ExportedDataset {
  exportMetadata: { candidatesIncluded: boolean; datasetRevision: string }
  observations: ExportedObservation[]
}

async function loadDataset(page: import('@playwright/test').Page) {
  return page.evaluate(async () => await (await fetch('data/observations.json')).json() as ExportedDataset)
}

async function noDataSymbolOverlaps(page: Page) {
  return page.locator('.no-data-point').evaluateAll((groups) => {
    const bounds = groups.map((group) => {
      const shape = group.querySelector(':scope > path, :scope > circle:not(.point-hit-area)') as SVGGraphicsElement
      const box = shape.getBBox()
      const stroke = Number.parseFloat(getComputedStyle(shape).strokeWidth) || 0
      return { left: box.x - stroke / 2, right: box.x + box.width + stroke / 2, top: box.y - stroke / 2, bottom: box.y + box.height + stroke / 2 }
    })
    const overlaps: [number, number][] = []
    for (let left = 0; left < bounds.length; left += 1) {
      for (let right = left + 1; right < bounds.length; right += 1) {
        const a = bounds[left]!
        const b = bounds[right]!
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) overlaps.push([left, right])
      }
    }
    return overlaps
  })
}

test('official numeric effort curve is accessible and pass@4 evidence stays metric-specific', async ({ page }) => {
  await page.goto('?view=official')
  const dataset = await loadDataset(page)
  const official = dataset.observations.filter((row) => row.sourceCategory === 'organizer' && row.result.metric === 'pass_at_1' && row.metrics.cost.value !== null)
  await expect(page.locator('.plot-point')).toHaveCount(official.length)
  await expect(page.locator('.curve-path').first()).toBeVisible()
  await expect(page.locator('.confidence-mark')).toHaveCount(official.length)

  const point = page.locator('.plot-point').first()
  await expect(point).toHaveAttribute('aria-label', /per scored rollout attempt/)
  const seriesId = await point.getAttribute('data-series-id')
  const seriesCount = official.filter((row) => row.series.id === seriesId).length
  await point.focus()
  await expect(page.locator('.plot-point.is-highlighted')).toHaveCount(seriesCount)
  await point.press('Enter')
  await expect(page.locator('.evidence-panel h3')).not.toHaveText('Choose a point or result row')
  await expect(page).toHaveURL(/point=/)

  await page.goto('?view=official&score=pass_at_4')
  const passAtFourRow = page.locator('.results-table tbody tr').filter({ hasText: 'GPT-6 Astra' }).filter({ hasText: 'xhigh' })
  await expect(passAtFourRow).toHaveCount(1)
  await passAtFourRow.getByRole('button', { name: 'GPT-6 Astra' }).click()
  const evidence = page.locator('.evidence-panel')
  await expect(evidence.locator('.evidence-score')).toContainText('pass@4')
  await expect(evidence).toContainText('Score denominator: unique tasks attempted (113).')
  await expect(evidence).not.toContainText('scored rollout attempts (452)')
  await expect(evidence).not.toContainText('95% CI')
  await expect(evidence).toContainText('Datacurve does not report a pass@4 confidence interval.')
})

test('selected measured and estimated results show axis guides for the active X metric', async ({ page }) => {
  await page.goto('?view=official&q=astra')
  const point = page.locator('.plot-point').first()
  const observationId = await point.getAttribute('data-observation-id')
  expect(observationId).not.toBeNull()
  await point.focus()
  await point.press('Enter')

  const guide = page.locator(`.selected-guide[data-selected-guide-for="${observationId}"]`)
  await expect(guide).toHaveAttribute('data-selected-guide-type', 'measured')
  await expect(guide.locator('.selected-guide-y')).toHaveCount(1)
  await expect(guide.locator('.selected-guide-x')).toHaveCount(1)
  await expect(guide.locator('[data-guide-axis="y"]')).toContainText('%')
  await expect(guide.locator('[data-guide-axis="x"]')).toContainText('$')

  for (const [metric, label] of [['outputTokens', 'Output tokens per task'], ['time', 'Time per task']] as const) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(guide).toHaveAttribute('data-x-metric', metric)
    await expect(guide.locator('.selected-guide-x')).toHaveCount(1)
    await expect(guide.locator('[data-guide-axis="x"]')).not.toBeEmpty()
  }

  await page.goto('?view=combined')
  const estimate = page.locator('.estimated-point[data-observation-id="aa-codex-gpt-6-luna-max-v1.1"]')
  await expect(estimate).toHaveCount(1)
  await estimate.click()
  const estimatedGuide = page.locator('.selected-guide[data-selected-guide-type="estimated"]')
  await expect(estimatedGuide).toHaveClass(/is-estimated/)
  await expect(estimatedGuide.locator('.selected-guide-x, .selected-guide-y')).toHaveCount(2)
  await expect(estimatedGuide.locator('[data-guide-axis="x"]')).toContainText('EST ·')
})

test('GPT-6.1 Sol screenshot curve renders five connected approximate marks with source-specific units', async ({ page }) => {
  await page.goto('?view=combined&q=GPT-6.1%20Sol&scenarios=0')
  const marks = page.locator('.plot-point[data-series-id="openai-gpt-6.1-sol-deepswe-figure"]')
  await expect(marks).toHaveCount(5)
  const path = page.locator('.curve-path[data-series-id="openai-gpt-6.1-sol-deepswe-figure"]')
  await expect(path).toHaveCount(1)
  const coords = await marks.evaluateAll((elements) => elements.map((element) => {
    const shape = element.querySelector('path')!
    const box = shape.getBBox()
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }))
  expect(coords.every((point, index) => index === 0 || point.x > coords[index - 1]!.x)).toBe(true)
  expect(coords[2]!.y).toBeLessThan(coords[3]!.y)
  expect(coords[4]!.y).toBeGreaterThan(coords[2]!.y)
  await marks.nth(2).click()
  await expect(page.locator('.selected-guide[data-selected-guide-for="openai-gpt-6.1-sol-deepswe-setting3"]')).toHaveAttribute('aria-label', /approximate source-chart Cost per task.*aggregation and task denominator unspecified/)
  await expect(page.locator('.selected-guide [data-guide-axis="x"]')).toContainText('≈ SRC · $0.7')
  await expect(page.locator('.evidence-panel')).toContainText('visual extraction/rounding bounds, not statistical confidence intervals')
  await expect(page.locator('.evidence-panel')).toContainText('2cac9bafeea62d03972bfc721c1131734616a720c61753f1f0e305c40e94ef29')
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current chart as SVG' }).click()
  const svg = await readFile((await (await svgDownload).path())!, 'utf8')
  expect(svg).toContain('five screenshot-derived approximate coordinates')
  expect(svg).toContain('openai-gpt-6.1-sol-deepswe-setting1')
  expect(svg).toContain('openai-gpt-6.1-sol-deepswe-setting5')
  await page.getByRole('button', { name: 'Median', exact: true }).click()
  await expect(marks).toHaveCount(0)
  await expect(page.locator('.no-data-point[data-series-id="openai-gpt-6.1-sol-deepswe-figure"]')).toHaveCount(5)
  await page.getByRole('button', { name: 'Mean', exact: true }).click()
  await page.getByRole('combobox', { name: 'Score metric on Y' }).selectOption('reported_score_unspecified')
  await page.getByRole('button', { name: 'Best only' }).click()
  await expect(marks).toHaveCount(1)
  await expect(marks.first()).toHaveAttribute('data-observation-id', 'openai-gpt-6.1-sol-deepswe-setting3')
  await page.getByRole('button', { name: 'All levels' }).click()
  await expect(marks).toHaveCount(5)
  await page.locator('.strict-toggle input').check()
  await expect(marks).toHaveCount(0)
})

test('selected Muse Spark source score with scenarios off has no fabricated measured cost, token, or time guide', async ({ page }) => {
  await page.goto('?q=Muse%20Spark%201.3&publisher=Meta&score=task_pass_rate&scenarios=0')
  const row = page.locator('.results-table tbody tr[data-observation-id="meta-muse-spark-1.3-v1.1-max"]')
  await expect(row).toHaveCount(1)
  await expect(row.locator('td').nth(2)).toContainText('75.4%')
  await row.locator('.table-model-button').click()

  const guide = page.locator('.selected-guide[data-selected-guide-type="no-data"]')
  await expect(guide).toHaveAttribute('data-x-metric', 'cost')
  await expect(guide).toHaveAttribute('aria-label', /75\.4%.*no cost per task value is reported.*No numeric X guide is shown/)
  await expect(guide.locator('.selected-guide-y')).toHaveCount(1)
  await expect(guide.locator('.selected-guide-x')).toHaveCount(0)
  await expect(guide.locator('[data-guide-axis="x-missing"]')).toHaveText('NO COST DATA')

  for (const [metric, label, missing] of [
    ['outputTokens', 'Output tokens per task', 'NO OUTPUT-TOKEN DATA'],
    ['time', 'Time per task', 'NO TIME DATA'],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(guide).toHaveAttribute('data-x-metric', metric)
    await expect(guide.locator('.selected-guide-x')).toHaveCount(0)
    await expect(guide.locator('[data-guide-axis="x-missing"]')).toHaveText(missing)
  }
})

test('default view surfaces supplemental reports with their reported score metric', async ({ page }) => {
  await page.goto('./')
  const table = page.locator('.results-table tbody')
  const approvedCount = (await loadDataset(page)).observations.length
  await expect(table.locator('tr')).toHaveCount(approvedCount)
  await expect(page.getByRole('tab', { name: /Combined reports/ })).toHaveAttribute('aria-selected', 'true')

  const luna = table.locator('tr[data-observation-id="openai-gpt-6-luna-v1.1-max"]')
  await expect(luna).toHaveCount(1)
  await expect(luna).toHaveAttribute('data-observation-id', 'openai-gpt-6-luna-v1.1-max')
  await expect(luna.locator('td').nth(2)).toContainText('66.6%')
  await expect(luna.locator('td').nth(2)).toContainText('Different metric: Developer-reported DeepSWE score; exact score metric not specified')
  await expect(luna.locator('td').nth(3)).toContainText('Mean task cost is not inferred')
  await expect(luna.locator('td').nth(5)).toContainText('developer')
  await expect(luna.locator('.row-evidence a')).toHaveAttribute('href', 'https://openai.com/index/introducing-gpt-6-sol-and-luna/')
  await expect(page.locator('.plot-point[data-observation-id="openai-gpt-6-luna-v1.1-max"]')).toHaveCount(0)
  const lunaReference = page.locator('.no-data-point[data-observation-id="openai-gpt-6-luna-v1.1-max"]')
  const lunaReferenceEntry = page.locator('.no-data-entry[data-observation-id="openai-gpt-6-luna-v1.1-max"]')
  await expect(lunaReference).toHaveCount(1)
  await expect(lunaReference).toHaveAttribute('data-score-metric', 'reported_score_unspecified')
  await expect(lunaReferenceEntry).toHaveAttribute('aria-label', /Different metric from selected pass@1/)
  await expect(lunaReferenceEntry).toHaveAttribute('aria-label', /Developer-reported DeepSWE score; exact score metric not specified/)
  await expect(lunaReferenceEntry).toContainText('66.6%')

  const opus = table.locator('tr').filter({ hasText: 'Claude Opus 5.5' }).filter({ hasText: 'Anthropic' })
  await expect(opus).toHaveCount(1)
  await expect(opus).toHaveAttribute('data-observation-id', 'anthropic-claude-opus-5.5-v1.1')
  await expect(opus.locator('td').nth(2)).toContainText('74.2%')
  await expect(opus.locator('td').nth(2)).toContainText('Different metric: Developer-reported average score over five trials; exact score metric not specified')
  await expect(opus.locator('td').nth(3)).toContainText('Mean task cost is not inferred')
  await expect(opus.locator('td').nth(5)).toContainText('developer')
  await expect(opus.locator('.row-evidence a')).toHaveAttribute('href', /Claude%20Opus%205\.5%20System%20Card\.pdf/)
  await expect(page.locator('.plot-point[data-observation-id="anthropic-claude-opus-5.5-v1.1"]')).toHaveCount(0)
  const opusReference = page.locator('.no-data-point[data-observation-id="anthropic-claude-opus-5.5-v1.1"]')
  const opusReferenceEntry = page.locator('.no-data-entry[data-observation-id="anthropic-claude-opus-5.5-v1.1"]')
  await expect(opusReference).toHaveCount(1)
  await expect(opusReferenceEntry).toHaveAttribute('aria-label', /average score over five trials; exact score metric not specified/)
  await expect(opusReferenceEntry).toContainText('74.2%')
  await page.locator('.no-data-key summary').click()
  await lunaReferenceEntry.focus()
  await expect(lunaReference).toHaveClass(/is-highlighted/)
  await lunaReferenceEntry.press('Enter')
  await expect(luna.locator('.table-model-button')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.evidence-panel .evidence-score')).toContainText('66.6%')
  await expect(page.locator('.evidence-panel .evidence-score')).toContainText('Different metric from selected pass@1')
  await expect(page.locator('.evidence-panel .evidence-score')).toContainText('Developer-reported DeepSWE score; exact score metric not specified')
  await opusReferenceEntry.click()
  await expect(opus.locator('.table-model-button')).toHaveAttribute('aria-pressed', 'true')
  await expect(opusReference).toHaveClass(/is-highlighted/)
  await expect(page.locator('.evidence-panel .evidence-score')).toContainText('74.2%')
  await expect(page.getByRole('heading', { name: /Effort, measured/i })).toHaveCount(0)
  const heroCopy = await page.locator('.hero-copy').boundingBox()
  const heroDeck = await page.locator('.hero-deck').boundingBox()
  expect(heroCopy).not.toBeNull()
  expect(heroDeck).not.toBeNull()
  expect(heroDeck!.y - heroCopy!.y).toBeLessThanOrEqual(2)

  await page.getByRole('searchbox', { name: 'Search models / publishers' }).fill('GPT-6 Luna')
  await expect(luna).toHaveCount(1)
  await expect(opus).toHaveCount(0)

  await page.goto('?view=official')
  await expect(page.getByRole('tab', { name: /^Official/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(70)
  await page.getByRole('link', { name: 'DeepSWE Explorer home' }).click()
  await expect(page.getByRole('tab', { name: /Combined reports/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(approvedCount)
})

test('Datacurve precedence removes duplicate chart marks without hiding source rows or restoring them through filters', async ({ page }) => {
  await page.goto('?view=combined')
  const dataset = JSON.parse(await readFile(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')) as Dataset
  const precedence = datacurveChartPrecedence(dataset.observations, dataset.sourceRetrieval.sourceId)
  const chartRows = dataset.observations.filter((observation) =>
    !precedence.has(observation.id) && ['organizer', 'developer', 'independent', 'local'].includes(observation.sourceCategory),
  )
  const expectedCoverage = getEfficiencyCoverage(chartRows.filter((observation) => scoreResult(observation, 'pass_at_1')), 'cost', 'mean')
  await expect(page.locator('.coverage-big')).toHaveText(`${expectedCoverage.available} / ${expectedCoverage.total}`)
  const reportId = 'aa-claude-code-opus-5-max-v1.1'
  const reportRow = page.locator(`.results-table tbody tr[data-observation-id="${reportId}"]`)
  const fireworksId = 'fireworks-deepswe-gpt-6-astra-xhigh'
  const fireworksRow = page.locator(`.results-table tbody tr[data-observation-id="${fireworksId}"]`)
  await expect(reportRow).toHaveCount(1)
  await expect(reportRow.locator('.table-chart-suppression')).toContainText('Datacurve has an applicable DeepSWE v1.1 result for the same model')
  await expect(fireworksRow).toHaveCount(1)
  await expect(fireworksRow.locator('td').nth(0)).toContainText('unspecified')
  await expect(fireworksRow.locator('.table-chart-suppression')).toContainText('does not specify its benchmark version')
  await expect(fireworksRow.locator('.table-chart-suppression')).toContainText('Datacurve has a DeepSWE v1.1 result for the same model')
  await expect(page.locator(`.estimated-point[data-observation-id="${fireworksId}"]`)).toHaveCount(0)
  await expect(page.locator(`.plot-point[data-observation-id="${reportId}"]`)).toHaveCount(0)
  await expect(page.locator(`.no-data-point[data-observation-id="${reportId}"]`)).toHaveCount(0)
  await expect(page.locator('.chart-precedence-note')).toContainText('15 matching non-Datacurve reports')

  await reportRow.locator('.table-model-button').click()
  await expect(page.locator('.selected-guide')).toHaveCount(0)
  await expect(page.locator(`[data-suppressed-selection="${reportId}"]`)).toContainText('no chart position or guide is assigned')
  await expect(page.locator('.evidence-panel .chart-suppression-detail')).toContainText('Not plotted in the combined chart')

  await page.locator('.source-toggle-organizer input').uncheck()
  await expect(reportRow).toHaveCount(1)
  await expect(page.locator(`.plot-point[data-observation-id="${reportId}"], .no-data-point[data-observation-id="${reportId}"]`)).toHaveCount(0)
  await expect(page.locator(`[data-suppressed-selection="${reportId}"]`)).toBeVisible()

  await page.getByRole('combobox', { name: /^Publisher \/ source$/ }).selectOption('Fireworks AI')
  await page.getByRole('combobox', { name: /^Harness \/ protocol$/ }).selectOption('unknown')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(4)
  await expect(fireworksRow.locator('.table-chart-suppression')).toContainText('does not specify its benchmark version')
  await expect(page.locator(`.estimated-point[data-observation-id="${fireworksId}"], .plot-point[data-observation-id="${fireworksId}"], .no-data-point[data-observation-id="${fireworksId}"]`)).toHaveCount(0)
  await expect(page.locator('.chart-precedence-note')).toContainText('3 matching non-Datacurve reports')
  await fireworksRow.locator('.table-model-button').click()
  await expect(page.locator('.selected-guide')).toHaveCount(0)
  await expect(page.locator(`[data-suppressed-selection="${fireworksId}"]`)).toBeVisible()
  await expect(page.locator('.evidence-panel .chart-suppression-detail')).toContainText('does not specify its benchmark version')

  const allJsonDownload = page.waitForEvent('download')
  await page.getByRole('link', { name: 'All JSON' }).click()
  const path = await (await allJsonDownload).path()
  const exported = JSON.parse(await readFile(path!, 'utf8')) as ExportedDataset
  expect(exported.observations.some((row) => row.id === reportId)).toBe(true)
  expect(exported.observations.some((row) => row.id === fireworksId)).toBe(true)
})

test('no-data marks use a separate gutter through X/statistic/scale changes', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.no-data-point')).toHaveCount(22)
  await expect(page.locator('.no-data-lane-count')).toHaveText('22')
  expect(await noDataSymbolOverlaps(page)).toEqual([])
  const lunaReference = page.locator('.no-data-point[data-observation-id="openai-gpt-6-luna-v1.1-max"]')
  const opusReference = page.locator('.no-data-point[data-observation-id="anthropic-claude-opus-5.5-v1.1"]')
  for (const metric of ['Cost per task', 'Output tokens per task', 'Time per task']) {
    await page.getByRole('button', { name: metric, exact: true }).click()
    for (const statistic of ['Mean', 'Median']) {
      await page.getByRole('button', { name: statistic, exact: true }).click()
      await expect(lunaReference).toHaveCount(1)
      await expect(opusReference).toHaveCount(1)
      expect(await noDataSymbolOverlaps(page)).toEqual([])
    }
  }
  await page.getByRole('button', { name: 'Log', exact: true }).click()
  await expect(lunaReference).toHaveCount(1)
  await expect(opusReference).toHaveCount(1)

  await page.goto('?score=pass_at_4')
  const fallback = page.locator('.no-data-entry[data-observation-id="openai-gpt-6-luna-v1.1-max"]')
  await expect(fallback).toHaveAttribute('data-score-metric', 'reported_score_unspecified')
  await expect(fallback).toHaveAttribute('aria-label', /Different metric from selected pass@4/)

  await page.goto('?q=luna&publisher=OpenAI')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(1)
  await expect(page.locator('.plot-point')).toHaveCount(0)
  await expect(page.locator('.no-data-point')).toHaveCount(1)
  await expect(page.locator('.x-tick-label')).toHaveCount(0)
  await expect(page.locator('.effort-chart')).toHaveAttribute('aria-label', /no usable numeric Cost per task values/)
  await expect(page.locator('.effort-chart .x-axis-title')).toHaveCount(1)
  await expect(page.locator('.effort-chart .x-axis-title')).toContainText('NO NUMERIC X DATA')
  await expect(page.locator('.effort-chart')).toContainText('NO DATA')
  await expect(page.locator('.effort-chart')).toContainText('outside numeric X scale')
  await expect(page.locator('.no-data-point[data-observation-id="deepseek-v4.1-flash-mini-swe-v1.1"]')).toHaveCount(0)
})

test('a missing middle X breaks the measured path while retaining a no-data mark; log zero stays a known omission', async ({ page }) => {
  const source = JSON.parse(await readFile(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')) as Dataset
  const fixture: Dataset = structuredClone(source)
  const medium = fixture.observations.find((row) => row.upstreamConfigurationId === 'mini_swe_agent_gpt_6_astra_medium')!
  medium.metrics.cost.value = null
  medium.metrics.cost.reportedValue = null
  medium.metrics.cost.missingReason = 'Browser fixture has no mean cost.'
  await page.route('**/data/observations.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }))
  await page.goto('?view=official&q=astra')

  const reference = page.locator('.no-data-point[data-observation-id="datacurve-v1.1:mini_swe_agent_gpt_6_astra_medium"]')
  await expect(reference).toHaveCount(1)
  const sameSeriesPaths = page.locator(`.curve-path[data-series-id="${medium.series.id}"]`)
  await expect(sameSeriesPaths).toHaveCount(1)
  const connectedIds = await sameSeriesPaths.first().getAttribute('data-observation-ids')
  expect(connectedIds).not.toContain('datacurve-v1.1:mini_swe_agent_gpt_6_astra_low')
  expect(connectedIds).not.toContain(medium.id)

  const zeroFixture: Dataset = structuredClone(source)
  const luna = zeroFixture.observations.find((row) => row.id === 'openai-gpt-6-luna-v1.1-max')!
  luna.metrics.cost.value = 0
  luna.metrics.cost.reportedValue = 0
  luna.metrics.cost.missingReason = null
  await page.unroute('**/data/observations.json')
  await page.route('**/data/observations.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(zeroFixture) }))
  await page.goto('?q=luna&publisher=OpenAI&scale=log')
  await expect(page.locator('.no-data-point[data-observation-id="openai-gpt-6-luna-v1.1-max"]')).toHaveCount(0)
  await expect(page.locator('.chart-footnote')).toContainText('zero omitted on log scale')
  await expect(page.locator('.chart-footnote')).not.toContainText('missing X')
})

test('all three X metrics, statistic, scale, and connections survive a shared-URL reload', async ({ page }) => {
  await page.goto('?view=official')
  const outputTokens = page.getByRole('button', { name: 'Output tokens per task' })
  await outputTokens.click()
  await expect(page).toHaveURL(/x=outputTokens/)
  await expect(page.locator('.coverage-row')).toContainText('output tokens per source-defined attempt')

  await page.getByRole('button', { name: 'Time per task' }).click()
  await expect(page).toHaveURL(/x=time/)
  await expect(page.locator('.timing-scope-note')).toContainText('timer boundaries and duration-specific sample counts are not reported')
  await expect(page.locator('.coverage-row')).toContainText('70 / 70')

  await page.getByRole('button', { name: 'Median', exact: true }).click()
  await page.getByRole('button', { name: 'Log', exact: true }).click()
  await page.getByLabel('Connect levels').uncheck()
  await expect(page).toHaveURL(/stat=median/)
  await expect(page).toHaveURL(/scale=log/)
  await expect(page).toHaveURL(/lines=0/)

  const sharedUrl = page.url()
  await page.goto(sharedUrl)
  await expect(page.getByRole('button', { name: 'Time per task' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Median', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Log', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Connect levels')).not.toBeChecked()
  await expect(page.locator('.plot-point')).toHaveCount(70)
})

test('publisher/model filters and strict mode do not combine unknown protocol groups', async ({ page }) => {
  await page.goto('?view=combined')
  const approvedCount = (await loadDataset(page)).observations.length
  await expect(page.locator('.results-table tbody tr')).toHaveCount(approvedCount)
  const versionUnknownPaperRow = page.locator('.results-table tbody tr').filter({ hasText: '70.0%' })
  await expect(versionUnknownPaperRow.locator('td').nth(0)).toContainText('unspecified')

  await page.getByRole('combobox', { name: /^Benchmark version$/ }).selectOption('1.1')
  await expect(page).toHaveURL(/version=1.1/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(113)
  await page.getByRole('combobox', { name: /^Harness \/ protocol$/ }).selectOption('mini-swe-agent')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(72)
  await page.getByRole('combobox', { name: /^Harness \/ protocol$/ }).selectOption('all')

  const sourceToggles = page.locator('.source-filter input[type="checkbox"]')
  await sourceToggles.nth(0).uncheck()
  await expect(page).toHaveURL(/sources=/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(43)
  await sourceToggles.nth(0).check()

  await page.getByRole('searchbox', { name: 'Search models / publishers' }).fill('Astra')
  await expect(page).toHaveURL(/q=Astra/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(6)
  await page.getByRole('searchbox', { name: 'Search models / publishers' }).fill('')
  await page.getByRole('button', { name: 'Best only' }).click()
  await expect(page).toHaveURL(/effort=best/)
  expect(await page.locator('.results-table tbody tr').count()).toBeLessThan(approvedCount)
  await page.getByRole('button', { name: 'All levels' }).click()

  const publisher = page.getByLabel('Publisher / source')
  await publisher.selectOption('Artificial Analysis')
  await expect(page).toHaveURL(/publisher=Artificial%20Analysis|publisher=Artificial\+Analysis/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(12)
  await page.reload()
  await expect(page.locator('.results-table tbody tr')).toHaveCount(12)

  await page.getByRole('button', { name: 'Reset all' }).click()
  await page.locator('.legend-item').filter({ hasText: /GPT-6 Astra.*Datacurve/ }).click()
  await expect(page).toHaveURL(/model=/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(5)
  await page.getByRole('button', { name: 'Reset all' }).click()
  const modelPicker = page.locator('.model-picker')
  await modelPicker.locator('summary').click()
  await expect(modelPicker).toHaveJSProperty('open', true)
  await page.locator('.model-picker-list label').filter({ hasText: /^GPT-6 Astra — Datacurve · mini-swe-agent$/ }).getByRole('checkbox').check()
  await expect(page.locator('.results-table tbody tr')).toHaveCount(5)
  await page.getByRole('button', { name: 'Reset all' }).click()
  await page.getByRole('checkbox', { name: /Strict comparisons/ }).check()
  await expect(page.locator('.strict-note')).toContainText('No complete groups match the current filters')
  await expect(page.locator('.strict-note')).toContainText('Unknown protocol fields fail closed')
  await expect(page.locator('.results-table .table-model-button')).toHaveCount(0)
  await expect(page.locator('.empty-table-cell')).toBeVisible()

})

test('Models & sources checkboxes keep all models available through multiselect, deselection and reload', async ({ page }) => {
  await page.goto('?view=combined')
  await expect(page.getByRole('heading', { name: 'Models & sources' })).toBeVisible()
  const options = page.locator('.legend-list input[type="checkbox"]')
  const initialCount = await options.count()
  expect(initialCount).toBeGreaterThan(2)
  const first = options.nth(0)
  const second = options.nth(1)
  await expect(first).toBeVisible()
  await expect(first).toHaveAccessibleName(/\S/)
  await first.check()
  await expect(options).toHaveCount(initialCount)
  const firstKey = new URL(page.url()).searchParams.getAll('model')[0]
  await second.check()
  await expect(options).toHaveCount(initialCount)
  await expect(first).toBeChecked()
  await expect(second).toBeChecked()
  const selected = new URL(page.url()).searchParams.getAll('model')
  expect(selected).toHaveLength(2)

  await page.reload()
  await expect(page.getByRole('heading', { name: 'Models & sources' })).toBeVisible()
  await expect(options).toHaveCount(initialCount)
  await expect(first).toBeChecked()
  await expect(second).toBeChecked()
  await first.focus()
  await first.press('Space')
  await expect(first).not.toBeChecked()
  await expect(options).toHaveCount(initialCount)
  await expect(second).toBeChecked()
  expect(new URL(page.url()).searchParams.getAll('model')).toEqual(selected.filter((key) => key !== firstKey))
  await second.uncheck()
  await expect(options).toHaveCount(initialCount)
  expect(new URL(page.url()).searchParams.getAll('model')).toEqual([])

  await page.setViewportSize({ width: 375, height: 820 })
  await options.nth(2).check()
  await expect(options).toHaveCount(initialCount)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
})

test('strict mode explicitly selects one compatible protocol group and reloads that choice', async ({ page }) => {
  const source = JSON.parse(await readFile(new URL('../data/approved/dataset.json', import.meta.url), 'utf8')) as Dataset
  const configs = [
    'mini_swe_agent_gpt_6_astra_low',
    'mini_swe_agent_gpt_6_astra_medium',
    'mini_swe_agent_gpt_6_astra_high',
  ]
  const originals = configs.map((config) => source.observations.find((row) => row.upstreamConfigurationId === config)!)
  const [low, medium, high] = originals.map((original) => {
    const row = structuredClone(original)
    row.series.harnessRevision = 'mini-swe-agent fixture revision'
    row.series.evaluationPolicy = 'same fixture timeout and exclusion policy'
    row.series.deployment = 'fixture deployment region'
    row.series.servingEndpoint = 'fixture serving endpoint'
    row.benchmark.taskSetRevision = 'fixture-task-set-sha256'
    row.benchmark.population = 'all scored rollout attempts'
    row.benchmark.excludedPolicy = 'same fixture exclusion policy'
    row.provenance.notes = [...row.provenance.notes, 'Browser-only strict-group fixture; not approved or exported.']
    return row
  })
  high!.benchmark.version = '1.0'
  high!.series.id = `${high!.series.id}|browser-v1.0-group`
  const replacements = new Map(originals.map((row, index) => [row.id, [low!, medium!, high!][index]!]))
  const fixture: Dataset = { ...source, observations: source.observations.map((row) => replacements.get(row.id) ?? row) }
  await page.route('**/data/observations.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }))
  await page.goto('?view=official&strict=1')

  await expect(page.locator('.strict-note')).toContainText('2 compatible groups available')
  const groupSelect = page.getByLabel('Compatible protocol group')
  const options = await groupSelect.locator('option').evaluateAll((items) => items.map((item) => ({ value: (item as HTMLOptionElement).value, label: item.textContent ?? '' })))
  const groups = options.filter((option) => option.value)
  expect(groups).toHaveLength(2)
  const v11Group = groups.find((option) => option.label.includes('1.1 full'))!
  await groupSelect.selectOption(v11Group.value)
  await expect(page).toHaveURL(/protocol=/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(2)
  await expect(page.locator('.results-table tbody')).not.toContainText('v1.0')
  const sharedUrl = page.url()
  await page.goto(sharedUrl)
  await expect(groupSelect).toHaveValue(v11Group.value)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(2)
})

test('score-only reports, reviewed evidence and all/filtered downloads keep attribution metadata', async ({ page }) => {
  await page.goto('?view=combined&score=reported_score_unspecified')
  const approved = await loadDataset(page)
  const approvedCount = approved.observations.length
  const scoreOnlyCount = approved.observations.filter((row) => row.metrics.cost.value === null).length - 15
  await expect(page.locator('.results-table tbody tr')).toHaveCount(approvedCount)
  await expect(page.locator('.score-only-list li')).toHaveCount(scoreOnlyCount)
  await expect(page.locator('.metric-warning')).toContainText('unspecified units')
  await expect(page.locator('.metric-chart-warning')).toContainText('raw values with unspecified units are omitted')
  await expect(page.locator('.legend-symbol.source-developer').first()).toBeVisible()
  await expect(page.locator('.legend-symbol.source-independent').first()).toBeVisible()
  await expect(page.locator('.legend-card .count-stamp')).toHaveText(String(await page.locator('.legend-list input[type="checkbox"]').count()))

  const rawTableRow = page.locator('.results-table tbody tr').filter({ hasText: 'DeepSeek-V4.1-Flash' }).filter({ hasText: '74.2' })
  const explicitPercentRow = page.locator('.results-table tbody tr').filter({ hasText: 'Claude Opus 5.5' }).filter({ hasText: '74.2%' })
  const rawObservationId = await rawTableRow.getAttribute('data-observation-id')
  await expect(rawTableRow.locator('td').nth(2)).toContainText('74.2')
  await expect(rawTableRow.locator('td').nth(2)).toContainText('unit unspecified')
  await expect(rawTableRow.locator('td').nth(2)).not.toContainText('74.2%')
  expect(rawObservationId).not.toBeNull()
  await expect(page.locator(`.no-data-point[data-observation-id="${rawObservationId}"]`)).toHaveCount(0)
  await expect(page.locator('.chart-footnote:not(.chart-precedence-note)')).toContainText('source score unit not established for the percentage axis')
  await expect(explicitPercentRow.locator('td').nth(2)).toHaveText('74.2%')
  await rawTableRow.getByRole('button', { name: 'Details' }).click()
  await expect(page.locator('.evidence-score strong')).toHaveText('74.2')
  const rawScoreOnly = page.locator('.score-only-list li').filter({ hasText: 'DeepSeek V4.1 Flash' }).filter({ hasText: '74.2' })
  await expect(rawScoreOnly.locator('strong')).toHaveText('74.2')
  await expect(rawScoreOnly.locator('.score-only-unscaled')).toContainText('unit unspecified')
  const percentScoreOnly = page.locator('.score-only-list li').filter({ hasText: 'Claude Opus 5.5' })
  await expect(percentScoreOnly.locator('strong')).toHaveText('74.2%')
  await expect(percentScoreOnly.locator('.score-only-bar')).toBeVisible()

  const allJsonDownload = page.waitForEvent('download')
  await page.getByRole('link', { name: 'All JSON' }).click()
  const allJsonFile = await (await allJsonDownload).path()
  const allJson = JSON.parse(await readFile(allJsonFile!, 'utf8')) as ExportedDataset
  expect(allJson.exportMetadata.candidatesIncluded).toBe(false)
  expect(allJson.exportMetadata.datasetRevision).toMatch(/^dsv1\.1-/)
  expect(allJson.observations).toHaveLength(approvedCount)
  expect(allJson.observations.some((row) => row.id.startsWith('synthetic-') || row.id.startsWith('fixture-'))).toBe(false)

  await page.getByLabel('Publisher / source').selectOption('OpenAI')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(7)
  const filteredJsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Filtered JSON' }).click()
  const filteredJsonFile = await (await filteredJsonDownload).path()
  const filteredJson = JSON.parse(await readFile(filteredJsonFile!, 'utf8'))
  expect(filteredJson.exportMetadata.filters.publisher).toBe('OpenAI')
  expect(filteredJson.observations).toHaveLength(7)

  const filteredCsvDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Filtered CSV' }).click()
  const filteredCsvFile = await (await filteredCsvDownload).path()
  const filteredCsv = await readFile(filteredCsvFile!, 'utf8')
  expect(filteredCsv).toContain('# score_metric=reported_score_unspecified')
  expect(filteredCsv).toContain('# filters=')
  expect(filteredCsv).toContain('evidence_locator')
})

test('SVG export, submission draft, methodology/source pages, and mobile layout work', async ({ page }) => {
  await page.goto('./')
  await page.locator('.plot-point').first().click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current chart as SVG' }).click()
  const svgPath = await (await svgDownload).path()
  const svg = await readFile(svgPath!, 'utf8')
  expect(svg).toContain('<svg')
  expect(svg).toContain('curve-path')
  expect(svg).toContain('no-data-lane')
  expect(svg).toContain('.point-hit-area{fill:transparent;stroke:transparent}')
  expect(svg).toContain('.selected-guide-line{fill:none;stroke:#006d68')
  expect(svg).toContain('selected-guide-x')
  expect(svg).toContain('66.6%')

  await page.getByRole('tab', { name: /Review queue/ }).click()
  await expect(page.locator('.candidate-card')).toHaveCount(2)
  await page.getByLabel('Model name as source reports it').fill('Browser Test Model')
  await page.getByLabel('Publisher / evaluator').fill('Test Publisher')
  await page.getByLabel('Source document title').fill('Test evidence')
  await page.getByLabel('Source URL').fill('https://example.invalid/evidence')
  await page.getByLabel('Evidence locator (page, section, figure, row)').fill('p. 4, table 2')
  await page.getByLabel('Raw score as published').fill('58.7%')
  await page.getByLabel('Score metric / unit (e.g. pass@1, 68.8%)').fill('reported score (%)')
  const draftDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download pending JSON draft' }).click()
  const draftPath = await (await draftDownload).path()
  const draft = JSON.parse(await readFile(draftPath!, 'utf8'))
  expect(draft.status).toBe('pending-review')
  expect(draft.source.retrievedAt).toBeNull()
  expect(draft.result.rawReportedText).toBe('58.7%')
  expect(draft.review.instructions).toContain('not uploaded')

  await page.getByRole('button', { name: 'Methodology' }).first().click()
  await expect(page.getByRole('heading', { name: 'Methodology & limits' })).toBeVisible()
  await page.getByRole('button', { name: 'Source register' }).click()
  await expect(page.getByRole('heading', { name: 'Source register' })).toBeVisible()

  await page.setViewportSize({ width: 375, height: 820 })
  await page.goto('?view=combined&x=time')
  await expect(page.locator('.plot-point')).toHaveCount(70)
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  expect(dimensions.width).toBe(375)
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width)
})

test('cost-only source scenarios preserve their basis and leave unsupported X metrics without numeric guides', async ({ page }) => {
  await page.goto('?view=combined&q=Fireworks')
  const reportId = 'fireworks-deepswe-deepseek-v4.1-flash-max'
  const point = page.locator(`.estimated-point[data-observation-id="${reportId}"]`)
  await expect(point).toHaveCount(1)
  await expect(point).toHaveAttribute('aria-label', /Source-reported cost scenario/)
  await expect(point).toHaveAttribute('aria-label', /\$0\.43.*source-reported USD per task.*accounting basis unspecified/)
  await point.click()
  await expect(page.locator('.selected-guide[data-selected-guide-type="estimated"] .selected-guide-x-label')).toContainText('SRC ·')
  const evidence = page.locator('.usage-evidence')
  await expect(evidence).toContainText('SOURCE-REPORTED COST SCENARIO')
  await expect(evidence).toContainText('not normalized as a mean/median cost per scored attempt')
  await expect(evidence).not.toContainText('Mean output tokens')
  await expect(evidence).not.toContainText('Mean reported time')

  const missingOutput = page.locator(`.no-data-point[data-observation-id="${reportId}"]`)
  await page.getByRole('button', { name: 'Output tokens per task', exact: true }).click()
  await expect(page.locator(`.estimated-point[data-observation-id="${reportId}"]`)).toHaveCount(0)
  await expect(missingOutput).toHaveAttribute('aria-label', /scenario exists.*no output tokens per task estimate is available/)
  await missingOutput.click()
  const noDataGuide = page.locator(`.selected-guide[data-selected-guide-for="${reportId}"]`)
  await expect(noDataGuide).toHaveAttribute('data-selected-guide-type', 'no-data')
  await expect(noDataGuide.locator('.selected-guide-x')).toHaveCount(0)
  await expect(noDataGuide.locator('[data-guide-axis="x-missing"]')).toHaveText('NO OUTPUT-TOKEN DATA')
})

test('usage scenarios stay separate from measurements and export independently', async ({ page }) => {
  await page.goto('?view=combined')
  const scenarioToggle = page.getByRole('checkbox', { name: /Include usage scenarios/ })
  await expect(scenarioToggle).toBeChecked()
  await expect(page.locator('.estimated-point')).toHaveCount(9)

  const lunaId = 'aa-codex-gpt-6-luna-max-v1.1'
  const opusId = 'artificial-analysis-claude-code-opus-5.5-max-v1.1'
  const lunaEstimate = page.locator(`.estimated-point[data-observation-id="${lunaId}"]`)
  const opusEstimate = page.locator(`.estimated-point[data-observation-id="${opusId}"]`)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /Estimated usage scenario — not a DeepSWE measurement/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /64%.*pass@1/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /\$0\.21.*USD per scored rollout attempt/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /sensitivity envelope.*not a confidence interval/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /Very low|very low/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /No defensible sensitivity range/)
  await expect(page.locator('.usage-scenario-note')).toContainText('separate from measurements')
  await expect(page.locator('.usage-scenario-note')).toContainText('AA three-benchmark suite proxies')
  await expect(page.locator(`.no-data-point[data-observation-id="${lunaId}"]`)).toHaveCount(0)

  const lunaRow = page.locator(`.results-table tr[data-observation-id="${lunaId}"]`)
  await expect(lunaRow.locator('td').nth(3)).toContainText('Mean task cost is not inferred')
  await expect(lunaRow.locator('td').nth(3)).toContainText('Estimated scenario')
  await expect(lunaRow.locator('td').nth(3)).toContainText('$0.21 · USD per scored rollout attempt')
  await expect(lunaRow.locator('td').nth(3)).toContainText('not a confidence interval')
  await lunaEstimate.click()
  await expect(page.locator('.evidence-panel .evidence-score strong')).toHaveText('64%')
  await expect(page.locator('.evidence-panel .evidence-metrics')).toContainText('Not reported')
  await expect(page.locator('.usage-evidence')).toContainText('ESTIMATED USAGE SCENARIO · NOT MEASURED')
  await expect(page.locator('.usage-evidence')).toContainText('10,200,000 tokens/task')
  await expect(page.locator('.usage-evidence')).toContainText('not used as an output count')
  await expect(page.locator('.usage-evidence a')).toHaveCount(3)

  await scenarioToggle.uncheck()
  await expect(page).toHaveURL(/scenarios=0/)
  await expect(page.locator('.estimated-point')).toHaveCount(0)
  await expect(page.locator(`.no-data-point[data-observation-id="${lunaId}"]`)).toHaveCount(1)
  await expect(page.locator('.no-data-lane-count')).toHaveText('31')
  expect(await noDataSymbolOverlaps(page)).toEqual([])
  await page.reload()
  await expect(scenarioToggle).not.toBeChecked()

  await page.goto('?view=combined&x=outputTokens')
  await expect(page.locator('.estimated-point')).toHaveCount(8)
  await expect(page.locator('.estimated-point[data-x-metric="outputTokens"]')).toHaveCount(8)
  await expect(page.locator('.x-tick-label')).not.toHaveCount(0)
  await expect(page.locator('.usage-scenario-note')).toContainText('Coding Agent suite mixed-token totals')
  await expect(lunaEstimate).toHaveAttribute('aria-label', /108,272 AA DeepSWE v1\.1 output tokens \/ task attempt/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /AA Coding Agent suite total 10,200,000 tokens\/task mixes categories/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /No defensible sensitivity range or prediction interval/)

  await page.getByRole('button', { name: 'Time per task', exact: true }).click()
  await expect(page.locator('.estimated-point')).toHaveCount(3)
  await expect(page.locator('.usage-scenario-note')).toContainText('Time scenarios use measured per-task wall-clock pairs')
  await page.getByRole('button', { name: 'Median', exact: true }).click()
  await expect(page.locator('.estimated-point')).toHaveCount(0)
  await expect(page.locator('.usage-scenario-note')).toContainText('Scenarios are shown only with the Mean control')
  await expect(page.locator(`.no-data-point[data-observation-id="${lunaId}"]`)).toHaveCount(1)
  await page.getByRole('button', { name: 'Cost per task', exact: true }).click()
  await page.getByRole('button', { name: 'Median', exact: true }).click()
  await expect(page.locator('.estimated-point')).toHaveCount(0)
  await expect(page.locator(`.no-data-point[data-observation-id="${opusId}"]`)).toHaveCount(1)

  await page.goto('?view=combined&strict=1')
  await expect(page.locator('.estimated-point')).toHaveCount(0)
  await expect(page.locator('.usage-scenario-note')).toContainText('Strict comparison excludes usage scenarios')

  await page.goto('?view=combined')
  await page.locator('.scenario-export-group summary').click()
  const scenarioDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'All scenarios JSON' }).click()
  const scenarioPath = await (await scenarioDownload).path()
  const scenarioExport = JSON.parse(await readFile(scenarioPath!, 'utf8'))
  expect(scenarioExport.exportMetadata.exportType).toBe('usage-scenarios-only')
  expect(scenarioExport.scenarios).toHaveLength(17)
  expect(scenarioExport.scenarios.every((item: { recordType: string; measurement: { meanCostUsd: number | null }; scenario: { costUsd: number; costUnit: string } }) => ['estimated_usage_scenario', 'source_reported_cost_scenario', 'source_reported_output_with_cost_scenario'].includes(item.recordType) && item.measurement.meanCostUsd === null && item.scenario.costUsd > 0 && item.scenario.costUnit.length > 0)).toBe(true)
  expect(scenarioExport.scenarios.filter((item: { recordType: string }) => item.recordType === 'source_reported_output_with_cost_scenario')).toHaveLength(10)
  expect(scenarioExport.scenarios.filter((item: { recordType: string }) => item.recordType === 'source_reported_cost_scenario')).toHaveLength(4)
  const deepseekOutput = scenarioExport.scenarios.find((item: { targetObservationId: string }) => item.targetObservationId === 'aa-codex-deepseek-v4-pro-0813-max-v1.1')
  expect(deepseekOutput.measurement.meanOutputTokens).toBeNull()
  expect(deepseekOutput.scenario.outputEvidenceType).toBe('same-source-deepswe-mean')
  expect(deepseekOutput.scenario.meanOutputTokensPerSourceAttempt).toBeCloseTo(116676.62241887905)
  const google = scenarioExport.scenarios.find((item: { targetObservationId: string }) => item.targetObservationId === 'google-gemini-3.8-flash-high-v1.1')
  expect(google.scenario.outputEvidenceType).toBe('cross-experiment-reference')
  expect(google.measurement.meanOutputTokens).toBeNull()
})

test('AA DeepSWE output and suppressed Google cross-run evidence stay attached to their source rows', async ({ page }) => {
  await page.goto('?view=combined&x=outputTokens')
  const aa = page.locator('.estimated-point[data-observation-id="aa-codex-deepseek-v4-pro-0813-max-v1.1"]')
  await expect(aa).toHaveAttribute('aria-label', /Same-source AA DeepSWE mean/)
  await expect(aa).toHaveAttribute('aria-label', /dollar value is a three-benchmark pooled-suite proxy/)
  await aa.click()
  await expect(page.locator('.selected-guide[data-selected-guide-type="source-output"]')).toHaveAttribute('aria-label', /source-reported AA DeepSWE output mean per task attempt.*output-telemetry sample count unspecified/)
  await expect(page.locator('.selected-guide-x-label')).toContainText('AA MEAN ·')
  await expect(aa.locator('.estimated-label')).toContainText('AA MEAN ·')
  await expect(page.locator('.x-axis-title')).toContainText('SOURCE-DEFINED ATTEMPT')
  await expect(page.locator('.token-scope-note')).toContainText('DeepSWE task-attempt mean without an output-telemetry-specific sample count')
  await expect(page.locator('.usage-evidence')).toContainText('AA DeepSWE v1.1 output tokens / task attempt')
  await expect(page.locator('.usage-evidence')).toContainText('AA three-benchmark')
  await expect(page.locator('.usage-evidence .scenario-label')).toContainText('AA SOURCE-REPORTED DEEPSWE OUTPUT MEAN · COST EVIDENCE SEPARATE')
  await expect(page.locator('.evidence-metrics')).toContainText('Not reported')
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current chart as SVG' }).click()
  const svg = await readFile((await (await svgDownload).path())!, 'utf8')
  expect(svg).toContain('AA MEAN ·')
  expect(svg).toContain('source-reported AA DeepSWE output mean per task attempt')
  expect(svg).toContain('SOURCE-DEFINED ATTEMPT')
  const luna = page.locator('.estimated-point[data-observation-id="aa-codex-gpt-6-luna-max-v1.1"]')
  await expect(luna).toHaveAttribute('aria-label', /cost\/time scenarios are cross-benchmark transfers, not AA DeepSWE measurements/)
  await expect(luna).not.toHaveAttribute('aria-label', /only its dollar cost is pooled across the suite/)
  const opusRow = page.locator('.results-table tr[data-observation-id="aa-claude-code-opus-5-max-v1.1"]')
  await expect(opusRow).toContainText('Same-source AA DeepSWE mean')
  await opusRow.getByRole('button', { name: 'Details' }).click()
  await expect(page.locator('.usage-evidence')).toContainText('Same-model, same-max Datacurve mean USD per scored attempt')
  await expect(page.locator('.usage-evidence')).toContainText('Source-reported mean · AA DeepSWE v1.1 output tokens / task attempt')
  const grokRow = page.locator('.results-table tr[data-observation-id="xai-grok-4.7-high-v1.1"]')
  await expect(grokRow).toContainText('Grok predecessors and target are all high effort')
  await expect(grokRow).not.toContainText('Meta xhigh→max')
  const googleId = 'google-gemini-3.8-flash-high-v1.1'
  await expect(page.locator(`.estimated-point[data-observation-id="${googleId}"]`)).toHaveCount(0)
  const googleRow = page.locator(`.results-table tr[data-observation-id="${googleId}"]`)
  await expect(googleRow).toContainText('Not charted')
  await expect(googleRow).toContainText('143,243 output tokens')
  await googleRow.getByRole('button', { name: 'Details' }).click()
  await expect(page.locator('.usage-evidence')).toContainText('mini_swe_agent_gemini_3_8_flash_high')
})
