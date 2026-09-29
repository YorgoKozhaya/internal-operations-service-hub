import { Injectable } from '@nestjs/common';

@Injectable()
export class MailerService {
  async sendStatusEmail(to: string, requestId: string, title: string, status: string): Promise<void> {
    const key = process.env.RESEND_API_KEY;

    if (!key || !to) {
      return;
    }

    const label = title ? `${requestId} (${title})` : requestId;

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Internal Operations <onboarding@resend.dev>',
          to: [to],
          subject: `${requestId} is now ${status}`,
          text: `${label} is now ${status}.`,
        }),
      });
    } catch {
      // A mail problem must not undo the status that was already saved.
    }
  }
}
