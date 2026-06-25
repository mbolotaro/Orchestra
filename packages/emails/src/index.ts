import { render } from '@react-email/render';
import { createElement } from 'react';
import VerifyEmail, { VerifyEmailProps } from './templates/verify-email';
import ResetPassword, { ResetPasswordProps } from './templates/reset-password';

export async function renderVerifyEmail(
  props: VerifyEmailProps,
): Promise<string> {
  return await render(createElement(VerifyEmail, props));
}

export async function renderResetPassword(props: ResetPasswordProps): Promise<string> {
  return await render(createElement(ResetPassword, props))
}