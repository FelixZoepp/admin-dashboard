import Dashboard from './dashboard'
import { fetchCloseData } from './data'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const data = await fetchCloseData()

  if (!data || data.error) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: '#0f1117',
        color: '#e2e8f0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#9888;</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Dashboard konnte nicht geladen werden</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', textAlign: 'center', maxWidth: '400px' }}>
          {data?.error || 'Verbindung zur Close CRM API fehlgeschlagen. Bitte versuche es sp\u00e4ter erneut.'}
        </p>
        <p style={{ fontSize: '11px', color: '#64748b', marginTop: '16px' }}>
          Die Daten werden automatisch alle 5 Minuten aktualisiert.
        </p>
      </div>
    )
  }

  return <Dashboard data={data as any} />
}
