# Prompt patterns and visual QA

Use this reference when writing model prompts, reverse-engineering effect prompts,
or reviewing paid and free outputs.

## Contents

- Model temperament inference
- Model portrait prompt pattern
- Reusable effect prompt contract
- Paid-model choice
- Reference comparison and V2 decision
- Visual QA checklist

## Model temperament inference

Infer a short talent brief before writing the Soul prompt:

- **Role in the image**: observer, host, traveler, fashion subject, romantic lead,
  quiet protagonist, energetic participant, or another reference-supported role.
- **Temperament**: relaxed, warm, reserved, playful, confident, contemplative,
  adventurous, elegant, cool, or another visible quality.
- **Styling level**: everyday casual, refined lifestyle, occasion wear, editorial,
  outdoor, traditional, or minimal.
- **Expression and body language**: candid smile, calm gaze, gentle look-back,
  poised stillness, spontaneous movement, or another scene-compatible behavior.
- **Everyday context**: café, street, home, festival, coast, nature, studio-like
  wall, or another understated setting.

Choose a believable non-celebrity who could naturally inhabit the reference scene.
Retain attractive creator/influencer appeal, but avoid celebrity resemblance,
runway stiffness, luxury-campaign perfection, and an overly manufactured face.

## Model portrait prompt pattern

Adapt region, explicit gender, inferred temperament, clothing, expression, body
language, and environment to the source document. Keep the overall target stable:

```text
A square Instagram-style lifestyle portrait photograph of an adult [region and
explicit gender only when required], with a [reference-derived temperament] and
believable non-celebrity presence, [scene-compatible styling, expression, and body
language], half-body or near-half-body framing, full face clearly visible and
sharply focused, both eyes visible, hair away from the eyes and face, hands away
from the face, approachable creator appeal, realistic natural skin texture,
flattering directional daylight, an understated everyday environment with gentle
depth, candid but composed photography, natural anatomy. No celebrity resemblance,
no runway pose, no luxury campaign polish, no poster design, no typography, no
logo, no watermark, no interface, no beauty-filter artifacts, no face obstruction.
```

Avoid metadata labels such as “region:”, “model:”, or “requirements:” inside the
generation prompt. They can encourage unwanted layouts or text.

## Reusable effect prompt contract

Write concrete visual facts rather than abstract praise.

```text
CHANGE: [scene, composition, pose, wardrobe, props, environment, lighting, color,
camera perspective, depth, texture, and intended photographic treatment].

PRESERVE: Keep the exact identity, facial structure, recognizable features, natural
skin texture, and plausible anatomy of the person from the reference image. Keep
the face clear and unobstructed.

REFERENCE ROLE: The input image defines identity only.

PROHIBIT: No screenshot UI, status bar, buttons, usernames, profile icons, arrows,
upload thumbnail, credits, captions, random text, logo, watermark, extra people,
duplicate body parts, malformed hands, face obstruction, or low resolution.
```

Do not include a fixed gender, age, skin color, face shape, hairstyle, or body type
in the effect prompt. A requested garment or pose is allowed when it defines the
template’s visual effect rather than the subject’s identity.

## Paid-model choice

- Use fal.ai `openai/gpt-image-2` by default for high-fidelity editing, complex
  instructions, selective color, and polished final imagery.
- Use fal.ai `fal-ai/nano-banana-pro` when multiple references or cross-image
  consistency materially dominate the task.
- Keep the output at `2:3`, using the exact size token exposed by the runtime
  catalog for the chosen model.
- Run one paid model first. Use the other only for an explicit comparison or a
  justified retry.

## Reference comparison and V2 decision

Compare the paid proof side by side with the main reference image. Ignore screenshot
chrome and judge the intended image across these dimensions:

1. composition, crop, subject scale, and camera angle;
2. pose, gaze, gesture, and subject-environment relationship;
3. wardrobe, props, and signature scene elements;
4. spatial layout, foreground, background, and depth;
5. light direction, contrast, color structure, and atmosphere;
6. lens feeling, texture, photographic finish, and overall mood;
7. prohibited UI, random text, anatomy errors, and face obstruction.

Treat creative differences as acceptable when the reference’s essential visual
logic remains recognizable. Mark **meets or exceeds** when the signature elements
and relationships are present and the result has no critical defect. Do not create
V2 in that case.

Mark **needs correction** when an important relationship is missing, reversed,
poorly framed, visually weak, or contradicted. Identify at most three high-impact
gaps. Create a revised prompt that:

- explicitly corrects those gaps;
- preserves successful composition and identity details;
- avoids rewriting unrelated clauses;
- keeps the same Soul asset, paid model, and `2:3` output;
- creates a separate V2 prompt and result without overwriting V1.

After V2, compare again. Stop automatic paid iteration after this one corrective
version. Report remaining gaps for user judgment.

## Visual QA checklist

### Model portrait

- Square `1:1`.
- Correct region and explicit gender, or Western default when unspecified.
- Temperament, styling, expression, and setting fit the reference theme.
- Believable non-celebrity presence with Instagram-style daily-life appeal.
- No celebrity resemblance, runway stiffness, or overproduced campaign look.
- Half-body or near-half-body composition.
- Face and both eyes sharp, complete, and unobstructed.
- Natural skin, hair, shoulders, and hands.
- No typography, watermark, interface, or poster layout.

### Paid proof

- `2:3`.
- Identity matches the accepted Soul model.
- Main reference composition and action are recognizable.
- Clothing, props, scene, light, and color relationships follow the prompt.
- Face remains clear; hands and anatomy are plausible.
- Screenshot UI and random text are absent.
- The result has a documented reference-comparison verdict.
- A separate V2 exists only when the V1 verdict was `needs correction`.
- The final candidate is suitable for user review.

### Free comparison

- Generated only after explicit approval.
- `2:3`.
- Uses the same Soul asset and the approved V1 or V2 prompt.
- Stored separately from the paid result.
- Visually inspected and arranged for side-by-side comparison.
