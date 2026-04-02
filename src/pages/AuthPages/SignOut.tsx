import { useEffect } from "react";
import { useNavigate } from "react-router";
import PageSpinner from "../../components/common/PageSpinner";

const JAONAICHAN_PREFIX = import.meta.env.JAONAICHAN_PREFIX;

export default function SignOut() {
    const navigate = useNavigate();

    useEffect(() => {
        // ลบข้อมูล auth
        localStorage.removeItem(JAONAICHAN_PREFIX + 'Token');
        localStorage.removeItem(JAONAICHAN_PREFIX + 'User');

        navigate("/signin", { replace: true });
    }, [navigate]);

    return <PageSpinner />;
}