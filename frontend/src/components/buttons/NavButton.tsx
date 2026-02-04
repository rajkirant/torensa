import { styled } from "@mui/material/styles";
import Button, { type ButtonProps } from "@mui/material/Button";

export interface NavButtonProps extends ButtonProps {
    to?: string;
    end?: boolean;
}

export const NavButton = styled(Button)<NavButtonProps>(({ theme }) => ({
    textTransform: "none",
    fontWeight: 600,
    fontSize: "0.95rem",
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    color: theme.header.textMuted,

    "& .MuiButton-startIcon": {
        marginRight: theme.spacing(0.5),
    },

    "&.active": {
        color: theme.header.text,
        textDecoration: "underline",
    },
}));
