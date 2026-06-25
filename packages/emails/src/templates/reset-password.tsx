import { Heading, Text } from "@react-email/components";
import { Layout } from "../ui/layout";
import { Button } from "../ui/button";

export interface ResetPasswordProps {
    userName: string;
    resetPasswordUrl: string;
}

const ResetPassword = ({ userName, resetPasswordUrl }: ResetPasswordProps) => (<Layout preview="Solicitação de Alteração de Senha">
    <Heading className="text-2xl font-semibold text-primary">Solicitação de Alteração de Senha</Heading>
    <Text className="text-base text-secondary">{userName}, recebemos uma solicitação para alteração de senha. Para prosseguir, acesse o link abaixo: </Text>
    <Button href={resetPasswordUrl}>Alterar Senha</Button>
    <Text className="mt-6 text-sm text-secondary">
      Se o botão não funcionar, copia e cola este link no seu navegador:
      <br />
      <span className="break-all text-muted">{resetPasswordUrl}</span>
    </Text>
</Layout>)

/**
 * Preview default -- Ambiente DEV
 */
ResetPassword.PreviewProps = {
  userName: 'Mario',
  resetPasswordUrl: 'https://orchestra.app/reset-password?token=preview',
} satisfies ResetPasswordProps;

export default ResetPassword;