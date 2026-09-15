import React from 'react';
import { Link } from 'react-router-dom';

export default function AdminClientes() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center">
      <div className="text-center space-y-4">
        <span className="text-5xl">👑</span>
        <p className="text-stone-900 text-lg font-bold">Painel de Admin</p>
        <p className="text-stone-500 text-xs">Use o Super Admin para gerenciar todos os tenants.</p>
        <Link to="/superadmin" className="inline-block mt-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs px-6 py-2.5 rounded transition-all">
          Ir para Super Admin
        </Link>
      </div>
    </div>
  );
}
