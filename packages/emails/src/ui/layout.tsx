import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from '@react-email/components';
import { lightTheme, tailwindFromTheme } from '@orchestra/theme';
import type { ReactNode } from 'react';

interface LayoutProps {
  preview: string;
  children: ReactNode;
}

export const Layout = ({ preview, children }: LayoutProps) => (
  <Html lang="pt-BR">
    <Head />
    <Preview>{preview}</Preview>
    <Tailwind config={tailwindFromTheme(lightTheme)}>
      <Body className="bg-canvas font-sans">
        <Container className="mx-auto my-10 max-w-[560px] rounded-lg border bg-surface p-8">
          <Section>{children}</Section>

          <Hr className="my-8" />

          <Text className="text-xs text-muted">
            Você recebeu este e-mail porque tem uma conta no Orchestra.
            <br />
            Se você não reconhece este pedido, pode ignorar com segurança.
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);