import React, { useState } from 'react';
import { Users, PlusCircle, UserCircle } from 'lucide-react';

function App() {
  const [tab, setTab] = useState('list');
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-700 text-white p-4 shadow-lg">
        <h1 className="text-xl font-bold">Best Generations Journal</h1>
      </header>
      
      <main className="p-4 text-gray-800">
        {tab === 'list' && (
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-4">Список ваших пациентов</h2>
            <p className="text-gray-500 italic">Здесь будет список из базы данных...</p>
          </div>
        )}
        {tab === 'add' && (
          <div className="bg-white p-4 rounded-xl shadow">
            <h2 className="font-bold text-lg mb-4">Новый пациент</h2>
            <input className="w-full border p-3 rounded-lg mb-3" placeholder="ФИО" />
            <button className="w-full bg-blue-600 text-white py-3 rounded-xl">Сохранить</button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3">
        <button onClick={() => setTab('list')} className="flex flex-col items-center">
          <Users color={tab === 'list' ? '#1d4ed8' : '#94a3b8'} />
          <span className="text-xs">Пациенты</span>
        </button>
        <button onClick={() => setTab('add')} className="flex flex-col items-center">
          <PlusCircle color={tab === 'add' ? '#1d4ed8' : '#94a3b8'} />
          <span className="text-xs">Добавить</span>
        </button>
        <button onClick={() => setTab('profile')} className="flex flex-col items-center">
          <UserCircle color={tab === 'profile' ? '#1d4ed8' : '#94a3b8'} />
          <span className="text-xs">Профиль</span>
        </button>
      </nav>
    </div>
  );
}
export default App;