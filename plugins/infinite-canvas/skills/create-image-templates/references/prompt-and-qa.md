# Prompt patterns and visual QA

Use this reference when writing model prompts, reverse-engineering effect prompts,
or reviewing paid and free outputs.

## Contents

- Model temperament inference
- Model portrait prompt pattern
- Reusable effect prompt standard
- Paid-model choice
- Reference comparison and V2 decision
- Visual QA checklist

## Model temperament inference

Infer the model style that best fits the template theme before writing the Soul
prompt. Use a direct temperament such as sweet, cool, mature and confident,
handsome, playful, elegant, relaxed, or another reference-supported style. Infer
only a broad fashion direction, then invent a distinct simple everyday outfit.
Reserve the reference image's exact wardrobe and visual setup for the later effect
prompt.

## Soul node settings

Resolve `soul-v2-standard` and all parameter values from the live catalog. Set and
persist these values explicitly before every Soul run:

- aspect ratio: `1:1`;
- quality/resolution: `720p`;
- style: the catalog option named `General`;
- prompt enhancement/expansion: off (`soulEnhancePrompt: false`);
- batch size: `1`, unless the user explicitly requests multiple candidates.

Do not convert an accepted Soul result into a durable private user asset. Connect
the Soul generation node's result directly to downstream editing nodes. Temporary
result expiry is handled by rerunning the unchanged prompt, seed, and settings, not
by uploading or persisting its output.

## Model portrait prompt pattern

Write the Soul prompt entirely in Chinese with positive visual descriptions only.
Adapt the inferred model style, broad fashion direction, region, and explicit
gender. Create an independent Pinterest-like person source photo:

```text
成年[地区和明确要求的性别]，[根据模板主题推断的甜美、冷酷、御姐、帅气或其他气质]，
真实的 Instagram/TikTok 高颜值时尚博主风格，五官精致自然，穿着符合[甜美休闲、
冷酷街头、优雅极简或其他宽泛风格]的简洁日常时尚穿搭，正面面对镜头，脸部与主要
五官清晰可见，自然皮肤质感，简单日常背景，自然光，真实手机随拍质感，像在
Pinterest 上找到的独立博主人物素材照片。
```

Do not add a negative prompt, exclusion list, prohibition wording, or metadata
labels such as “地区：”, “模型：”, or “要求：”. Do not copy the reference
image's specific garment type, color combination, accessories, pose, props,
composition, or location into the Soul prompt.

## Reusable effect prompt standard

Write concrete visual facts rather than abstract praise. Use formal English prose
that reads as one production-ready instruction, not a form, schema, checklist, or
conversation with an earlier generation.

A complete effect prompt should naturally cover these ideas:

1. Begin with the operation and identity source, for example: “Generate a
   photorealistic portrait based on the person in the uploaded image, preserving
   the person’s recognizable identity and natural facial structure.”
2. Describe the desired composition, crop, pose, gaze, wardrobe, props, setting,
   spatial relationships, lighting, color, camera angle, depth of field, texture,
   and finish in explicit visual language.
3. End with concise quality and exclusion sentences when needed, for example:
   “Keep the face clearly readable and the anatomy plausible. The final image must
   not contain screenshot interfaces, random text, logos, watermarks, extra people,
   or duplicated body parts.”

Do not include field names or headings such as `CHANGE`, `PRESERVE`, `REFERENCE
ROLE`, `PROHIBIT`, `NEGATIVE PROMPT`, or close variants. Do not include bullets,
analysis notes, QA findings, or a change log in a generation prompt.

Do not include a fixed gender, age, skin color, face shape, hairstyle, or body type
in the effect prompt. A requested garment or pose is allowed when it defines the
template’s visual effect rather than the subject’s identity.

## Independence and revision rules

Treat every model call as independent. A prompt must make sense when executed from
scratch with only its current input image or images. It must not rely on chat
history, a prior prompt, or an earlier generated image.

Never write process-dependent phrases such as:

- `V1` or `V2`;
- “the previous version,” “the earlier result,” or “the first generation”;
- “preserve what already works,” “keep the successful black-and-white look,” or
  “continue the atmosphere established earlier”;
- any request to extend, refine, improve, or otherwise inherit unnamed qualities
  from a previous output.

Version markers are allowed only in canvas node names and workflow reports. When a
proof needs correction, keep the comparison findings outside the prompt and create
a new, complete English prompt. Restate every desired visual property explicitly,
including properties that did not need correction. For example, instead of writing
“Preserve V1’s successful high-contrast black-and-white texture and dark
background,” write the actual target description: “Use high-contrast black-and-
white photography, a deep charcoal studio background, realistic skin texture, and
precise focus on both eyes and the lips.”

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
7. prohibited UI, random text, anatomy errors, and severe face obstruction.

Treat creative differences as acceptable when the reference’s essential visual
logic remains recognizable. Mark **meets or exceeds** when the signature elements
and relationships are present and the result has no critical defect. Do not create
V2 in that case.

Mark **needs correction** when an important relationship is missing, reversed,
poorly framed, visually weak, or contradicted. Identify at most three high-impact
gaps. Create a revised prompt that:

- explicitly corrects those gaps;
- restates the full desired composition and identity treatment in standalone form;
- retains satisfactory visual requirements by writing them out explicitly rather
  than referring to the prior result;
- keeps the same accepted Soul result, paid model, and `2:3` output;
- creates a separate V2 prompt and result without overwriting V1;
- uses `V1` and `V2` only in node labels and reporting, never in prompt text.

After V2, compare again. Stop automatic paid iteration after this one corrective
version. Report remaining gaps for user judgment.

## Visual QA checklist

### Model portrait

- Square `1:1`.
- `720p`, catalog style `General`, and prompt enhancement/expansion off.
- Soul prompt is entirely in Chinese and contains positive visual descriptions only.
- Correct region and explicit gender, or Western default when unspecified.
- Model style is clearly inferred from and suitable for the template theme.
- Subject is genuinely high-attractiveness with a realistic Instagram/TikTok
  fashion-blogger presence.
- Soul is an independent Pinterest-like person source photo; reference-specific
  wardrobe, pose, props, composition, and scene remain in the effect stage.
- Everyday phone-camera realism rather than an editorial or cinematic image.
- Face is clear and has no severe occlusion. This is the only visual usability
  criterion for accepting or regenerating the Soul portrait.
- Incidental watermarks are acceptable and are not a regeneration reason.
- Result remains on the generation node and is not converted into a durable private
  asset.

### Paid proof

- `2:3`.
- Identity matches the accepted Soul model.
- Main reference composition and action are recognizable.
- Clothing, props, scene, light, and color relationships follow the prompt.
- Face remains clear; hands and anatomy are plausible.
- Screenshot UI and random text are absent.
- Prompt text is formal, self-contained English prose with no prompt-schema labels,
  version references, prior-result references, analysis notes, or change log.
- The result has a documented reference-comparison verdict.
- A separate V2 exists only when the V1 verdict was `needs correction`.
- The final candidate is suitable for user review.

### Free comparison

- Generated only after explicit approval.
- `2:3`.
- Uses the same accepted Soul generation result and the approved V1 or V2 prompt.
- Stored separately from the paid result.
- Visually inspected and arranged for side-by-side comparison.
