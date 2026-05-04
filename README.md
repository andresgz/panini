# Panini FIFA World Cup 2026 Inventory

Aplicacion web en Next.js para gestionar el inventario por usuario del album Panini FIFA World Cup 2026.

## Stack

- Next.js App Router + React + TypeScript.
- Catalogo estatico en `src/catalog/panini-world-cup-2026.ts`.
- Reglas puras de inventario en `src/lib/inventory.ts`.
- Supabase Auth con Google y tablas solo para usuarios/cantidades.
- Lista para desplegar en Vercel.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Sin variables de Supabase, la app corre en modo demo con dos usuarios y persistencia local en `localStorage`.

## Backups de inventario

La barra superior incluye acciones para exportar e importar el inventario del usuario actual.

- Exportar genera un JSON con el album, usuario, fecha y las 980 cantidades por `stickerId`.
- Importar restaura ese JSON sobre el usuario seleccionado.
- El formato sirve como respaldo local ahora y como backup de usuario cuando la app use Supabase en produccion.

## Supabase

1. Crear un proyecto en Supabase.
2. Ejecutar `supabase/schema.sql` en el SQL editor.
3. Habilitar Google en Authentication > Providers.
4. Configurar el callback URL:

```txt
http://localhost:3000/auth/callback
https://tu-dominio.vercel.app/auth/callback
```

5. Crear `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

La base de datos no guarda el catalogo del album. Solo guarda:

- `users`
- `user_sticker_states`

## Verificacion

```bash
npm run typecheck
npm run lint
npm run build
```
