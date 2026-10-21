import { useCallback } from "react";
import api from "../../services/api";

const useVersion = () => {
    const getVersion = useCallback(async () => {
        const { data } = await api.request({
            url: '/version',
            method: 'GET',
        });
        return data;
    }, []);

    return {
        getVersion
    };
}

export default useVersion;



