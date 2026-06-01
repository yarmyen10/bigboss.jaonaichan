import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageSpinner from "../../components/common/PageSpinner";
import { signOut } from "../../api/auth";

export default function SignOut() {
    const navigate = useNavigate();

    useEffect(() => {
        signOut().finally(() => navigate("/signin", { replace: true }));
    }, [navigate]);

    return <PageSpinner />;
}