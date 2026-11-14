# Database

PostgreSQL 16. Money is `BIGINT` minor units (cents). Every tenant-owned table has `workspace_id`.

- `migrations/NNN_*.sql` — numbered, applied in order.
- `seed/*.sql` — synthetic, invented data only; re-runnable (truncates and reloads).
- Two workspaces are seeded (`Acme Robotics (Demo)` and `Rival Co (Demo)`) so cross-tenant isolation can be tested.

Local reset (destroys data):

```powershell
docker compose up -d db
./scripts/db-reset.ps1            # or scripts/db-reset.sh with psql installed
```

Seeded dev identities (JWT `sub`): `demo-user-1` (owner of Acme), `demo-user-2` (owner of Rival Co).
