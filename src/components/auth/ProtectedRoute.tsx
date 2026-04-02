import { Navigate } from 'react-router';
import { isLoggedIn } from '../../api/auth';
import { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
    if (!isLoggedIn()) {
        return <Navigate to="/signin" replace />;
    }
    return <>{children}</>;
}