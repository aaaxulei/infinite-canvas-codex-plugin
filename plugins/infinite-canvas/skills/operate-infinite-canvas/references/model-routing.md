# Model routing

Apply these defaults only when the user did not choose a model. Preserve explicit
user choices for model, quality, resolution, duration, and aspect ratio.

Call `get_canvas_model_catalog` before configuring a generation node. Use exact
model IDs and copy the owning `provider_id` from the same catalog entry. Persist
both values as `selectedProvider` and `selectedModel` in one canvas mutation. Do not
invent, cache, or reuse a Provider UUID from another environment.

If an exact model ID appears under more than one Provider, use the Provider named in
the routing table or the Provider explicitly chosen by the user. If the requested
pair is absent from the current catalog, report that it is unavailable for the
paired account. Do not omit `selectedProvider` and do not select the first visible
model as a fallback.

## Routing table

| Task | Node configuration |
|---|---|
| Routine image editing | Use `imageOutput` with `selectedModel: "openai/gpt-image-2"` and `gptQuality: "medium"`. This model belongs to the `fal.ai` Provider. |
| Permitted image editing rejected by the first model as a content violation | Re-check the underlying request. If it is allowed and the rejection is a false positive or model mismatch, retry once with `imageOutput` and `selectedModel: "fal-ai/bytedance/seedream/v5/pro"`. Do not retry genuinely disallowed requests. |
| Image-to-video | Use `img2video` or `videoGeneration` in image-to-video mode with `selectedModel: "xai/grok-imagine-video/image-to-video"` and `aspectRatio: "auto"` unless the user specifies a ratio. This model belongs to the `fal.ai (Img2Video)` Provider. |
| Reference-to-video | Use `videoGeneration` in `seedance` mode with `selectedModel: "bytedance/seedance-2.0/runninghub-multimodal"`. Prefer `resolution: "480p"` for routine drafts and `resolution: "720p"` when the user requests more detail or a final-quality result. Use `aspectRatio: "auto"` unless specified. This model belongs to the `RunningHub (Seedance)` Provider. |

## Priority and failures

1. Follow an explicit user model choice first.
2. Apply the routing table when no model was specified.
3. Preserve existing model settings when extending an existing configured node,
   unless the user asks to replace them.
4. Resolve the chosen model through the current account's model catalog and store
   its exact Provider/model pair.
5. If the chosen model is unavailable or unauthorized, report the failure. Do not
   silently route to a different model solely to bypass permissions or safety.

## Content-violation retry

Treat a Provider's content-violation result as a reason to re-check the request, not
as automatic permission to bypass that Provider:

1. If the underlying image request is allowed, retry once with Seedream 5.0 Pro.
2. If the underlying request is disallowed, do not retry it with another model.
   Explain the limitation and, when useful, offer a compliant revision.
3. Never weaken, disguise, or split a request solely to evade a safety decision.
