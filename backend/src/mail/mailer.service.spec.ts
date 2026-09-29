import { MailerService } from './mailer.service';

describe('status email', () => {
  const previous = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previous;
    }
  });

  it('does nothing when the Resend key is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const mailer = new MailerService();

    await expect(
      mailer.sendStatusEmail('yorgokozhaya1111@gmail.com', 'REQ-1001', 'Laptop keyboard', 'Assigned'),
    ).resolves.toBeUndefined();
  });
});
