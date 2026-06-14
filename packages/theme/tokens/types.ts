export interface Theme {
    bg: {
        canvas: string;
        surface: string;
        elevated: string;
        muted: string;
        inverse: string;
    }
    text: {
        primary: string;
        secondary: string;
        muted: string;
        inverse: string;
    }
    border: {
        default: string;
        strong: string;
    }
    status: {
        success: string;
        danger: string;
        warning: string;
        info: string;
    }
}