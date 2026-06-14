import { Button as RootButton } from '@react-email/components';

interface ButtonProps {
  href: string;
  children: string;
}

export const Button = ({ href, children }: ButtonProps) => (
  <RootButton
    href={href}
    className="rounded-md bg-muted px-6 py-3 text-sm font-semibold text-inverse no-underline"
  >
    {children}
  </RootButton>
);