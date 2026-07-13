import { Hono } from 'hono'
import { ZodError } from 'zod'
import type { AppContext } from './env'
import { ApiError } from './env'
import { requireAuth } from './auth'
import { authRoutes } from './routes/auth'
import { memberRoutes } from './routes/members'
import { paymentRoutes } from './routes/payments'
import { eventRoutes } from './routes/events'
import { assemblyRoutes } from './routes/assemblies'
import { systemRoutes } from './routes/system'

const app = new Hono<AppContext>().basePath('/api')

// /auth se registra antes del middleware: login/logout no requieren sesión
// (me y change-password llevan requireAuth propio dentro del router).
app.route('/auth', authRoutes)

app.use('*', requireAuth)
app.route('/members', memberRoutes)
app.route('/payments', paymentRoutes)
app.route('/events', eventRoutes)
app.route('/assemblies', assemblyRoutes)
app.route('/system', systemRoutes)

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status as 400)
  if (err instanceof ZodError) {
    const msg = err.issues[0]?.message ?? 'Datos inválidos'
    return c.json({ error: msg }, 400)
  }
  console.error('[api] error no manejado:', err)
  return c.json({ error: 'Error interno del servidor' }, 500)
})

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404))

export default app
