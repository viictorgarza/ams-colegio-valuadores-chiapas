import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/core/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite'
})
