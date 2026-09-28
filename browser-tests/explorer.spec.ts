import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
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

test('no-data marks use a separate gutter through X/statistic/scale changes', async ({ page }) => {
  await page.goto('./')
  await expect(page.locator('.no-data-point')).toHaveCount(38)
  await expect(page.locator('.no-data-lane-count')).toHaveText('38')
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
  await expect(page.locator('.coverage-row')).toContainText('output tokens per scored rollout attempt')

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

  await page.getByLabel('Benchmark version').selectOption('1.1')
  await expect(page).toHaveURL(/version=1.1/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(107)
  await page.getByLabel('Harness / protocol').selectOption('mini-swe-agent')
  await expect(page.locator('.results-table tbody tr')).toHaveCount(71)
  await page.getByLabel('Harness / protocol').selectOption('all')

  const sourceToggles = page.locator('.source-filter input[type="checkbox"]')
  await sourceToggles.nth(0).uncheck()
  await expect(page).toHaveURL(/sources=/)
  await expect(page.locator('.results-table tbody tr')).toHaveCount(37)
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
  const scoreOnlyCount = approved.observations.filter((row) => row.metrics.cost.value === null).length
  await expect(page.locator('.results-table tbody tr')).toHaveCount(approvedCount)
  await expect(page.locator('.score-only-list li')).toHaveCount(scoreOnlyCount)
  await expect(page.locator('.metric-warning')).toContainText('unspecified units')
  await expect(page.locator('.metric-chart-warning')).toContainText('raw values with unspecified units are omitted')
  await expect(page.locator('.legend-symbol.source-developer')).toHaveCount(9)
  await expect(page.locator('.legend-symbol.source-independent')).toHaveCount(16)

  const rawTableRow = page.locator('.results-table tbody tr').filter({ hasText: 'DeepSeek-V4.1-Flash' }).filter({ hasText: '74.2' })
  const explicitPercentRow = page.locator('.results-table tbody tr').filter({ hasText: 'Claude Opus 5.5' }).filter({ hasText: '74.2%' })
  const rawObservationId = await rawTableRow.getAttribute('data-observation-id')
  await expect(rawTableRow.locator('td').nth(2)).toContainText('74.2')
  await expect(rawTableRow.locator('td').nth(2)).toContainText('unit unspecified')
  await expect(rawTableRow.locator('td').nth(2)).not.toContainText('74.2%')
  expect(rawObservationId).not.toBeNull()
  await expect(page.locator(`.no-data-point[data-observation-id="${rawObservationId}"]`)).toHaveCount(0)
  await expect(page.locator('.chart-footnote')).toContainText('source score unit not established for the percentage axis')
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
  await expect(page.locator('.results-table tbody tr')).toHaveCount(2)
  const filteredJsonDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Filtered JSON' }).click()
  const filteredJsonFile = await (await filteredJsonDownload).path()
  const filteredJson = JSON.parse(await readFile(filteredJsonFile!, 'utf8'))
  expect(filteredJson.exportMetadata.filters.publisher).toBe('OpenAI')
  expect(filteredJson.observations).toHaveLength(2)

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
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download current chart as SVG' }).click()
  const svgPath = await (await svgDownload).path()
  const svg = await readFile(svgPath!, 'utf8')
  expect(svg).toContain('<svg')
  expect(svg).toContain('curve-path')
  expect(svg).toContain('no-data-lane')
  expect(svg).toContain('.point-hit-area{fill:transparent;stroke:transparent}')
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

test('usage scenarios stay separate from measurements, are mean-only, and export independently', async ({ page }) => {
  await page.goto('?view=combined')
  const scenarioToggle = page.getByRole('checkbox', { name: /Include usage scenarios/ })
  await expect(scenarioToggle).toBeChecked()
  await expect(page.locator('.estimated-point')).toHaveCount(7)

  const lunaId = 'aa-codex-gpt-6-luna-max-v1.1'
  const opusId = 'artificial-analysis-claude-code-opus-5.5-max-v1.1'
  const lunaEstimate = page.locator(`.estimated-point[data-observation-id="${lunaId}"]`)
  const opusEstimate = page.locator(`.estimated-point[data-observation-id="${opusId}"]`)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /Estimated usage scenario — not a DeepSWE measurement/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /64%.*pass@1/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /\$0\.21 per scored attempt/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /sensitivity envelope.*not a confidence interval/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /Very low|very low/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /No defensible sensitivity range/)
  await expect(page.locator('.usage-scenario-note')).toContainText('not DeepSWE measurements')
  await expect(page.locator('.usage-scenario-note')).toContainText('Cost scenarios use separate source-reported DeepSWE rows')
  await expect(page.locator(`.no-data-point[data-observation-id="${lunaId}"]`)).toHaveCount(0)

  const lunaRow = page.locator(`.results-table tr[data-observation-id="${lunaId}"]`)
  await expect(lunaRow.locator('td').nth(3)).toContainText('Mean task cost is not inferred')
  await expect(lunaRow.locator('td').nth(3)).toContainText('Estimated scenario')
  await expect(lunaRow.locator('td').nth(3)).toContainText('$0.21 / scored attempt')
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
  await expect(page.locator('.no-data-lane-count')).toHaveText('45')
  expect(await noDataSymbolOverlaps(page)).toEqual([])
  await page.reload()
  await expect(scenarioToggle).not.toBeChecked()

  await page.goto('?view=combined&x=outputTokens')
  await expect(page.locator('.estimated-point')).toHaveCount(7)
  await expect(page.locator('.estimated-point[data-x-metric="outputTokens"]')).toHaveCount(7)
  await expect(page.locator('.x-tick-label')).not.toHaveCount(0)
  await expect(page.locator('.usage-scenario-note')).toContainText('Coding Agent suite totals mix input, cache, cache-write, reasoning, and output')
  await expect(lunaEstimate).toHaveAttribute('aria-label', /98,422 output tokens per scored attempt/)
  await expect(lunaEstimate).toHaveAttribute('aria-label', /AA Coding Agent suite total 10,200,000 tokens\/task mixes categories/)
  await expect(opusEstimate).toHaveAttribute('aria-label', /No defensible sensitivity range or prediction interval/)

  await page.getByRole('button', { name: 'Time per task', exact: true }).click()
  await expect(page.locator('.estimated-point')).toHaveCount(7)
  await expect(page.locator('.usage-scenario-note')).toContainText('Time scenarios use measured per-task wall-clock pairs')
  await page.getByRole('button', { name: 'Median', exact: true }).click()
  await expect(page.locator('.estimated-point')).toHaveCount(0)
  await expect(page.locator('.usage-scenario-note')).toContainText('Scenarios are mean-only')
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
  expect(scenarioExport.exportMetadata.exportType).toBe('estimated-usage-scenarios-only')
  expect(scenarioExport.scenarios).toHaveLength(7)
  expect(scenarioExport.scenarios.every((item: { recordType: string; measurement: { meanCostUsd: number | null }; scenario: { meanCostUsdPerScoredAttempt: number } }) => item.recordType === 'estimated_usage_scenario' && item.measurement.meanCostUsd === null && item.scenario.meanCostUsdPerScoredAttempt > 0)).toBe(true)
})
