
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-vybr-blue/5 to-white p-4">
      <div className="text-center max-w-md">
        <h1 className="text-5xl font-bold mb-4 text-vybr-blue">404</h1>
        <p className="text-xl text-gray-600 mb-6">Oops! Page not found</p>
        <p className="text-sm text-gray-500 mb-6">
          The page <span className="font-mono bg-gray-100 px-2 py-1 rounded">{location.pathname}</span> does not exist.
        </p>
        <Link to="/" className="text-vybr-midBlue hover:text-vybr-darkBlue underline">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
