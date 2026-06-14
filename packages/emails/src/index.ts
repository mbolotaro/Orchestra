import { render } from '@react-email/render';
import { createElement } from 'react';
import VerifyEmail, { VerifyEmailProps } from './templates/verify-email';

export async function renderVerifyEmail(
  props: VerifyEmailProps,
): Promise<string> {
  return await render(createElement(VerifyEmail, props));
}
