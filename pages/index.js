// Simple page that mounts the Chat component (client-only)
import dynamic from 'next/dynamic';
const Chat = dynamic(() => import('../components/Chat'), { ssr: false });

export default function Home() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Thesys Chat (Example)</h1>
      <Chat />
    </main>
  );
}