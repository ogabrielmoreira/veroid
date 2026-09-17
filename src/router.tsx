import { createBrowserRouter, Navigate } from 'react-router'
import { CallbackPage } from '@/features/auth/CallbackPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { RequireAuth, RequireGuest } from '@/features/auth/guards'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { SignInPage } from '@/features/auth/SignInPage'
import { SignUpPage } from '@/features/auth/SignUpPage'
import { VerifyPage } from '@/features/auth/VerifyPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { InvitePage } from '@/features/org/InvitePage'
import { OrgGate } from '@/features/org/OrgGate'
import { env } from '@/lib/env'

export const router = createBrowserRouter(
  [
    { path: '/', element: <LandingPage /> },
    {
      element: <RequireGuest />,
      children: [
        { path: '/entrar', element: <SignInPage /> },
        { path: '/criar-conta', element: <SignUpPage /> },
        { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
      ],
    },
    { path: '/verificar', element: <VerifyPage /> },
    // Painel público "Explorar sem cadastro" (§10): bundle separado, sem exigir login
    { path: '/demo', lazy: async () => ({ Component: (await import('@/features/demo/PublicDemoPage')).PublicDemoPage }) },
    // Direitos do titular (LGPD, §8): acesso/exclusão sem exigir login
    { path: '/privacidade', lazy: async () => ({ Component: (await import('@/features/privacy/DataRightsPage')).DataRightsPage }) },
    { path: '/auth/callback', element: <CallbackPage /> },
    { path: '/nova-senha', element: <ResetPasswordPage /> },
    { path: '/convite/:token', element: <InvitePage /> },
    // Fluxo do titular: bundle separado e leve (§3.10)
    { path: '/v/:token', lazy: async () => ({ Component: (await import('@/features/subject/SubjectLinkPage')).SubjectLinkPage }) },
    {
      path: '/app',
      element: <RequireAuth />,
      children: [
        {
          element: <OrgGate />,
          children: [
            { path: 'onboarding', lazy: async () => ({ Component: (await import('@/features/onboarding/OnboardingPage')).OnboardingPage }) },
            { path: 'configurar/:step', lazy: async () => ({ Component: (await import('@/features/setup/SetupWizardPage')).SetupWizardPage }) },
            {
              lazy: async () => ({ Component: (await import('@/features/app/AppShell')).AppShell }),
              children: [
                { index: true, lazy: async () => ({ Component: (await import('@/features/app/OverviewPage')).OverviewPage }) },
                { path: 'revisao', lazy: async () => ({ Component: (await import('@/features/review/ReviewQueuePage')).ReviewQueuePage }) },
                { path: 'sessoes/:id', lazy: async () => ({ Component: (await import('@/features/review/SessionDetailPage')).SessionDetailPage }) },
                { path: 'clientes-qualificados', lazy: async () => ({ Component: (await import('@/features/qualified/QualifiedPage')).QualifiedPage }) },
                { path: 'auditoria', lazy: async () => ({ Component: (await import('@/features/audit/AuditPage')).AuditPage }) },
                { path: 'links', lazy: async () => ({ Component: (await import('@/features/links/LinksPage')).LinksPage }) },
                { path: 'configuracoes', element: <Navigate to="/app/configuracoes/marca" replace /> },
                { path: 'configuracoes/:tab', lazy: async () => ({ Component: (await import('@/features/setup/SettingsPage')).SettingsPage }) },
              ],
            },
          ],
        },
      ],
    },
    { path: '*', element: <Navigate to="/" replace /> },
  ],
  { basename: env.basePath || '/' },
)
