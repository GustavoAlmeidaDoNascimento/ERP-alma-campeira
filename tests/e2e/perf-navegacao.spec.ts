import { test, expect } from '@playwright/test'

const EMAIL = process.env.PLAYWRIGHT_EMAIL
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD
const META_MS = 700

const ROTAS = ['/inicio', '/materias-primas', '/facas', '/fornecedores', '/clientes']

test.describe('Performance de navegação', () => {
  test.skip(!EMAIL || !PASSWORD, 'Defina PLAYWRIGHT_EMAIL e PLAYWRIGHT_PASSWORD no ambiente')

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(EMAIL!)
    await page.getByRole('textbox', { name: 'Senha' }).fill(PASSWORD!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
  })

  for (const rota of ROTAS) {
    test(`${rota} carrega em até ${META_MS}ms (2ª visita)`, async ({ page }) => {
      // 1ª visita: aquece compilação/cache
      await page.goto(rota, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-nav-content-ready]', { timeout: 60_000 }).catch(() => {})

      const inicio = Date.now()
      await page.goto(rota, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('[data-nav-content-ready]', { timeout: 60_000 })
      const ms = Date.now() - inicio

      // eslint-disable-next-line no-console
      console.log(`[PERF E2E] ${rota} → ${ms}ms`)
      expect(ms).toBeLessThanOrEqual(META_MS)
    })
  }
})
