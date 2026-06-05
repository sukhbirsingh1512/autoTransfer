import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      {/* min-w-0 prevents flex child from growing to its content width — required so
          inner overflow-x-auto containers (tables) actually clip and scroll instead of
          pushing the whole page wider than the viewport. */}
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar />
        <div className="flex-1 min-w-0 p-6 w-full">
          <div className="max-w-[1500px] w-full mx-auto min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
