---
title: FinPilot API
colorFrom: gray
colorTo: blue
sdk: docker
app_port: 8080
pinned: false
---

# FinPilot API

The Haskell/Servant backend for [FinPilot](https://github.com/ragurajakrishnan15/FinPilot), a portfolio project that uses
**synthetic data only** and **simulated payments**. No real money or customer data is involved.

This Space runs the published container image. Configuration is supplied through the Space's
*Variables and secrets* (never committed): `DATABASE_URL`, `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_MODEL`,
`CORS_ALLOWED_ORIGINS`, `APP_ENV=production`, `DEMO_MODE=true`.

Health check: `/health`
