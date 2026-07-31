---
name: create-image-templates
description: Build reusable, approval-gated image-template workflows in Infinite Canvas from reference documents, Feishu/Lark pages, screenshots, or supplied images. Use when the user asks to infer a suitable non-celebrity model temperament from each reference theme, scene, and style; generate 1:1 Soul 2.0 lifestyle portraits; reverse-engineer identity-neutral prompts; create 2:3 paid proofs with fal.ai GPT Image 2.0 or Nano Banana Pro; compare proofs with the references and automatically make one prompt-corrected V2 only when needed; pause for user review; and only after explicit approval create a comparable Free boogui2i version.
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
owning Provider. Generate a separate model portrait for each template with:

- `1:1` aspect ratio;
- Instagram-style, natural daily-life photography;
- a believable, attractive non-celebrity presence with approachable creator energy;
- temperament, styling, expression, and body language inferred from the template;
- no celebrity impersonation, runway-model posing, or overproduced campaign polish;
- half-body or near-half-body framing;
- a complete, sharp, unobstructed face and both eyes visible;
- relaxed expression, natural skin texture, and plausible anatomy;
- hair and hands kept away from the face;
- a simple lifestyle background that remains secondary;
- no text, logo, watermark, interface, or graphic layout.

Apply the documented region, explicit gender, and inferred temperament only to the
model-generation prompt. Do not carry fixed identity traits into the reusable
effect prompt.

Visually inspect every model portrait. Regenerate only failed portraits. Convert
each accepted result into a durable private canvas asset before downstream editing,
so reference-required models receive an asset ID rather than only a transient URL.

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

Use the accepted Soul asset and the reusable effect prompt. Preserve the subject’s
identity while implementing the reference composition. Name nodes and groups with
the template number, stage, model, and `2:3`.

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
  model and Soul asset.

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
4. Use the same durable Soul asset and the exact approved V1 or V2 prompt for a fair
   model comparison.
5. Do not overwrite the paid proof.
6. Run the free nodes, inspect them, and place paid and free results so they can be
   compared easily.

Do not use the paid image itself as an additional reference unless the user asks
for direct replication rather than a fair model comparison.

## Canvas structure

Use this logical order for every template:

```text
Model prompt → Soul 2.0 model asset → reusable effect prompt
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
- exact Provider/model pairs and aspect ratios;
- successful, failed, or regenerated items;
- the reference-comparison verdict, major gaps, and any V2 prompt corrections;
- whether the workflow is waiting for approval or has produced free comparisons;
- any remaining visual limitations.
