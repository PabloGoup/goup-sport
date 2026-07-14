# GOUP SPORT

GOUP SPORT es una plataforma de Sports Intelligence construida con Next.js, TypeScript y App Router.

La direccion de producto no es de apuestas. La plataforma se enfoca en analisis deportivo explicable, datos trazables, transparencia de modelos y distribucion API-first.

## Documentacion Fundacional

Antes de continuar agregando backend, modelos o nuevas pantallas, leer:

1. [Vision del producto](docs/product-vision.md)
2. [PRD funcional](docs/prd.md)
3. [Arquitectura tecnica](docs/architecture.md)
4. [Design System y UX](docs/design-system-ux.md)

Indice general: [docs/README.md](docs/README.md)

## Superficie Actual

- Home visual tipo plataforma deportiva.
- Rutas de eventos y detalle de evento.
- Ranking y detalle de modelos/predicciones.
- Busqueda global.
- Favoritos locales.
- API v1 inicial.

## Principios

- No es una casa de apuestas.
- No permite apostar.
- No vende cuotas.
- No incentiva el juego.
- Cada prediccion debe explicar por que.
- Cada dato debe tener trazabilidad.

## Getting Started

Instalar dependencias y levantar el servidor local:

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

Validaciones principales:

```bash
npm run lint
npm run build
```

## Stack Actual

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- API routes versionadas.
- Datos demo en dominio local.
- Prisma + Postgres preparado como persistencia objetivo.

## Siguiente Fase Tecnica

Despues de consolidar documentos fundacionales, la siguiente fase recomendada es introducir Prisma + Postgres, repositorios y seed idempotente, manteniendo estables las rutas y contratos actuales.

## Persistencia

Configurar `DATABASE_URL` a partir de `.env.example`.

Comandos disponibles:

```bash
npm run prisma:validate
npm run prisma:migrate
npm run db:seed
```

La app aun puede renderizar con datos demo locales. La migracion a lectura desde repositorios persistentes debe hacerse en el siguiente paso para no romper contratos de UI/API.

## Despliegue

El proyecto esta preparado para despliegue en Vercel, pero antes de produccion se debe definir persistencia, variables de entorno y fuente de datos real.
