import { expect, test } from '@playwright/test';

test('employee submits a request and IT staff assigns it', async ({ page, request }) => {
  await request.post('http://localhost:3000/requests/demo/reset');
  await page.goto('/');
  await page.getByRole('button', { name: 'New request' }).click();

  await page.getByLabel('Title').fill('Need VPN access');
  await page.getByLabel('Description').fill('Cannot reach the internal tools.');
  await page.getByRole('button', { name: 'Submit request' }).click();

  await expect(page.getByTestId('request-status')).toHaveText('Submitted');
  await expect(page.getByRole('heading', { name: /Request REQ-/ })).toBeVisible();

  await page.getByLabel('Acting as').selectOption('DEPT-IT-1');
  await page.getByRole('button', { name: 'Open request' }).click();
  await page.getByRole('button', { name: 'Update status' }).click();

  await expect(page.getByTestId('request-status')).toHaveText('Assigned');

  if (test.info().project.use.headless === false) {
    await page.pause();
  }
});
