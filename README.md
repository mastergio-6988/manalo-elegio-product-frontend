# Product Management Frontend

React and Vite client for the Laboratory Exercise No. 6 product API.

## Run locally

```sh
npm ci
npm run dev
```

The Vite development server proxies `/api` requests to `http://127.0.0.1:3000`.

## Deploy on Render

Create a Static Site from this repository. Render can use the included `render.yaml`, or configure:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Environment variable: `VITE_API_URL=https://manalo-elegio-lavalust-ldfp.onrender.com`

The LavaLust API must allow the frontend site's origin and have its product login credentials configured in Render's environment settings.
