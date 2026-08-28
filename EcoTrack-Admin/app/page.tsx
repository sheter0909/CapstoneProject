import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full px-4">
        {/* Left side - Branding */}
        <div className="flex flex-col justify-center bg-green-700 rounded-lg p-8 text-white">
          <div className="mb-8">
            <div className="w-12 h-12 bg-green-500 rounded-lg mb-4"></div>
            <h1 className="text-3xl font-bold">EcoTrack</h1>
          </div>
          <h2 className="text-2xl font-bold mb-4">Smarter waste management starts here.</h2>
          <p className="text-green-100 text-sm leading-relaxed">
            Streamline your residential waste management with our intelligent tracking and monitoring system. 
            Reduce, reuse, recycle with confidence.
          </p>
        </div>

        {/* Right side - Welcome content */}
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to EcoTrack</h2>
          <p className="text-gray-600 mb-8">
            Manage residential waste efficiently with our comprehensive admin dashboard.
          </p>

          <div className="space-y-4">
            <Link
              href="/login"
              className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg text-center transition"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
