import { Navigate } from 'react-router';
import { ReactNode, useEffect, useState } from 'react';
import PageSpinner from '../common/PageSpinner';
import { isLoggedIn } from '../../api/auth';

interface Props {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            const checkAuth = async () => {
                try {
                    const token = isLoggedIn();
                    setIsAuthenticated(!!token);
                } finally {
                    setIsLoading(false);
                }
            };

            checkAuth();
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    if (isLoading) {
        return <PageSpinner />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    return <>{children}</>;
}