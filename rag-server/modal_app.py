"""
modal_app.py - Modal.com deployment for the Testbee RAG sidecar.

OVERVIEW
--------
This file deploys the FastAPI RAG sidecar (main.py) to Modal as a GPU-backed
ASGI app. BGE-M3 weights (~1.5 GB) are stored in a Modal Volume so they
survive across cold starts instead of being re-downloaded on every container
boot.

DEPLOY
------
1. Install the Modal CLI and authenticate once:

       pip install modal
       modal setup

2. From the rag-server/ directory, run:

       modal deploy modal_app.py

   Modal will print the deployed URL, which looks like:

       https://<your-modal-workspace>--testbee-rag-serve.modal.run

CONFIGURE THE NEXT.JS APP
--------------------------
Copy that URL and set it in your project root .env.local:

    RAG_SIDECAR_URL=https://<your-modal-workspace>--testbee-rag-serve.modal.run

MODAL SECRETS (create once in the Modal dashboard)
---------------------------------------------------
Create a Secret named  custom-secret  and add these keys:

    RAG_SUPABASE_URL        -> your Supabase project URL
    RAG_SUPABASE_ANON_KEY   -> your Supabase anon/service key
    RAG_INTERNAL_TOKEN      -> shared secret used by X-Internal-Token header
                               (must match RAG_INTERNAL_TOKEN in .env.local)

The embed_mode field defaults to "local" (in-process BGE-M3) which is correct
for Modal; do not override it unless you are routing embeddings to an external
API.

VOLUME & COLD STARTS
--------------------
The Modal Volume  testbee-bge-m3-weights  is mounted at /model-cache.
On the first deploy, the container downloads BGE-M3 from Hugging Face into
/model-cache. Subsequent containers (including after scale-to-zero) will find
the weights already present, skipping the ~1.5 GB download.

scaledown_window=300 keeps a warm container alive for 5 minutes after the last
request, which eliminates cold starts during active tutoring sessions.
"""

import os
import sys

import modal

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
APP_NAME = "testbee-rag"
MODEL_CACHE_DIR = "/model-cache"

# ---------------------------------------------------------------------------
# Modal app
# ---------------------------------------------------------------------------
app = modal.App(APP_NAME)

# ---------------------------------------------------------------------------
# Volume: caches BGE-M3 weights across cold starts
# ---------------------------------------------------------------------------
model_volume = modal.Volume.from_name(
    "testbee-bge-m3-weights",
    create_if_missing=True,
)

# ---------------------------------------------------------------------------
# Container image
# ---------------------------------------------------------------------------
# We install all Python dependencies first, then copy the rag-server source
# code into /app.  .copy_local_dir is executed at image-build time, so the
# image snapshot already contains all application code.
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.30.0",
        "sentence-transformers>=2.2.0",
        "supabase>=2.0.0",
        "pydantic-settings>=2.0.0",
        "torch>=2.0.0",
        "numpy",
        "httpx>=0.27.0",
    )
    # Copy all rag-server source files (the directory that contains this file)
    # into /app inside the container.  modal_app.py itself is included, which
    # is harmless — it is never imported by the application code.
    .add_local_dir(".", remote_path="/app")
)

# ---------------------------------------------------------------------------
# Secrets: RAG_SUPABASE_URL, RAG_SUPABASE_ANON_KEY, RAG_INTERNAL_TOKEN
# ---------------------------------------------------------------------------
secrets = [modal.Secret.from_name("custom-secret")]

# ---------------------------------------------------------------------------
# ASGI function: serves the FastAPI app
# ---------------------------------------------------------------------------
@app.function(
    image=image,
    gpu="T4",
    volumes={MODEL_CACHE_DIR: model_volume},
    secrets=secrets,
    scaledown_window=600,  # keep warm 10 min after last request
    keep_warm=1,           # always keep 1 container ready — eliminates cold starts
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def serve():
    """Return the Testbee RAG FastAPI application as a Modal ASGI app.

    Steps performed at container startup:
      1. Insert /app onto sys.path so all rag-server modules are importable.
      2. Set MODEL_CACHE_DIR in the environment so embed.py points
         SentenceTransformer at the persistent Modal Volume path.
      3. Import main.py, which triggers the FastAPI lifespan on first request
         (FastAPI/Starlette runs the lifespan when the ASGI app receives its
         first request from Modal's ASGI gateway).
    """
    # Make all rag-server modules importable.
    sys.path.insert(0, "/app")

    # Tell embed.py to use the Volume-backed path for the model cache so that
    # BGE-M3 weights are not re-downloaded on every cold start.
    os.environ["MODEL_CACHE_DIR"] = MODEL_CACHE_DIR

    # Importing main triggers module-level code (logging config, settings
    # instantiation from env vars).  The lifespan (which calls load_model())
    # runs when Modal's ASGI runner sends the "lifespan.startup" event.
    from main import app as fastapi_app  # noqa: PLC0415

    return fastapi_app


# ---------------------------------------------------------------------------
# Local entrypoint: prints deploy instructions when run with `modal run`
# ---------------------------------------------------------------------------
@app.local_entrypoint()
def main():
    print(
        "\n"
        "Testbee RAG - Modal deployment helper\n"
        "--------------------------------------\n"
        "To DEPLOY the sidecar, run:\n"
        "\n"
        "    modal deploy modal_app.py\n"
        "\n"
        "Modal will print the live URL once the deploy completes.\n"
        "It looks like:\n"
        "\n"
        "    https://<workspace>--testbee-rag-serve.modal.run\n"
        "\n"
        "Then update your project root .env.local:\n"
        "\n"
        "    RAG_SIDECAR_URL=https://<workspace>--testbee-rag-serve.modal.run\n"
        "\n"
        "Secrets required in the Modal dashboard (Secret: testbee-rag-secrets):\n"
        "    RAG_SUPABASE_URL\n"
        "    RAG_SUPABASE_ANON_KEY\n"
        "    RAG_INTERNAL_TOKEN\n"
    )
