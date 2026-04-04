import { ReactNode } from "react";

interface Props {
    children: ReactNode;
    isLoading?: boolean;
}

export default function CardFrame({ children, isLoading }: Props) {
    return (
        <aside>
            {   
                isLoading ? (
                    <div className="min-h-screen px-5 py-7 xl:px-10 xl:py-12">
                        
                        <div className="mx-auto w-full max-w-[630px] flex items-baseline justify-center columns-3xs">
                            <img
                                className="h-[20%] w-[20%] object-contain"
                                src="/images/stickers/Hungry Cat Food Sticker by Lord Tofu Animation.gif"
                                alt="Loading..."
                            />
                            <p >Loading...</p>
                        </div>
                    </div>
                    // <div className="min-h-screen rounded-2xl border border-gray-200 bg-white px-5 py-7 dark:border-gray-800 dark:bg-white/[0.03] xl:px-10 xl:py-12 animate-pulse">
                    //     <div className="mx-auto w-full max-w-[630px] text-center">
                    //         <h3 className="mb-4 font-semibold text-gray-800 text-theme-xl dark:text-white/90 sm:text-2xl">
                    //             Card Frame
                    //         </h3>
                    //     </div>
                    // </div>
                ) : <>{children}</>
            }
        </aside>
    );
}
