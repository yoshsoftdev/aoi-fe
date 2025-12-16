export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-800">AOI System</h2>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">Admin</span>
          </div>
        </div>
      </div>
    </header>
  )
}

