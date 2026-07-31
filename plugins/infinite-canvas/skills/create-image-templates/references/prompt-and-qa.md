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

Infer the model style that best fits the template theme before writing the Soul
prompt. Use a direct temperament such as sweet, cool, mature and confident,
handsome, playful, elegant, relaxed, or another reference-supported style. Match
the clothing, expression, and body language to that choice.

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
Adapt the inferred model style, region, explicit gender, clothing, and simple
everyday setting:

```text
成年[地区和明确要求的性别]，[根据模板主题推断的甜美、冷酷、御姐、帅气或其他气质]，
真实的 Instagram/TikTok 高颜值时尚博主风格，五官精致自然，[与气质匹配的穿搭、
表情和身体语言]，正面面对镜头，脸部与主要五官清晰可见，自然皮肤质感，日常生活
场景，自然光，真实手机随拍质感，像发布在个人社交动态中的生活照片。
```

Do not add a negative prompt, exclusion list, prohibition wording, or metadata
labels such as “地区：”, “模型：”, or “要求：”.

## Reusable effect prompt contract

Write concrete visual facts rather than abstract praise.

```text
CHANGE: [scene, composition, pose, wardrobe, props, environment, lighting, color,
camera perspective, depth, texture, and intended photographic treatment].

PRESERVE: Keep the exact identity, facial structure, recognizable features, natural
skin texture, and plausible anatomy of the person from the reference image. Keep
the face readable; slight natural occlusion is acceptable.

REFERENCE ROLE: The input image defines identity only.

PROHIBIT: No screenshot UI, status bar, buttons, usernames, profile icons, arrows,
upload thumbnail, credits, captions, random text, logo, watermark, extra people,
duplicate body parts, malformed hands, severe face obstruction that prevents
recognition, or low resolution.
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
7. prohibited UI, random text, anatomy errors, and severe face obstruction.

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
- keeps the same accepted Soul result, paid model, and `2:3` output;
- creates a separate V2 prompt and result without overwriting V1.

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
- The result has a documented reference-comparison verdict.
- A separate V2 exists only when the V1 verdict was `needs correction`.
- The final candidate is suitable for user review.

### Free comparison

- Generated only after explicit approval.
- `2:3`.
- Uses the same accepted Soul generation result and the approved V1 or V2 prompt.
- Stored separately from the paid result.
- Visually inspected and arranged for side-by-side comparison.
