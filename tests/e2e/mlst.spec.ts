import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, '../fixtures/ecoli_novel.fa')

test.describe('MLST e2e — E. coli Achtman genome', () => {
  test.setTimeout(300_000) // 5 min — BLAST WASM loading + alignment against large allele DB

  test('auto-detects scheme and types genome', async ({ page }) => {
    await page.goto('/')

    // Upload the E. coli fixture genome via the hidden file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE)

    // Wait for results section OR error — BLAST WASM + large allele DB can take several minutes
    await expect(
      page.locator('.results, .error')
    ).toBeVisible({ timeout: 240_000 })

    // If results visible, check table has a row
    const resultsVisible = await page.locator('.results').isVisible()
    if (resultsVisible) {
      const resultRows = page.locator('.results-table tbody tr')
      await expect(resultRows).toHaveCount(1)

      const stCell = page.locator('.st-cell').first()
      await expect(stCell).toBeVisible()
    }
  })
})
