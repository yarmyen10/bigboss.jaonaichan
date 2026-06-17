import { useState, useCallback } from "react";

export function useSpinner(initial = false) {
    const [spinning, setSpinning] = useState(initial);

    const show = useCallback(() => {
        setSpinning(true);
    }, []);

    const hide = useCallback(() => {
        setSpinning(false);
    }, []);

    const toggle = useCallback(() => {
        setSpinning((prev) => !prev);
    }, []);

    const withSpinner = useCallback(async (asyncFn: () => Promise<unknown>) => {
        setSpinning(true);
        try {
            return await asyncFn();
        } finally {
            setSpinning(false);
        }
    }, []);

    return {
        spinning,
        show,
        hide,
        toggle,
        withSpinner,
    };
}