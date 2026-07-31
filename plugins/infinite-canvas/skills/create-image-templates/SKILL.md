---
name: create-image-templates
description: Build reusable, approval-gated image-template workflows in Infinite Canvas from reference documents, Feishu/Lark Doc or Wiki pages, screenshots, or supplied images. Use the available lark-doc skill and lark-cli to read Feishu/Lark text and inspect its media before creating templates. Use when the user asks to infer a suitable non-celebrity model temperament and broad fashion style from each reference theme; generate distinct Pinterest-like 1:1, 720p, General-style Soul 2.0 influencer source portraits from Chinese positive-only prompts without copying the reference outfit, pose, props, composition, or scene; reverse-engineer identity-neutral prompts; create 2:3 paid proofs with fal.ai GPT Image 2.0 or Nano Banana Pro; compare proofs with the references and automatically make one prompt-corrected V2 only when needed; pause for user review; and only after explicit approval create a comparable Free boogui2i version.
---

# Create Image Templates

Create one reusable workflow per reference image while preserving a strict paid-proof
approval gate before any free-model generation.

Before using canvas tools, load and follow
`../operate-infinite-canvas/SKILL.md`, including its read-before-write, catalog,
layout, execution, and completion rules. Read
[`references/prompt-and-qa.md`](references/prompt-and-qa.md) before writing prompts
or reviewing generated images.

## Workflow

### 1. Read and index the references

For a Feishu/Lark `/docx/` or `/wiki/` URL:

1. Load and follow the available `lark-doc` skill, including its required
   `lark-shared` authentication rules and fetch/media references. When using the
   CLI, read its version-matched instructions with `lark-cli skills read lark-doc`
   and the referenced fetch/media files before choosing flags.
2. Read the document with
   `lark-cli docs +fetch --as user --doc "<URL>"`. A `/wiki/` URL is a supported
   document source; do not stop at the Wiki container.
3. Cover the complete document because every template and reference must be
   indexed. For a large document, use outline and section fetches until every
   relevant section and media block has been covered.
4. Preserve document order. Associate each `<img>` with its closest caption,
   instruction, heading, or table cell before analyzing it.
5. Inspect every reference image. Use an image URL from `<img>` directly when
   available; otherwise use
   `lark-cli docs +media-preview --as user --token "<token>"` with a relative
   output path, then open the saved image for visual inspection. Use
   `+media-download` when the user explicitly requests a download or when the
   source is a whiteboard.

If `lark-cli` is unavailable, authentication or permission fails, or document
media cannot be retrieved, do not continue from partial text while claiming the
source was fully read. Follow the `lark-shared` authorization flow first. If that
path remains unavailable, use a logged-in Chrome session to inspect the complete
document and all reference images. If neither path can provide complete access,
stop before generation and ask the user to grant access, export the document, or
attach the missing images.

Read the complete source document and inspect every reference image with its nearby
description. Build an internal row for each template containing:

- template number and short scene name;
- required model region and any explicit gender requirement;
- inferred non-celebrity model temperament, styling, expression, and everyday context;
- composition, pose, clothing, props, environment, light, color, and lens cues;
- screenshot elements to ignore;
- source ambiguity or missing information.

Follow an explicit region requirement. If none is present, use a Western model.
Infer the model temperament from the reference theme, scene, styling, emotional
tone, and intended audience. Select a believable everyday person whose presence
supports the template rather than a generic runway model or celebrity look.
Treat phone or platform screenshots as containers: analyze the main visual only and
exclude status bars, buttons, usernames, thumbnails, captions, arrows, credits,
logos, and watermarks.

### 2. Generate the model portrait

Resolve `soul-v2-standard` through the current canvas model catalog and use its
owning Provider. Configure every Soul node explicitly from the live catalog:

- aspect ratio `1:1`;
- resolution/quality `720p`;
- the style option named `General` from the model's current `style_options`;
- prompt enhancement/expansion disabled (`soulEnhancePrompt: false`);
- one output unless the user explicitly requests a batch.

Do not rely on node defaults for these settings. Persist the Provider/model pair
and the catalog-backed values on the node before execution.

Generate a separate model portrait for each template with:

- a model style inferred from the template theme, such as sweet, cool, mature and
  confident, handsome, playful, elegant, or another clearly fitting temperament;
- only a broad fashion direction inferred from the theme, such as sweet casual,
  cool streetwear, elegant minimal, or relaxed everyday;
- a genuinely high-attractiveness adult with a believable Instagram/TikTok fashion
  blogger presence;
- a standalone Pinterest-like person source photo with a newly invented, simple
  everyday outfit;
- a realistic, everyday phone-camera look with natural skin and a lived-in setting,
  not an editorial or cinematic campaign image;
- a front-facing pose with a clear face and no severe occlusion;
- expression and body language that support the inferred model style.

Apply the documented region, explicit gender, and inferred temperament only to the
model-generation prompt. Do not carry fixed identity traits into the reusable
effect prompt. Write every Soul model-generation prompt in Chinese and include only
positive visual descriptions. Do not append negative-prompt clauses, exclusion
lists, or sentences beginning with prohibitions. An incidental watermark is
acceptable and is not a regeneration reason.

Treat the template as a casting brief for Soul, not as a wardrobe or composition
reference. Do not put its exact garments, colors, accessories, pose, props,
composition, or scene into the Soul prompt. Keep those details exclusively for the
reusable effect prompt in the next stage.

Visually inspect every model portrait. Accept it when the face is clear and has no
severe occlusion; do not apply additional visual-quality rejection criteria.
Regenerate only when this standard fails. Do not convert accepted Soul results or
their temporary URLs into durable private canvas assets. Keep the accepted Soul
generation node in the workflow and connect its image output directly to downstream
image-edit generation. Run downstream proofs while the temporary result remains
available. If it expires before a required downstream run, regenerate the Soul
result with the unchanged prompt, seed, and settings instead of uploading or
persisting it.

### 3. Reverse-engineer the reusable effect prompt

Describe the main image, not its screenshot container. Capture composition, action,
wardrobe, props, setting, light, color, perspective, depth of field, texture, and
photographic treatment.

Keep the effect prompt identity-neutral. Do not fix gender, age, skin color, facial
features, hairstyle, or body shape. Refer to the subject as “the person from the
reference image” or an equivalent generic phrase.

Use the four-part contract from the prompt reference:

- `CHANGE`
- `PRESERVE`
- `REFERENCE ROLE`
- `PROHIBIT`

Put every editable prompt in a text node and connect it to its generation node via
the text input handle.

### 4. Create the paid proof

Create one paid proof per template at `2:3`.

Resolve the exact Provider/model pair from the current catalog:

1. Default to fal.ai `openai/gpt-image-2`.
2. Prefer fal.ai `fal-ai/nano-banana-pro` when the task materially depends on
   multiple references, dense compositing, or stronger cross-image consistency.
3. Do not run both paid models unless the user requests a comparison or the first
   choice fails or clearly misses the template.

Use the accepted Soul generation result directly with the reusable effect prompt.
Preserve the subject’s identity while implementing the reference composition. Name
nodes and groups with the template number, stage, model, and `2:3`.

Inspect paid proofs for prompt adherence, identity, face clarity, anatomy, unwanted
text/UI, composition, and visual finish. Compare every proof directly with its
reference image using the rubric in the prompt reference.

Classify the result:

- **Meets or exceeds**: the signature composition, subject relationship, scene,
  styling, light, color, and mood are present with no disqualifying defect. Keep V1
  and do not generate another paid version.
- **Needs correction**: one or more important visual relationships are missing or
  materially wrong. Record the largest one to three gaps, preserve what already
  works, revise only the relevant prompt clauses, and generate one V2 with the same
  model and accepted Soul result.

Keep V1 when creating V2. Give the revised prompt and result distinct `V2` labels.
Compare V2 with the reference again. Do not enter an unbounded paid retry loop; if
V2 still misses the target, report the remaining gaps and leave the decision to the
user. Retry technical failures separately; do not silently replace a deliberate
model choice.

### 5. Stop for user approval

After all paid proofs reach a terminal state:

1. Arrange and focus the paid-proof groups.
2. Report the model and reference-comparison verdict for each template.
3. State whether V1 was retained or a prompt-corrected V2 was generated.
4. Present the final candidate results for review.
5. Stop.

Do not create, configure, or run Free/boogui2i nodes before the user explicitly
approves the paid proof with wording such as “验收通过” or “可以生成免费版”.

If the user rejects some proofs, revise only those prompts or results, present them
again, and remain at the approval gate.

### 6. Generate the free comparison after approval

On a later explicit approval:

1. Read the live canvas and identify the approved template groups.
2. Resolve Provider `Free` with model ID `ggnnp` (display name `boogui2i`) from the
   current catalog.
3. Create a separate `2:3` free-version node for each approved template.
4. Use the same accepted Soul generation result and the exact approved V1 or V2
   prompt for a fair model comparison. If that temporary result has expired,
   regenerate it from the unchanged Soul prompt, seed, and settings; do not persist
   it as a private asset.
5. Do not overwrite the paid proof.
6. Run the free nodes, inspect them, and place paid and free results so they can be
   compared easily.

Do not use the paid image itself as an additional reference unless the user asks
for direct replication rather than a fair model comparison.

## Canvas structure

Use this logical order for every template:

```text
Model prompt → Soul 2.0 temporary result → reusable effect prompt
                                          → paid 2:3 proof
                                          → approval gate
                                          → boogui2i 2:3 comparison
```

Keep each template in a clearly named group. Preserve unrelated canvas content.
Never overwrite an accepted result when adding another model variant.

## Completion report

For each completed stage, report:

- templates processed and any region defaults used;
- the inferred model temperament and why it fits each reference;
- exact Provider/model pairs, aspect ratios, Soul quality/style, and prompt
  enhancement state;
- successful, failed, or regenerated items;
- the reference-comparison verdict, major gaps, and any V2 prompt corrections;
- whether the workflow is waiting for approval or has produced free comparisons;
- any remaining visual limitations.
