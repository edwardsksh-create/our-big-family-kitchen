// Branded HTML magic-link email used by the NextAuth Resend provider.
// Falls back to a clean plain-text version for clients that don't render HTML.

import { FAMILY } from '@/config/family';

export type MagicLinkParams = {
  url:  string;
  host: string;  // bare host (e.g. "bigfamilykitchen.com"); used in plain text only
};

export function magicLinkHtml({ url, host }: MagicLinkParams): string {
  // Inline-style email HTML for maximum client compatibility (no external CSS).
  // Brand palette mirrors the site: paper / cream / ink / burgundy.
  const PAPER    = '#FBF7EE';
  const INK      = '#2A2522';
  const INK_SOFT = '#5C544F';
  const PRIMARY  = '#8D2842';
  const RULE     = 'rgba(42, 37, 34, 0.12)';

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:${PAPER};font-family:Georgia,'Times New Roman',serif;color:${INK};-webkit-font-smoothing:antialiased;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${PAPER};">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;background:#fff;border:1px solid ${RULE};border-radius:16px;">
            <tr>
              <td style="padding:36px 36px 24px 36px;">
                <p style="margin:0 0 8px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:${INK_SOFT};">${FAMILY.siteName}</p>
                <h1 style="margin:0;font-size:26px;line-height:1.2;color:${INK};font-weight:600;font-style:italic;">
                  Welcome &mdash; your sign-in link.
                </h1>
                <p style="margin:18px 0 0 0;font-size:16px;line-height:1.55;color:${INK_SOFT};">
                  Tap the button below to sign in to the kitchen. The link is good for the next 24 hours.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 36px 36px 36px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:999px;background:${PRIMARY};">
                      <a href="${url}" style="display:inline-block;padding:14px 28px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${PAPER};text-decoration:none;border-radius:999px;">
                        Sign in
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:${INK_SOFT};">
                  If the button doesn&rsquo;t work, paste this URL into your browser:
                </p>
                <p style="margin:6px 0 0 0;font-size:12px;line-height:1.4;color:${INK_SOFT};word-break:break-all;">
                  ${url}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 28px 36px;border-top:1px solid ${RULE};font-size:12px;color:${INK_SOFT};line-height:1.5;">
                <p style="margin:0;font-style:italic;">
                  Didn&rsquo;t ask to sign in? You can ignore this email &mdash; nothing happens until the link is clicked.
                </p>
                <p style="margin:8px 0 0 0;">
                  <a href="https://${host}" style="color:${PRIMARY};text-decoration:none;">${host}</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function magicLinkText({ url, host }: MagicLinkParams): string {
  return [
    `Welcome to ${FAMILY.siteName}.`,
    ``,
    `Tap this link to sign in (good for 24 hours):`,
    url,
    ``,
    `Didn't ask to sign in? You can ignore this email — nothing`,
    `happens until the link is clicked.`,
    ``,
    `— ${FAMILY.siteName} · ${host}`,
  ].join('\n');
}
