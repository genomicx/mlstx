import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.join(__dirname, '../fixtures/ecoli_novel.fa')

test.describe('MLST e2e — E. coli Achtman genome', () => {
  test('auto-detects scheme and types genome', async ({ page }) => {
    await page.goto('/')

    // Upload the E. coli fixture genome via the hidden file input
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(FIXTURE)

    // App should immediately start detecting + running MLST
    // Wait for progress text to appear
    await expect(page.getByText(/detecting|loading|parsing|mapping/i)).toBeVisible({
      timeout: 10_000,
    })

    // Wait for results section to appear — WASM loading + alignment can take ~60s
    const resultsSection = page.locator('.results')
    await expect(resultsSection).toBeVisible({ timeout: 120_000 })

    // Results table should have at least one data row
    const resultRows = page.locator('.results-table tbody tr')
    await expect(resultRows).toHaveCount(1)

    // Scheme label should reflect the auto-detected scheme (ecoli or ecoli_achtman_4)
    const schemeLabel = page.locator('.scheme-selector label')
    await expect(schemeLabel).toContainText(/ecoli/i)

    // No error should be shown
    await expect(page.locator('.error')).not.toBeVisible()

    // ST cell should be present (may be a novel ST — that's expected for this fixture)
    const stCell = page.locator('.st-cell').first()
    await expect(stCell).toBeVisible()
  })
})
