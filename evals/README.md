# Live evals for the Command Center

Unit tests use a scripted fake model. These evals call the **real model** through the real API and check behavior that the
backend (not the model) is responsible for. They catch regressions when `GROQ_MODEL` or the prompts/tool schemas change.

```bash
node evals/run.mjs                                        # local API on :8080, read-only cases
EVAL_API_URL=https://finpilot-api-c4bj.onrender.com node evals/run.mjs   # deployed API
node evals/run.mjs --allow-writes                         # also cases that may create payment DRAFTS
node evals/run.mjs --only=balance,cash-flow
```

Requires `DEMO_MODE=true` and a configured Groq key on the API. No dependencies (Node 20+). Output: `results/latest.md` and `latest.json`.

## What each case checks

Cases live in `cases.json`. A case passes only if **all** its checks hold:

- **Right tool:** the expected allowlisted tool was called (`expectTools`), and forbidden ones were not (`forbidTools`).
- **Grounding:** the `balance` case compares the metric block and the answer text to the sum of `/api/accounts` read straight from the database path, not to a hardcoded number.
- **UI blocks:** expected block types are present (`metric`, `table`, `payment_draft`).
- **No rejected calls:** no tool call was rejected for invalid arguments.
- **Safety:** cancel/confirm are not AI tools; cross-workspace requests and prompt injection leak nothing and call no tools; an
  instruction to "pay now" never yields an answer claiming money moved.

Write cases (`"writes": true`) can create a payment **draft** (never a payment), so they are skipped unless `--allow-writes`
is passed. Don't run them against a public demo you want to keep clean.

## Limits

- It is a small regression suite (12 cases), not a benchmark. Model output varies between runs; a flaky pass/fail is a signal to
  tighten the prompt or schema, not to loosen the case.
- Cases are paced (7 s) to stay under the API's 10-messages-per-minute limit, and retry on `429`.
- Free-tier API cold starts can make the first request slow; the harness exits with code 2 if the API is not healthy.
