import loadingGif from "/images/meow-loading.gif";

export default function PageSpinner() {
    return (
        // <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white">
        //     <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-brand-500" />
        //     <p className="mt-4 text-sm text-gray-600">Loading...</p>
        // </div>
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/80">
            <img
                src={loadingGif}
                alt="Loading..."
                className="h-[20%] w-[20%] object-contain"
            />
            {/* <p className="mt-4 text-sm text-gray-600">Loading...</p> */}
        </div>
    );
}