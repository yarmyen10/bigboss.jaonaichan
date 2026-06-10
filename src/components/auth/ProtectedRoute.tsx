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
            setIsAuthenticated(isLoggedIn());
            setIsLoading(false);
        }, 100);

        const handleUnauth = () => setIsAuthenticated(false);
        window.addEventListener('auth:unauthorized', handleUnauth);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('auth:unauthorized', handleUnauth);
        };
    }, []);

    if (isLoading) {
        return <PageSpinner />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    return <>{children}</>;
}