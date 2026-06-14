import type { Theme } from '../tokens/types';

export const tailwindFromTheme = (theme: Theme) => ({
  theme: {
    extend: {
      backgroundColor: {
        ...theme.bg,
        success: theme.status.success,
        danger: theme.status.danger,
        warning: theme.status.warning,
        info: theme.status.info,
      },
      textColor: {
        ...theme.text,
        success: theme.status.success,
        danger: theme.status.danger,
        warning: theme.status.warning,
        info: theme.status.info,
      },
      borderColor: {
        DEFAULT: theme.border.default,
        strong: theme.border.strong,
      },
    },
  },
});