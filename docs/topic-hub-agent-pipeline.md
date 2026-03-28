# Topic hub agent (`/api/agent/generate-topic`)

Admin-only endpoint that generates JSON sections (`why_study`, `what_learn`, `real_world`) using Gemini, with optional RAG context.

## Chapter hub vs topic hub (do not merge)

- **Topic hub** (`hubScope=topic`, default): one syllabus **topic** (e.g. *Coulomb's Law*) — used on `/.../topic/overview/...` and Explore when the unit is a single topic.
- **Chapter hub** (`hubScope=chapter`): the **whole chapter landing** in Explore (e.g. *Electric Charges and Fields*) — `topic` in the API/DB is the **chapter title**, not the first topic inside it.

These are stored as **different rows** in `topic_content` (see migration `hub_scope`). Generating chapter copy no longer overwrites the Coulomb's Law topic hub.

Apply migration `20250326100000_topic_content_hub_scope.sql` so `hub_scope` and the updated unique key exist.

## Gemini backends

| Mode | When | Required env |
|------|------|----------------|
| **AI Studio (API key)** | Default | `GEMINI_API_KEY` |
| **Vertex AI** | `GEMINI_USE_VERTEX=true` or `1` **and** `GOOGLE_CLOUD_PROJECT` set | `GOOGLE_CLOUD_PROJECT`, ADC |

**Do not remove `GEMINI_API_KEY` until Vertex is configured and tested** (still required when Vertex is off).

### Vertex: model names ≠ AI Studio

Vertex returns **404** if the model id does not exist in your **region**. Names like `gemini-3.1-pro-preview` often work on **AI Studio** but not on **Vertex**.

**Overrides (in order):**

1. **`VERTEX_GEMINI_MODEL`** — always used on Vertex when set.
2. **`GEMINI_MODEL`** — used on Vertex when it is a normal Vertex id.
3. **Auto-fallback** — if `GEMINI_MODEL` resolves to `gemini-3.1-pro-preview` or `gemini-3-pro-preview` and **`VERTEX_GEMINI_MODEL` is unset**, Vertex uses **`VERTEX_TOPIC_FALLBACK_MODEL`** or defaults to **`gemini-2.5-pro`** (with a console warning).

### Vertex setup

1. `GEMINI_USE_VERTEX=true`
2. `GOOGLE_CLOUD_PROJECT=<gcp-project-id>`
3. `GOOGLE_CLOUD_LOCATION` (optional; default **`global`** in code — good for Gemini 3.x on Vertex; set e.g. `us-central1` if you need a regional endpoint)
4. ADC: `GOOGLE_APPLICATION_CREDENTIALS` or `gcloud auth application-default login` — principal needs **Vertex AI User**.

### SDK

Vertex calls use **`@google/genai`** with `vertexai: true`, `project`, and `location` (same package as the AI Studio API-key path). The old **`@google-cloud/vertexai`** package is not used for this route.

[Vertex model versions](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions)

### Errors

- **429** — quota / billing (AI Studio or Vertex).
- **502 + `VERTEX_MODEL_NOT_FOUND`** — Vertex still cannot load the chosen id; set `VERTEX_GEMINI_MODEL` to a catalog id for your region.
