'use client';

import { useEffect, useState } from 'react';

const API_URL = 'http://localhost:3000';

interface Me {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isEmailVerified: boolean;
  };
}

interface SessionSummary {
  id: string;
  isCurrent: boolean;
  lastActivityAt: string;
  expiresAt: string;
  ipAddress: string | null;
  device: {
    browser: string | null;
    os: string | null;
    type: 'desktop' | 'tablet' | 'mobile';
  };
}

export default function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const loadMe = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setMe(null);
        return;
      }
      const data = (await res.json()) as Me;
      setMe(data);
    } catch {
      setMe(null);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/sessions`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setSessions([]);
        return;
      }
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      setSessions([]);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOauthError(params.get('oauth_error'));

    Promise.all([loadMe(), loadSessions()]).finally(() => setLoading(false));
  }, []);

  const signOut = async () => {
    await fetch(`${API_URL}/auth/sign-out`, {
      method: 'POST',
      credentials: 'include',
    });
    setMe(null);
    setSessions([]);
    window.location.reload();
  };

  const revokeSession = async (id: string) => {
    await fetch(`${API_URL}/auth/sessions/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    await loadSessions();
  };

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '48px 24px',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 32 }}>Orchestra — OAuth Playground</h1>
      <p style={{ color: '#94a3b8', marginTop: 8 }}>
        Testando fluxo de autenticação
      </p>

      {oauthError && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: '#7f1d1d',
            borderRadius: 8,
            border: '1px solid #b91c1c',
          }}
        >
          <strong>OAuth error:</strong> {oauthError}
        </div>
      )}

      {loading ? (
        <p style={{ marginTop: 24 }}>Carregando…</p>
      ) : me ? (
        <>
          <Card title="Você está logado">
            <Row label="Nome">
              {me.user.firstName} {me.user.lastName}
            </Row>
            <Row label="Email">{me.user.email}</Row>
            <Row label="Verificado">
              {me.user.isEmailVerified ? '✅ sim' : '❌ não'}
            </Row>
            <div style={{ marginTop: 16 }}>
              <Button onClick={signOut} variant="danger">
                Sign out
              </Button>
            </div>
          </Card>

          <Card title={`Sessões ativas (${sessions.length})`}>
            {sessions.length === 0 && (
              <p style={{ color: '#94a3b8' }}>Nenhuma sessão ativa.</p>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: s.isCurrent ? '#1e3a8a' : '#1e293b',
                  borderRadius: 8,
                  border: s.isCurrent ? '1px solid #3b82f6' : '1px solid #334155',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {s.device.browser ?? 'Unknown browser'} · {s.device.os ?? 'Unknown OS'}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>
                      {s.device.type} · {s.ipAddress ?? 'sem IP'} · última atividade:{' '}
                      {new Date(s.lastActivityAt).toLocaleString()}
                    </div>
                    {s.isCurrent && (
                      <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 4 }}>
                        Esta sessão
                      </div>
                    )}
                  </div>
                  {!s.isCurrent && (
                    <Button onClick={() => revokeSession(s.id)} variant="danger">
                      Revogar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : (
        <Card title="Não autenticado">
          <p style={{ color: '#94a3b8' }}>
            Faça login com Google pra testar o fluxo OAuth completo.
          </p>
          <a href={`${API_URL}/auth/oauth/google`} style={{ textDecoration: 'none' }}>
            <Button variant="primary">🔐 Sign in with Google</Button>
          </a>
        </Card>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 24,
        padding: 24,
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: 12,
      }}
    >
      <h2 style={{ margin: 0, marginBottom: 16, fontSize: 20 }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
      <span style={{ color: '#94a3b8', minWidth: 100 }}>{label}:</span>
      <span>{children}</span>
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'danger';
}) {
  const colors = {
    primary: { bg: '#3b82f6', hover: '#2563eb' },
    danger: { bg: '#ef4444', hover: '#dc2626' },
  };
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 20px',
        background: colors[variant].bg,
        color: 'white',
        border: 'none',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
