import { Heading, Text } from '@react-email/components';
import { Button } from '../ui/button';
import { Layout } from '../ui/layout';

export interface VerifyEmailProps {
  userName: string;
  verifyUrl: string;
}

export const VerifyEmail = ({ userName, verifyUrl }: VerifyEmailProps) => (
  <Layout preview="Confirme seu e-mail no Orchestra">
    <Heading className="text-2xl font-semibold text-primary">
      Bem-vindo ao Orchestra, {userName}!
    </Heading>

    <Text className="text-base text-secondary">
      Pra ativar sua conta, confirme seu endereço de e-mail clicando no botão
      abaixo. O link expira em 24 horas.
    </Text>

    <Button href={verifyUrl}>Confirmar e-mail</Button>

    <Text className="mt-6 text-sm text-secondary">
      Se o botão não funcionar, copia e cola este link no seu navegador:
      <br />
      <span className="break-all text-muted">{verifyUrl}</span>
    </Text>
  </Layout>
);

/**
 * Preview default -- Ambiente DEV
 */
VerifyEmail.PreviewProps = {
  userName: 'Mario',
  verifyUrl: 'https://orchestra.app/verify?token=preview',
} satisfies VerifyEmailProps;

export default VerifyEmail;