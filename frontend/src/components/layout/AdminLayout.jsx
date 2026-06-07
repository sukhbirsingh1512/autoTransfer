import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ChangePasswordModal from '../ChangePasswordModal';

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const location = useLocation();

  // Auto-close drawer when navigating on mobile.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {/* min-w-0 prevents flex child from growing to its content width — required so
          inner overflow-x-auto containers (tables) actually clip and scroll instead of
          pushing the whole page wider than the viewport. */}
      <main className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onMenu={() => setSidebarOpen(true)}
          onChangePassword={() => setPasswordModalOpen(true)}
        />
        <div className="flex-1 min-w-0 p-3 sm:p-6 w-full">
          <div className="max-w-[1500px] w-full mx-auto min-w-0">
            <Outlet />
          </div>
        </div>
      </main>
      <ChangePasswordModal
        open={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </div>
  );
}
