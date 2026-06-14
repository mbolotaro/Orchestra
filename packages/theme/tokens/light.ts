import { colors } from "../primitives/colors";
import { Theme } from "./types";

export const lightTheme: Theme = {
    bg: {
        canvas: colors.neutral[50],
        surface: colors.neutral[100],
        elevated: colors.neutral[100],
        muted: colors.purple[600],
        inverse: colors.neutral[900],
    },
    text: {
        primary: colors.neutral[900],
        secondary: colors.neutral[800],
        inverse: colors.neutral[100],
        muted: colors.neutral[700]
    },
    border: {
        default: colors.neutral[300],
        strong: colors.neutral[600]
    },
    status: {
        danger: colors.red[800],
        info: colors.blue[600],
        success: colors.green[600],
        warning: colors.red[400]
    }
}